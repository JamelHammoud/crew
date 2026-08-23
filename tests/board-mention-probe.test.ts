// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia
Element.prototype.scrollIntoView = () => {}
if (typeof globalThis.CSS === 'undefined') {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { default: DesignChip } = await import('../src/renderer/src/components/DesignChip')
const { default: ThreadItems } = await import('../src/renderer/src/components/ThreadItems')
const { useCrew } = await import('../src/renderer/src/state/store')

const events: SessionEvent[] = [
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'jamel',
    authorName: 'Jamel',
    text: 'see #Plan and #Landing',
    mentions: [],
    docMentions: [{ page: 'plan-1abc', title: 'Plan' }],
    boardMentions: [{ id: 'landing-1abc', name: 'Landing' }]
  }
]

const hostWithoutBoards: SessionEvent[] = [
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'jamel',
    authorName: 'Jamel',
    text: 'see #Plan and #Landing',
    mentions: [],
    docMentions: [{ page: 'plan-1abc', title: 'Plan' }]
  }
]

function boot(withMessage = true, log: SessionEvent[] = events) {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events: withMessage ? log : [],
    docs: { main: { title: 'Main', text: '' }, 'plan-1abc': { title: 'Plan', text: 'ship it' } },
    boards: [{ id: 'landing-1abc', name: 'Landing' }],
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null,
    designTarget: null
  })
  render(createElement(Chat))
}

function iconOf(label: string): string | null {
  return screen.getByText(label).querySelector('svg path')?.getAttribute('d') ?? null
}

describe('board mentions in a message', () => {
  it('pills a board beside a doc, without the hash, each with its own icon', () => {
    boot()
    const board = screen.getByText('Landing')
    expect(board.className).toContain('text-sky-300')
    expect(screen.queryByText('#Landing')).toBeNull()
    expect(iconOf('Landing')).toBeTruthy()
    expect(iconOf('Landing')).not.toBe(iconOf('Plan'))
  })

  it('pills a board the host never named', () => {
    boot(true, hostWithoutBoards)
    expect(screen.getByText('Landing').className).toContain('text-sky-300')
  })

  it('opens the board when its pill is clicked', () => {
    boot()
    fireEvent.click(screen.getByText('Landing'))
    expect(useCrew.getState().designTarget).toBe('landing-1abc')
    expect(useCrew.getState().docsTarget).toBeNull()

    fireEvent.click(screen.getByText('Plan'))
    expect(useCrew.getState().docsTarget).toBe('plan-1abc')
  })
})

describe('picking a board in the composer', () => {
  it('offers boards and docs under the same #', () => {
    boot(false)
    const input = screen.getByPlaceholderText('Ask Crew') as HTMLTextAreaElement
    input.focus()
    fireEvent.change(input, { target: { value: '#', selectionStart: 1, selectionEnd: 1 } })
    expect(screen.getByText('#Landing')).toBeTruthy()
    expect(screen.getByText('#Plan')).toBeTruthy()

    fireEvent.change(input, { target: { value: '#land', selectionStart: 5, selectionEnd: 5 } })
    expect(screen.queryByText('#Plan')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('#Landing ')
  })
})

describe('a design API chip', () => {
  it('opens the named board', () => {
    boot(false)
    cleanup()
    render(
      createElement(DesignChip, {
        item: {
          key: 'design',
          ts: 1,
          kind: 'design',
          author: 'Bubbles',
          self: false,
          text: '',
          streaming: false,
          design: { boardId: 'landing-1abc', action: 'read' }
        }
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Read Landing' }))
    expect(useCrew.getState().designTarget).toBe('landing-1abc')
  })

  it('keeps the tool-call gap around design chips in one run', () => {
    boot(false)
    cleanup()
    const { container } = render(
      createElement(ThreadItems, {
        items: [
          {
            key: 'thinking-before',
            ts: 1,
            kind: 'thinking',
            author: 'Bubbles',
            self: false,
            text: 'Planning the board',
            streaming: false,
            promptId: 'prompt-1'
          },
          {
            key: 'design-read',
            ts: 2,
            kind: 'design',
            author: 'Bubbles',
            self: false,
            text: '',
            streaming: false,
            promptId: 'prompt-1',
            design: { boardId: 'landing-1abc', action: 'read' }
          },
          {
            key: 'thinking-after',
            ts: 3,
            kind: 'thinking',
            author: 'Bubbles',
            self: false,
            text: 'Checking the board',
            streaming: false,
            promptId: 'prompt-1'
          },
          {
            key: 'design-other-run',
            ts: 4,
            kind: 'design',
            author: 'Bubbles',
            self: false,
            text: '',
            streaming: false,
            promptId: 'prompt-2',
            design: { boardId: 'landing-1abc', action: 'edit' }
          }
        ]
      })
    )

    expect(container.children[0].className).not.toContain('-mt-3')
    expect(container.children[1].className).toContain('-mt-3')
    expect(container.children[2].className).toContain('-mt-3')
    expect(container.children[3].className).not.toContain('-mt-3')
  })
})
