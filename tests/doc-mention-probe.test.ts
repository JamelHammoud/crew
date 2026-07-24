// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(cleanup)
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

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
const { default: Docs } = await import('../src/renderer/src/views/Docs')
const { useCrew } = await import('../src/renderer/src/state/store')

const agent: PooledAgent = {
  id: 'jamel/bob',
  label: 'Bob (Kimi K3)',
  provider: 'kimi',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const title = '@Bob (Kimi K3) #Plan what does this page say?'

const events: SessionEvent[] = [
  {
    id: 'thread-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: agent.id,
    agentLabel: agent.label,
    title,
    byName: 'Jamel'
  },
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'jamel',
    authorName: 'Jamel',
    text: title,
    mentions: [agent.id],
    docMentions: [{ page: 'plan-1abc', title: 'Plan' }],
    threadId: 'thread-1'
  }
]

function boot() {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [agent],
    events,
    docs: { main: { title: 'Main', text: '' }, 'plan-1abc': { title: 'Plan', text: 'ship it' } },
    threads: {
      'thread-1': {
        id: 'thread-1',
        agentId: agent.id,
        agentLabel: agent.label,
        title,
        createdBy: 'Jamel',
        status: 'open'
      }
    },
    threadPrompts: {},
    threadDrafts: {},
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null
  })
  return render(createElement(Chat))
}

describe('doc mentions in the thread preview', () => {
  it('renders the agent name once and pills both mentions', () => {
    boot()
    const pill = screen.getByText('@Bob (Kimi K3)')
    const preview = pill.closest('p')!
    expect(preview.textContent).toBe(title)
    const doc = screen.getByText('#Plan')
    expect(doc.className).toContain('text-sky-300')
  })

  it('opens the doc page when its pill is clicked, without opening the thread', () => {
    const { unmount } = boot()
    fireEvent.click(screen.getByText('#Plan'))
    expect(useCrew.getState().docsTarget).toBe('plan-1abc')
    expect(useCrew.getState().openThreadId).toBeNull()

    unmount()
    render(createElement(Docs))
    expect(screen.getByDisplayValue('Plan')).toBeTruthy()
    expect(useCrew.getState().docsTarget).toBeNull()
  })
})
