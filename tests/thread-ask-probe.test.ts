// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PooledAgent } from '../src/shared/llm'
import type { ThreadMeta } from '../src/renderer/src/state/store'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')
const ThreadView = (await import('../src/renderer/src/views/ThreadView')).default

const THREAD = 't1'

const agent: PooledAgent = {
  id: 'agent-1',
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const thread = (extra: Partial<ThreadMeta> = {}): ThreadMeta => ({
  id: THREAD,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: '@Bubbles show the thread title inside the thread',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build',
  ...extra
})

const open = (extra: Partial<ThreadMeta> = {}, agents: PooledAgent[] = [agent]) => {
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents,
    threads: { [THREAD]: thread(extra) },
    openThreadId: THREAD,
    events: [],
    steps: {},
    threadPrompts: {},
    threadDrafts: {},
    threadCommands: {},
    queues: {},
    pending: {}
  })
  return render(createElement(ThreadView, { threadId: THREAD }))
}

const askLine = (container: HTMLElement): HTMLElement | null =>
  [...container.querySelectorAll('button')].find(el =>
    (el.textContent ?? '').startsWith('show the thread title')
  ) as HTMLElement | null

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
})

afterEach(cleanup)

describe('what a thread is about, said inside the thread', () => {
  it('stands under the name of the agent it is with', () => {
    const { container } = open()

    const ask = askLine(container)
    expect(ask).not.toBeNull()
    expect(ask?.textContent).toBe('show the thread title inside the thread')
  })

  // The name is on the row above it, so the mention in front of the ask would be
  // the same word read twice.
  it('leaves the agent out of it', () => {
    const { container } = open()

    expect(askLine(container)?.textContent).not.toContain('@Bubbles')
  })

  // A renamed agent is named once, and by the name it goes by now.
  it('brings a rename up to date before taking the mention out', () => {
    const { container } = open(
      {
        title: '@Bubble show the thread title inside the thread',
        titleRefs: [{ id: 'agent-1', label: 'Bubble' }]
      },
      [agent]
    )

    const ask = askLine(container)
    expect(ask?.textContent).toBe('show the thread title inside the thread')
    expect(container.textContent).not.toContain('@Bubble')
  })

  it('says nothing for a thread opened on a mention and nothing else', () => {
    const { container } = open({ title: '@Bubbles' })

    expect(askLine(container)).toBeNull()
  })

  it('goes to the head of the thread, where the whole of it is written', () => {
    const { container } = open()
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    const scrollTo = vi.fn()
    scroller.scrollTo = scrollTo as unknown as HTMLElement['scrollTo']

    fireEvent.click(askLine(container) as HTMLElement)

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  // Pinned, the next thing to land would carry the view straight back down.
  it('unpins, so the thread stays where it was sent', () => {
    const { container, getByText } = open()
    const scroller = container.querySelector('.overflow-y-auto') as HTMLElement
    scroller.scrollTo = vi.fn() as unknown as HTMLElement['scrollTo']

    fireEvent.click(askLine(container) as HTMLElement)

    expect(getByText('Jump to bottom')).not.toBeNull()
  })
})
