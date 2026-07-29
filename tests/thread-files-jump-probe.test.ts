// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStep } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
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
const PROMPT = 'p1'

const thread = (): ThreadMeta => ({
  id: THREAD,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A thread',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build'
})

const started: SessionEvent = {
  id: 'start-1',
  ts: 1000,
  kind: 'agent.start',
  promptId: PROMPT,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  promptText: 'Do the thing',
  byName: 'Jamel',
  threadId: THREAD
}

const wrote = (added: number, removed: number): AgentStep => ({
  id: 'step-1',
  ts: 1001,
  kind: 'tool',
  status: 'done',
  name: 'Edit',
  files: [{ path: 'src/one.ts', added, removed }]
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({
    threads: { [THREAD]: thread() },
    openThreadId: THREAD,
    events: [started],
    steps: { [PROMPT]: [wrote(7, 2)] },
    threadPrompts: {},
    queues: {}
  })
})

afterEach(cleanup)

// The scroller has no layout in here, so the numbers a scroll is read from are
// written on by hand. Two scrolls: one to say where it was, one going up.
const scrollUp = (container: HTMLElement) => {
  const el = container.querySelector('.overflow-y-auto') as HTMLElement
  Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 300, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: 0, writable: true, configurable: true })
  el.scrollTop = 900
  fireEvent.scroll(el)
  el.scrollTop = 100
  fireEvent.scroll(el)
}

describe('what the run has changed, from the top of a thread', () => {
  it('says nothing while you are at the foot of it', () => {
    const { queryByText } = render(createElement(ThreadView, { threadId: THREAD }))

    expect(queryByText('Jump to bottom')).toBeNull()
    expect(queryByText('1 file')).toBeNull()
  })

  it('stands beside the way back down once you have scrolled up', () => {
    const { container, getByText } = render(createElement(ThreadView, { threadId: THREAD }))

    act(() => scrollUp(container))

    expect(getByText('Jump to bottom')).not.toBeNull()
    expect(getByText('1 file')).not.toBeNull()
    expect(container.textContent).toContain('+7')
    expect(container.textContent).toContain('−2')
  })

  // The counts move while the run does, or the pill is a number from whenever
  // the thread was last at the bottom.
  it('moves with the run', () => {
    const { container, getByText } = render(createElement(ThreadView, { threadId: THREAD }))
    act(() => scrollUp(container))

    act(() => useCrew.setState({ steps: { [PROMPT]: [wrote(7, 2), { ...wrote(4, 1), id: 'step-2' }] } }))

    expect(getByText('1 file')).not.toBeNull()
    expect(container.textContent).toContain('+11')
    expect(container.textContent).toContain('−3')
  })

  it('says nothing for a thread that has changed nothing', () => {
    act(() => useCrew.setState({ steps: { [PROMPT]: [] } }))
    const { container, getByText, queryByText } = render(createElement(ThreadView, { threadId: THREAD }))

    act(() => scrollUp(container))

    expect(getByText('Jump to bottom')).not.toBeNull()
    expect(queryByText('1 file')).toBeNull()
  })
})
