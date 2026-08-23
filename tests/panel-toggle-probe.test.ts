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
const ThreadWindow = (await import('../src/renderer/src/views/ThreadWindow')).default

const THREAD = 'a-thread'
const HELPER = 'a-helper'

const thread = (extra: Partial<ThreadMeta> = {}): ThreadMeta => ({
  id: THREAD,
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  title: 'A thread',
  createdBy: 'Jamel',
  status: 'open',
  mode: 'build',
  ...extra
})

const spawned = (): SessionEvent => ({
  id: 'started-1',
  ts: 1000,
  kind: 'subagent.started',
  threadId: HELPER,
  parentThreadId: THREAD,
  parentPromptId: 'p1',
  name: 'Scout',
  subject: 'reading the schema',
  agentId: 'agent-1',
  agentLabel: 'Bubbles',
  byName: 'Bubbles'
})

const view = () => render(createElement('div', null, createElement(PanelToggle), createElement(BrowserPanel)))

const inThread = (extra: Partial<ThreadMeta> = {}, events: SessionEvent[] = []) =>
  act(() =>
    useCrew.setState({
      threads: { [THREAD]: thread(extra) },
      openThreadId: THREAD,
      openThreadIds: [THREAD],
      events
    })
  )

const button = () => document.querySelector('[aria-label="Show panel"]')
const standing = () => {
  const found = button()
  return !!found && !found.closest('[aria-hidden="true"]')
}
const dot = () => document.querySelector('[aria-label="Show panel"] .bg-fg')
const mark = () => document.querySelector('[aria-label="Show panel"] svg')
const kinds = () => useBrowser.getState().tabs.map(tab => tab.kind)
const activeKind = () => useBrowser.getState().tabs.find(t => t.id === useBrowser.getState().activeTabId)?.kind

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({ threads: {}, openThreadId: null, openThreadIds: [], events: [] })
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the way back into the panel', () => {
  it('does not stand with nothing in the panel and nothing in the thread', () => {
    view()
    inThread()

    expect(standing()).toBe(false)
  })

  it('always stands in a thread window, even when the thread has nothing for the panel', () => {
    window.history.replaceState(null, '', `#thread=${THREAD}`)
    act(() => useCrew.setState({ connection: 'online', threads: {}, events: [] }))
    render(createElement(ThreadWindow))

    expect(standing()).toBe(true)
    expect(button()!.getAttribute('tabindex')).toBeNull()
    expect(button()!.closest('.justify-end')).not.toBeNull()

    fireEvent.click(button()!)
    expect(useBrowser.getState().open).toBe(true)
  })

  // It is never taken out of the tree, so it has somewhere to travel from and
  // somewhere to travel to. Unmounted it can only appear, and a control that
  // appears in a row pushes everything beside it without saying why.
  it('stays in the tree while it is away, so it can come and go', () => {
    view()
    inThread()

    expect(button()).not.toBeNull()
    expect(button()!.getAttribute('tabindex')).toBe('-1')
  })

  it('stands with no dot for what the panel holds of its own', () => {
    view()
    inThread()
    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    act(() => useBrowser.getState().closePanel())

    expect(standing()).toBe(true)
    expect(button()!.getAttribute('tabindex')).toBeNull()
    expect(dot()).toBeNull()
  })

  it('wears a dot for a thread with a plan, and leaves the panel where it was', () => {
    view()
    inThread({ plan: 'Step one' })

    expect(useBrowser.getState().open).toBe(false)
    expect(standing()).toBe(true)
    expect(dot()).not.toBeNull()
  })

  // The dot is about the mark rather than about the button's own corner, which
  // is a hit area with nothing drawn in it. Hung off the button it stood a badge
  // clear of the mark with a gap between the two.
  it('hangs the dot off the mark rather than off the button', () => {
    view()
    inThread({ plan: 'Step one' })

    const hung = dot()!.parentElement!
    expect(hung.contains(mark()!)).toBe(true)
    expect(hung.className).toContain('relative')
  })

  it('wears one for a thread that has sent helpers, with nothing in the panel at all', () => {
    view()
    inThread({}, [spawned()])

    expect(useBrowser.getState().tabs).toEqual([])
    expect(standing()).toBe(true)
    expect(dot()).not.toBeNull()
  })

  it('puts the thread own things in and stands the plan up', () => {
    view()
    inThread({ plan: 'Step one', tickets: true }, [spawned()])

    fireEvent.click(button()!)

    expect(useBrowser.getState().open).toBe(true)
    expect(kinds()).toEqual(['plan', 'work', 'agent'])
    expect(activeKind()).toBe('plan')
    expect(standing()).toBe(false)
  })

  it('holds the helpers it put in beside what was already there', () => {
    view()
    inThread({}, [spawned()])
    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    act(() => useBrowser.getState().closePanel())

    fireEvent.click(button()!)

    expect(kinds()).toEqual(['web', 'agent'])
    expect(useBrowser.getState().tabs.find(t => t.kind === 'agent')!.parentThreadId).toBe(THREAD)
  })
})
