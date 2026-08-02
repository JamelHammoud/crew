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
const PanelToggle = (await import('../src/renderer/src/components/PanelToggle')).default
const SubagentRun = (await import('../src/renderer/src/components/subagents/SubagentRun')).default
const ThreadView = (await import('../src/renderer/src/views/ThreadView')).default

const PARENT = 'parent-thread'
const CHILD = 'child-thread'
const OTHER = 'other-child'
const GRAND = 'grandchild-thread'

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

const spawned = (threadId: string, subject: string, parentThreadId = PARENT): SessionEvent => ({
  id: `started-${threadId}`,
  ts: 1000,
  kind: 'subagent.started',
  threadId,
  parentThreadId,
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
    threads: {
      [PARENT]: thread(PARENT),
      [CHILD]: thread(CHILD, PARENT),
      [OTHER]: thread(OTHER, PARENT),
      [GRAND]: thread(GRAND, CHILD)
    },
    openThreadIds: [PARENT],
    openThreadId: PARENT,
    events: [],
    steps: {},
    threadPrompts: {},
    threadDrafts: {},
    queues: {},
    tokens: {},
    pending: {}
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

  // The thread's own things stand only while you are in it, the way its plan and
  // its board do, so a row of tabs is about the thread on the screen.
  it('goes when you leave the thread', () => {
    render(createElement(BrowserPanel))
    sent(spawned(CHILD, 'reading the schema'))
    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))

    act(() => useCrew.setState({ openThreadIds: [], openThreadId: null }))

    expect(helperTab()).toBeNull()
    expect(useBrowser.getState().activeTabId).toBeNull()
    expect(useBrowser.getState().open).toBe(false)
  })

  it('leaves what the panel holds of its own where it is', () => {
    render(createElement(BrowserPanel))
    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))

    act(() => useCrew.setState({ openThreadIds: ['somewhere-else'], openThreadId: 'somewhere-else' }))

    expect(helperTab()).toBeNull()
    expect(useBrowser.getState().tabs.map(t => t.kind)).toEqual(['web'])
    expect(useBrowser.getState().open).toBe(true)
  })

  it('stands through a look at another tab in the same thread', () => {
    render(createElement(BrowserPanel))
    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))
    act(() => useBrowser.getState().openUrl('https://example.com/one'))

    expect(helperTab()!.threadId).toBe(CHILD)
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

  it('holds what a helper sent out itself, under the helper that sent it', () => {
    const { getByText } = render(createElement(BrowserPanel))
    sent(spawned(CHILD, 'reading the schema'), spawned(GRAND, 'reading the tests', CHILD))

    act(() => useBrowser.getState().showSubagents(PARENT))

    expect(getByText('reading the schema').closest('button')!.className).toContain('pl-4')
    expect(getByText('reading the tests').closest('button')!.className).toContain('pl-9')
  })

  it('opens one of those in the list it is already standing in', () => {
    sent(spawned(CHILD, 'reading the schema'), spawned(GRAND, 'reading the tests', CHILD))
    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))
    const { getByText } = render(createElement(SubagentRun, { threadId: CHILD }))

    fireEvent.click(getByText('reading the tests'))

    expect(useBrowser.getState().tabs.filter(t => t.kind === 'agent')).toHaveLength(1)
    expect(helperTab()!.parentThreadId).toBe(PARENT)
    expect(helperTab()!.threadId).toBe(GRAND)
  })
})
