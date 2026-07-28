// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)
import type { SessionEvent } from '../src/shared/events'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})) as typeof window.matchMedia
Element.prototype.scrollIntoView = () => {}
if (typeof globalThis.CSS === 'undefined') {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}

const tops = new WeakMap<HTMLElement, number>()
let scrollHeight = 2000
const clientHeight = 500

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight })
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => clientHeight })
Object.defineProperty(HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get(this: HTMLElement) {
    return tops.get(this) ?? 0
  },
  set(this: HTMLElement, value: number) {
    tops.set(this, value)
  }
})

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const said = (n: number): SessionEvent => ({
  id: `m${n}`,
  ts: 1_700_000_000_000 + n * 1000,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: `message ${n}`,
  mentions: []
})

const recent = Array.from({ length: 8 }, (_, i) => said(100 + i))

function boot(over: Record<string, unknown> = {}) {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events: recent,
    eventLimit: 500,
    moreHistory: true,
    loadingHistory: false,
    loadHistory: () => {},
    docs: { main: { title: 'Main', text: '' } },
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    queues: {},
    steps: {},
    tokens: {},
    pending: {},
    openThreadId: null,
    docsTarget: null,
    ...over
  })
  const view = render(createElement(Chat))
  const feed = view.container.querySelector('.overflow-y-auto') as HTMLElement
  const spinner = () => view.container.querySelector('[role="status"]')
  return { view, feed, spinner }
}

describe('reaching back through the chat', () => {
  it('asks for older messages when the reader comes up on the top', () => {
    const loadHistory = vi.fn()
    const { feed } = boot({ loadHistory })

    feed.scrollTop = 1200
    fireEvent.scroll(feed)
    expect(loadHistory).not.toHaveBeenCalled()

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    expect(loadHistory).toHaveBeenCalledTimes(1)
  })

  it('asks nobody when there is nothing older to read', () => {
    const loadHistory = vi.fn()
    const { feed, spinner } = boot({ loadHistory, moreHistory: false })

    feed.scrollTop = 0
    fireEvent.scroll(feed)
    expect(loadHistory).not.toHaveBeenCalled()
    expect(spinner()).toBeNull()
  })

  it('says it is working while the page is on its way', () => {
    const { spinner, view } = boot()
    expect(spinner()).toBeNull()

    act(() => useCrew.setState({ loadingHistory: true }))
    expect(spinner()).not.toBeNull()

    act(() => useCrew.setState({ loadingHistory: false }))
    expect(spinner()).toBeNull()
    view.unmount()
  })

  it('leaves the reader on the line they were reading', () => {
    const { feed } = boot()

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    act(() => useCrew.setState({ loadingHistory: true }))

    scrollHeight = 3000
    act(() => useCrew.setState({ events: [...Array.from({ length: 6 }, (_, i) => said(i)), ...recent] }))
    act(() => useCrew.setState({ loadingHistory: false }))
    expect(feed.scrollTop).toBe(1100)
    scrollHeight = 2000
  })

  it('reaches back again when a page had nothing this screen draws', () => {
    const loadHistory = vi.fn()
    const { feed } = boot({ loadHistory })

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    act(() => useCrew.setState({ loadingHistory: true }))
    act(() => useCrew.setState({ loadingHistory: false }))

    expect(loadHistory).toHaveBeenCalledTimes(2)
    expect(feed.scrollTop).toBe(100)
  })
})

describe('a page of history landing in the store', () => {
  const thread = (n: number): SessionEvent => ({
    id: `t${n}`,
    ts: 1_700_000_000_000 + n * 1000,
    kind: 'thread.started',
    threadId: `thread-${n}`,
    agentId: 'ag',
    agentLabel: 'Agent',
    title: `thread ${n}`,
    byName: 'Jamel'
  })

  it('puts what arrived above what was held, and never twice', () => {
    boot({ events: [said(5), said(6)] })
    act(() => useCrew.setState({ loadingHistory: true }))
    act(() =>
      useCrew.getState().$handle({ type: 'history', events: [said(3), said(4), said(5)], more: true })
    )

    const { events, loadingHistory, moreHistory } = useCrew.getState()
    expect(events.map(e => e.id)).toEqual(['m3', 'm4', 'm5', 'm6'])
    expect(loadingHistory).toBe(false)
    expect(moreHistory).toBe(true)
  })

  it('brings the threads it names with it, and keeps them out of the trim', () => {
    boot({ events: [said(9)], eventLimit: 2, threads: {} })
    act(() => useCrew.getState().$handle({ type: 'history', events: [thread(1), said(2)], more: false }))

    expect(useCrew.getState().threads['thread-1']?.title).toBe('thread 1')
    act(() => useCrew.getState().$handle({ type: 'event', event: said(10) }))
    expect(useCrew.getState().events.map(e => e.id)).toEqual(['t1', 'm2', 'm9', 'm10'])
    expect(useCrew.getState().moreHistory).toBe(false)
  })

  it('lets a thread archived since stay archived', () => {
    boot({ events: [{ ...thread(1), kind: 'thread.archived', id: 'a1', ts: 2 } as SessionEvent], threads: {} })
    act(() => useCrew.getState().$handle({ type: 'history', events: [thread(1)], more: false }))

    expect(useCrew.getState().threads['thread-1']?.status).toBe('archived')
  })
})
