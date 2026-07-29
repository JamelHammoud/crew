// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const thread = (id: string, plan?: string): ThreadMeta => ({
  id,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A thread',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'plan',
  plan
})

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ tabs: [], activeTabId: null, closedPlans: [] })
  useCrew.setState({ threads: {}, openThreadId: null })
})

afterEach(cleanup)

const open = (id: string, plan?: string) =>
  act(() => useCrew.setState({ threads: { [id]: thread(id, plan) }, openThreadId: id }))

const planTab = () => useBrowser.getState().tabs.find(t => t.kind === 'plan') ?? null

describe('the plan in the browser', () => {
  it('stands at the head of the row for the thread you are in', () => {
    useBrowser.getState().openUrl('https://example.com/one')
    const { container } = render(createElement(BrowserPanel))

    open('t1', 'Step one')

    const tab = planTab()!
    expect(useBrowser.getState().tabs[0]!.id).toBe(tab.id)
    expect(useBrowser.getState().activeTabId).toBe(tab.id)
    expect(container.querySelector(`[data-tab="${tab.id}"]`)?.textContent).toContain('Plan')
    expect(container.textContent).toContain('Step one')
  })

  it('goes when you leave the thread', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')

    act(() => useCrew.setState({ openThreadId: null }))

    expect(planTab()).toBeNull()
    expect(useBrowser.getState().activeTabId).toBeNull()
  })

  it('never stands for a thread with no plan', () => {
    render(createElement(BrowserPanel))

    open('t1')

    expect(planTab()).toBeNull()
  })

  it('takes the place of the plan before it', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')

    act(() => useCrew.setState({ threads: { t2: thread('t2', 'Something else') }, openThreadId: 't2' }))

    expect(useBrowser.getState().tabs.filter(t => t.kind === 'plan')).toHaveLength(1)
    expect(planTab()!.threadId).toBe('t2')
  })

  it('closes the way any other tab does', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')

    act(() => useBrowser.getState().closeTab(planTab()!.id))

    expect(planTab()).toBeNull()
    expect(useBrowser.getState().activeTabId).toBeNull()
  })

  it('offers the menu every tab has', () => {
    const { container, queryByText } = render(createElement(BrowserPanel))
    open('t1', 'Step one')

    fireEvent.contextMenu(container.querySelector(`[data-tab="${planTab()!.id}"]`)!)

    expect(queryByText('Close tab')).not.toBeNull()
  })

  it('goes with the rest of the tabs', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')
    act(() => useBrowser.getState().openUrl('https://example.com/one'))

    act(() => useBrowser.getState().closeAll())

    expect(useBrowser.getState().tabs).toEqual([])
    expect(useBrowser.getState().activeTabId).toBeNull()
  })

  it('stands with a close of its own while it is the only thing there', () => {
    const { queryByLabelText } = render(createElement(BrowserPanel))
    open('t1', 'Step one')

    expect(queryByLabelText('Close')).not.toBeNull()
  })

  it('stays away until it is asked for again', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')

    act(() => useBrowser.getState().closePlan())
    act(() => useCrew.setState({ openThreadId: null }))
    open('t1', 'Step one')

    expect(planTab()).toBeNull()

    act(() => useBrowser.getState().showPlan('t1'))

    expect(planTab()!.threadId).toBe('t1')
    expect(useBrowser.getState().closedPlans).toEqual([])
  })

  it('comes up for another thread that has one of its own', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')
    act(() => useBrowser.getState().closePlan())

    act(() => useCrew.setState({ threads: { t2: thread('t2', 'Something else') }, openThreadId: 't2' }))

    expect(planTab()!.threadId).toBe('t2')
  })

  it('leaves no plan standing for a thread whose plan was put away', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')
    act(() => useBrowser.getState().closePlan())
    act(() => useCrew.setState({ threads: { t2: thread('t2', 'Something else') }, openThreadId: 't2' }))

    act(() =>
      useCrew.setState({ threads: { t1: thread('t1', 'Step one'), t2: thread('t2', 'x') }, openThreadId: 't1' })
    )

    expect(planTab()).toBeNull()
  })
})

describe('the way back to the panel', () => {
  const view = (id: string) =>
    render(createElement('div', null, createElement(ThreadView, { threadId: id }), createElement(BrowserPanel)))

  it('stands in every thread, whatever the thread has', () => {
    open('t1')
    const { queryByLabelText } = view('t1')

    expect(queryByLabelText('Show panel')).not.toBeNull()
  })

  it('puts the panel away and keeps what is in it', () => {
    open('t1', 'Step one')
    const { getByLabelText } = view('t1')

    expect(useBrowser.getState().open).toBe(true)
    fireEvent.click(getByLabelText('Hide panel'))

    expect(useBrowser.getState().open).toBe(false)
    expect(planTab()!.threadId).toBe('t1')

    fireEvent.click(getByLabelText('Show panel'))

    expect(useBrowser.getState().open).toBe(true)
    expect(planTab()!.threadId).toBe('t1')
  })

  it('opens on the rows an empty panel offers', () => {
    open('t1', 'Step one')
    const { getByLabelText, getByText } = view('t1')
    act(() => useBrowser.getState().closeAll())

    fireEvent.click(getByLabelText('Show panel'))
    fireEvent.click(getByText('Plan'))

    expect(planTab()!.threadId).toBe('t1')
  })
})
