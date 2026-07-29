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
  useBrowser.setState({ tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
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

describe('the way back to the helpers a thread sent out', () => {
  it('is not there until one has been sent', () => {
    const { queryByLabelText } = render(createElement(ThreadView, { threadId: PARENT }))

    expect(queryByLabelText('Show helpers')).toBeNull()
  })

  it('stands once one has, and opens them', () => {
    const { getByLabelText } = render(createElement(ThreadView, { threadId: PARENT }))
    sent(spawned(CHILD, 'reading the schema'))

    fireEvent.click(getByLabelText('Show helpers'))

    expect(helperTab()!.parentThreadId).toBe(PARENT)
    expect(helperTab()!.threadId).toBe('')
    expect(useBrowser.getState().activeTabId).toBe(helperTab()!.id)
  })

  it('puts them away again', () => {
    const { getByLabelText } = render(createElement(ThreadView, { threadId: PARENT }))
    sent(spawned(CHILD, 'reading the schema'))

    fireEvent.click(getByLabelText('Show helpers'))
    fireEvent.click(getByLabelText('Hide helpers'))

    expect(helperTab()).toBeNull()
  })

  // A chip and the button are two ways into one thing, so they are one tab. The
  // button reads pressed while a helper opened from a chip is standing, or it
  // says the panel is showing something else.
  it('reads pressed while a helper opened from a chip is standing', () => {
    const { getByLabelText, queryByLabelText } = render(createElement(ThreadView, { threadId: PARENT }))
    sent(spawned(CHILD, 'reading the schema'))

    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))

    expect(queryByLabelText('Show helpers')).toBeNull()
    expect(getByLabelText('Hide helpers').getAttribute('aria-pressed')).toBe('true')
  })

  it('is one tab however many helpers are opened', () => {
    render(createElement(ThreadView, { threadId: PARENT }))
    sent(spawned(CHILD, 'reading the schema'), spawned(OTHER, 'reading the tests'))

    act(() => useBrowser.getState().openSubagent(CHILD, PARENT))
    act(() => useBrowser.getState().openSubagent(OTHER, PARENT))

    expect(useBrowser.getState().tabs.filter(t => t.kind === 'agent')).toHaveLength(1)
    expect(helperTab()!.threadId).toBe(OTHER)
  })

  it('says nothing about another thread's helpers', () => {
    const { queryByLabelText } = render(createElement(ThreadView, { threadId: CHILD }))
    sent(spawned(CHILD, 'reading the schema'))

    expect(queryByLabelText('Show helpers')).toBeNull()
  })
})
