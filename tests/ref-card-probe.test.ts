// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)
import { docExcerpt } from '../src/shared/docs'
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
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const DOC = ['# Heading', '', 'Some **bold** words.', '', '- first', '- second'].join('\n')

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

function boot(text = DOC) {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events,
    docs: { main: { title: 'Main', text: '' }, 'plan-1abc': { title: 'Plan', text } },
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

function hover(label: string): HTMLElement {
  vi.useFakeTimers()
  try {
    fireEvent.mouseEnter(screen.getByText(label).parentElement!)
    act(() => void vi.advanceTimersByTime(400))
  } finally {
    vi.useRealTimers()
  }
  return document.body.querySelector('.glass.fixed') as HTMLElement
}

describe('the card behind a doc pill', () => {
  it('renders the excerpt as markdown, not as plain text', () => {
    boot()
    const card = hover('Plan')
    expect(card).toBeTruthy()
    expect(card.querySelector('.md.md-peek')).toBeTruthy()
    expect(card.querySelector('h1')?.textContent).toBe('Heading')
    expect(card.querySelector('strong')?.textContent).toBe('bold')
    expect(card.querySelectorAll('li')).toHaveLength(2)
    expect(card.textContent).not.toContain('**bold**')
    expect(card.textContent).not.toContain('# Heading')
  })

  it('draws a checkbox for a task line and no bullet beside it', () => {
    boot(['- [ ] todo', '- [x] done'].join('\n'))
    const card = hover('Plan')
    expect(card.querySelectorAll('input')).toHaveLength(0)
    expect(card.querySelectorAll('li.md-task')).toHaveLength(2)
    expect(card.querySelectorAll('.md-check')).toHaveLength(2)
    expect(card.querySelectorAll('.md-check[data-checked]')).toHaveLength(1)
    expect(card.querySelector('ul')?.className).toContain('md-tasks')
  })

  it('leaves the card at the title alone when the doc is empty', () => {
    boot('')
    const card = hover('Plan')
    expect(card.querySelector('.md-peek')).toBeNull()
    expect(card.textContent).toContain('Plan')
  })
})

describe('the card behind a board pill', () => {
  it('puts the preview under the name and says nothing else', () => {
    boot()
    const card = hover('Landing')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Landing')
    expect(card.textContent).not.toContain('Design board')

    const preview = card.querySelector('[data-board-preview]')
    expect(preview).toBeTruthy()
    const name = screen.getAllByText('Landing').find(node => card.contains(node))!
    expect(preview!.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('shows a skeleton until the board arrives', () => {
    boot()
    const card = hover('Landing')
    expect(card.querySelector('[data-board-preview] [data-skeleton]')?.className).toContain('skeleton')
  })
})

describe('the excerpt a doc card previews', () => {
  it('keeps whole lines and stops at the limit', () => {
    const excerpt = docExcerpt(['# One', 'body line', 'x'.repeat(400)].join('\n'), 40)
    expect(excerpt).toBe('# One\nbody line')
  })

  it('clips a first line that runs past the limit on its own', () => {
    const excerpt = docExcerpt(`${'word '.repeat(40)}end`, 40)
    expect(excerpt.endsWith('…')).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(41)
  })

  it('closes a code fence it cut through', () => {
    const excerpt = docExcerpt(['```ts', 'const a = 1', 'const b = 2', 'const c = 3', '```'].join('\n'), 20)
    expect(excerpt.split('\n').filter(line => line.startsWith('```'))).toHaveLength(2)
  })

  it('leaves a fence that already closed alone', () => {
    const excerpt = docExcerpt(['```', 'hi', '```'].join('\n'), 200)
    expect(excerpt).toBe('```\nhi\n```')
  })
})
