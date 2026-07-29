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

const thread = (id: string, extra: Partial<ThreadMeta> = {}): ThreadMeta => ({
  id,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A thread',
  createdBy: 'Jamel',
  status: 'open',
  ...extra
})

const spawned = (parentThreadId: string): SessionEvent => ({
  id: 'started-1',
  ts: 1,
  kind: 'subagent.started',
  threadId: 'child',
  parentThreadId,
  parentPromptId: 'p1',
  name: 'Scout',
  subject: 'reading the schema',
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  byName: 'Bubbles'
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({ threads: {}, openThreadId: null, events: [] })
})

afterEach(cleanup)

const inThread = (extra: Partial<ThreadMeta> = {}, events: SessionEvent[] = []) =>
  act(() => useCrew.setState({ threads: { t1: thread('t1', extra) }, openThreadId: 't1', events }))

describe('what an empty panel offers', () => {
  it('says everything the panel can hold', () => {
    act(() => useBrowser.getState().togglePanel())
    const { getByText } = render(createElement(BrowserPanel))

    for (const label of ['Web page', 'Terminal', 'Files', 'Music', 'Games']) expect(getByText(label)).not.toBeNull()
  })

  it('opens what is picked', () => {
    act(() => useBrowser.getState().togglePanel())
    const { getByText } = render(createElement(BrowserPanel))

    fireEvent.click(getByText('Terminal'))

    expect(useBrowser.getState().tabs.map(t => t.kind)).toEqual(['terminal'])
  })

  it('stands down the moment there is something to look at', () => {
    act(() => useBrowser.getState().togglePanel())
    const { queryByText } = render(createElement(BrowserPanel))

    act(() => useBrowser.getState().openMusic())

    expect(queryByText('Games')).toBeNull()
  })

  // The thread's own things come and go with the thread you are in. The rest
  // never move, so nothing under the pointer travels as you go between them.
  it('leaves out what the thread you are in does not have', () => {
    act(() => useBrowser.getState().togglePanel())
    const { queryByText } = render(createElement(BrowserPanel))
    inThread()

    expect(queryByText('Plan')).toBeNull()
    expect(queryByText('Board')).toBeNull()
    expect(queryByText('Helpers')).toBeNull()
  })

  it('offers the plan, the board and the helpers of a thread that has them', () => {
    act(() => useBrowser.getState().togglePanel())
    const { getByText } = render(createElement(BrowserPanel))
    inThread({ plan: 'Step one', tickets: true }, [spawned('t1')])
    act(() => useBrowser.getState().closeAll())

    expect(getByText('Plan')).not.toBeNull()
    expect(getByText('Board')).not.toBeNull()
    expect(getByText('Helpers')).not.toBeNull()
  })

  it('opens the helpers of the thread that sent them', () => {
    act(() => useBrowser.getState().togglePanel())
    const { getByText } = render(createElement(BrowserPanel))
    inThread({}, [spawned('t1')])

    fireEvent.click(getByText('Helpers'))

    expect(useBrowser.getState().tabs[0]!.parentThreadId).toBe('t1')
  })
})

describe('the panel itself', () => {
  it('opens on anything put in it', () => {
    act(() => useBrowser.getState().openMusic())

    expect(useBrowser.getState().open).toBe(true)
  })

  // A page that finishes loading behind a panel that was put away is not
  // somebody asking for the panel back.
  it('stays away while a tab it is holding carries on', () => {
    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    const tab = useBrowser.getState().tabs[0]!
    act(() => useBrowser.getState().closePanel())

    act(() => useBrowser.getState().updateTab(tab.id, { title: 'Loaded' }))

    expect(useBrowser.getState().open).toBe(false)
  })

  it('goes with a plan that took itself away', () => {
    render(createElement(BrowserPanel))
    inThread({ plan: 'Step one' })

    expect(useBrowser.getState().open).toBe(true)
    act(() => useCrew.setState({ openThreadId: null }))

    expect(useBrowser.getState().open).toBe(false)
  })

  it('stays standing when a plan leaves something else behind', () => {
    render(createElement(BrowserPanel))
    act(() => useBrowser.getState().openMusic())
    inThread({ plan: 'Step one' })

    act(() => useCrew.setState({ openThreadId: null }))

    expect(useBrowser.getState().open).toBe(true)
    expect(useBrowser.getState().tabs.map(t => t.kind)).toEqual(['music'])
  })
})
