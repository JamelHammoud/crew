// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThreadMeta } from '../src/renderer/src/state/store'

const { useBrowser } = await import('../src/renderer/src/state/browser')
const { useCrew } = await import('../src/renderer/src/state/store')
const BrowserPanel = (await import('../src/renderer/src/components/BrowserPanel')).default

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
  useBrowser.setState({ tabs: [], activeTabId: null })
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

  it('carries no close of its own', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')
    const tab = planTab()!

    act(() => useBrowser.getState().closeTab(tab.id))

    expect(planTab()?.id).toBe(tab.id)
  })

  it('offers no menu to close it with', () => {
    const { container, queryByText } = render(createElement(BrowserPanel))
    open('t1', 'Step one')

    fireEvent.contextMenu(container.querySelector(`[data-tab="${planTab()!.id}"]`)!)

    expect(queryByText('Close tab')).toBeNull()
  })

  it('stays standing when the rest of the tabs are closed', () => {
    render(createElement(BrowserPanel))
    open('t1', 'Step one')
    act(() => useBrowser.getState().openUrl('https://example.com/one'))

    act(() => useBrowser.getState().closeAll())

    const tabs = useBrowser.getState().tabs
    expect(tabs.map(t => t.kind)).toEqual(['plan'])
    expect(useBrowser.getState().activeTabId).toBe(tabs[0]!.id)
  })

  it('leaves nothing to close while it is the only thing there', () => {
    const { queryByLabelText } = render(createElement(BrowserPanel))
    open('t1', 'Step one')

    expect(queryByLabelText('Close')).toBeNull()

    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    expect(queryByLabelText('Close')).not.toBeNull()
  })
})
