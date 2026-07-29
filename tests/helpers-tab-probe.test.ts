// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default
const ThreadView = (await import('../src/renderer/src/views/ThreadView')).default

const PARENT = 'parent-thread'
const CHILD = 'child-thread'
const OTHER = 'other-child'

const thread = (id: string, parentThreadId?: string): ThreadMeta => ({
  id,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A thread',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build',
  parentThreadId
})

const spawned = (threadId: string, subject: string): SessionEvent => ({
  id: `started-${threadId}`,
  ts: 1000,
  kind: 'subagent.started',
  threadId,
  parentThreadId: PARENT,
  parentPromptId: 'p1',
  name: 'Scout',
  subject,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  byName: 'Bubbles'
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({
    threads: { [PARENT]: thread(PARENT), [CHILD]: thread(CHILD, PARENT), [OTHER]: thread(OTHER, PARENT) },
    openThreadId: PARENT,
    events: [],
    steps: {},
    threadPrompts: {},
    queues: {}
  })
})

afterEach(cleanup)

const sent = (...events: SessionEvent[]) => act(() => useCrew.setState({ events }))
const helperTab = () => useBrowser.getState().tabs.find(t => t.kind === 'agent') ?? null

describe('the helpers a thread sent out', () => {
  // A chip, the row under the chips and the panel's own list are three ways into
  // one thing, so they are one tab. Opening a second helper takes the place of
  // the first rather than standing a near identical pill beside it.
  it('is one tab however many are opened', () => {
    sent(spawned(CHILD, 'reading the schema'), spawned(OTHER, 'reading the tests'))

    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))
    act(() => useBrowser.getState().openSubagent(OTHER, PARENT))

    expect(useBrowser.getState().tabs.filter(t => t.kind === 'agent')).toHaveLength(1)
    expect(helperTab()!.threadId).toBe(OTHER)
  })

  it('rides on the thread that sent them, so the way back out is still there', () => {
    act(() => useBrowser.getState().showSubagents(PARENT))

    expect(helperTab()!.parentThreadId).toBe(PARENT)
    expect(helperTab()!.threadId).toBe('')
  })

  it('takes the list back without opening a second tab', () => {
    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))
    act(() => useBrowser.getState().showSubagents(PARENT))

    expect(useBrowser.getState().tabs.filter(t => t.kind === 'agent')).toHaveLength(1)
    expect(helperTab()!.threadId).toBe('')
  })

  // The one button in the thread's header shows and hides the panel. What is in
  // it is picked in the panel, so a thread that has sent a helper out has the
  // same button as one that has not.
  it('is reached through the one button every thread has', () => {
    const { getByLabelText, getByText } = render(
      createElement('div', null, createElement(ThreadView, { threadId: PARENT }), createElement(BrowserPanel))
    )
    sent(spawned(CHILD, 'reading the schema'))

    fireEvent.click(getByLabelText('Show panel'))
    fireEvent.click(getByText('Helpers'))

    expect(helperTab()!.parentThreadId).toBe(PARENT)
  })
})
