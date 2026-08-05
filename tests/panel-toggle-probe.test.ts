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
const dot = () => document.querySelector('[aria-label="Show panel"] .bg-fg')
const kinds = () => useBrowser.getState().tabs.map(tab => tab.kind)
const activeKind = () => useBrowser.getState().tabs.find(t => t.id === useBrowser.getState().activeTabId)?.kind

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  window.crew = { warmTerminal: () => undefined } as unknown as CrewBridge
  useBrowser.setState({ open: false, tabs: [], activeTabId: null, closedPlans: [], closedBoards: [] })
  useCrew.setState({ threads: {}, openThreadId: null, openThreadIds: [], events: [] })
})

afterEach(cleanup)

describe('the way back into the panel', () => {
  it('is not there with nothing in the panel and nothing in the thread', () => {
    view()
    inThread()

    expect(button()).toBeNull()
  })

  it('stands with no dot for what the panel holds of its own', () => {
    view()
    inThread()
    act(() => useBrowser.getState().openUrl('https://example.com/one'))
    act(() => useBrowser.getState().closePanel())

    expect(button()).not.toBeNull()
    expect(dot()).toBeNull()
  })

  it('wears a dot for a thread with a plan, and leaves the panel where it was', () => {
    view()
    inThread({ plan: 'Step one' })

    expect(useBrowser.getState().open).toBe(false)
    expect(button()).not.toBeNull()
    expect(dot()).not.toBeNull()
  })

  it('wears one for a thread that has sent helpers, with nothing in the panel at all', () => {
    view()
    inThread({}, [spawned()])

    expect(useBrowser.getState().tabs).toEqual([])
    expect(button()).not.toBeNull()
    expect(dot()).not.toBeNull()
  })

  it('puts the thread own things in and stands the plan up', () => {
    view()
    inThread({ plan: 'Step one', tickets: true }, [spawned()])

    fireEvent.click(button()!)

    expect(useBrowser.getState().open).toBe(true)
    expect(kinds()).toEqual(['plan', 'work', 'agent'])
    expect(activeKind()).toBe('plan')
    expect(button()).toBeNull()
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
