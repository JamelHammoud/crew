// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

afterEach(cleanup)
import type { SessionEvent } from '../src/shared/events'
import type { ClientMessage, ServerMessage, SessionSnapshot } from '../src/shared/protocol'
import { installLocalStorage } from './helpers/local-storage'

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
installLocalStorage().setItem('crew.sound', 'off')

class FakeSocket {
  static last: FakeSocket | null = null
  static readonly OPEN = 1
  readyState = 1
  sent: ClientMessage[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.last = this
  }

  send(raw: string): void {
    this.sent.push(JSON.parse(raw))
  }

  close(): void {
    this.readyState = 3
  }
}

globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket

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

const started = (n: number): SessionEvent => ({
  id: `t${n}`,
  ts: 1_700_000_000_000 + n * 1000,
  kind: 'thread.started',
  threadId: `thread-${n}`,
  agentId: 'ag',
  agentLabel: 'Agent',
  title: `thread ${n}`,
  byName: 'Jamel'
})

const archived = (n: number): SessionEvent => ({
  id: `a${n}`,
  ts: 1_700_000_500_000,
  kind: 'thread.archived',
  threadId: `thread-${n}`,
  byName: 'Jamel'
})

const snapshot = (events: SessionEvent[], moreEvents: boolean): SessionSnapshot => ({
  code: 'abc123',
  members: [{ id: 'jamel', name: 'Jamel', connected: true }],
  agents: [],
  events,
  docs: {},
  queues: {},
  todos: [],
  moreEvents
})

const deliver = (msg: ServerMessage) => act(() => FakeSocket.last?.onmessage?.({ data: JSON.stringify(msg) }))

const asked = (): ClientMessage[] => (FakeSocket.last?.sent ?? []).filter(m => m.type === 'history')

const held = (): string[] => useCrew.getState().events.map(e => e.id)

function join(events: SessionEvent[], moreEvents = true) {
  useCrew.getState().connect({
    wsUrl: 'ws://127.0.0.1:7777/ws',
    name: 'Jamel',
    code: 'abc123',
    link: null,
    folder: '/tmp/crew',
    home: 'project',
    shared: false,
    synced: false,
    hosting: true
  })
  act(() => FakeSocket.last?.onopen?.())
  FakeSocket.last!.sent = []
  deliver({ type: 'welcome', selfId: 'jamel', snapshot: snapshot(events, moreEvents) })
}

function open(events: SessionEvent[], moreEvents = true) {
  join(events, moreEvents)
  const view = render(createElement(Chat))
  const feed = view.container.querySelector('.overflow-y-auto') as HTMLElement
  const spinner = () => view.container.querySelector('[role="status"]')
  return { view, feed, spinner }
}

const recent = Array.from({ length: 8 }, (_, i) => said(100 + i))

describe('reaching back through the chat', () => {
  beforeEach(() => {
    scrollHeight = 2000
  })

  it('asks for older messages when the reader comes up on the top', () => {
    const { feed } = open(recent)

    feed.scrollTop = 1200
    fireEvent.scroll(feed)
    expect(asked()).toHaveLength(0)

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    expect(asked()).toEqual([{ type: 'history', before: 'm100' }])
  })

  it('asks once while a page is on its way', () => {
    const { feed } = open(recent)

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    feed.scrollTop = 60
    fireEvent.scroll(feed)
    expect(asked()).toHaveLength(1)
  })

  it('asks nobody when there is nothing older to read', () => {
    const { feed, spinner } = open(recent, false)

    feed.scrollTop = 0
    fireEvent.scroll(feed)
    expect(asked()).toHaveLength(0)
    expect(spinner()).toBeNull()
  })

  it('says it is working while the page is on its way', () => {
    const { feed, spinner } = open(recent)
    expect(spinner()).toBeNull()

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    expect(spinner()).not.toBeNull()

    deliver({ type: 'history', events: [said(98), said(99)], more: false })
    expect(spinner()).toBeNull()
  })

  it('leaves the reader on the line they were reading', () => {
    const { feed } = open(recent)

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    scrollHeight = 3000
    deliver({ type: 'history', events: [said(98), said(99)], more: true })

    expect(feed.scrollTop).toBe(1100)
    expect(held()).toEqual(['m98', 'm99', ...recent.map(e => e.id)])
  })

  it('reaches back again when a page held nothing this screen draws', () => {
    const { feed } = open(recent)

    feed.scrollTop = 100
    fireEvent.scroll(feed)
    deliver({ type: 'history', events: [started(1), archived(1)], more: true })

    expect(asked()).toEqual([
      { type: 'history', before: 'm100' },
      { type: 'history', before: 't1' }
    ])
    expect(feed.scrollTop).toBe(100)
  })
})

describe('a page of history landing in the chat', () => {
  beforeEach(() => {
    scrollHeight = 2000
  })

  it('never holds the same message twice', () => {
    open(recent)
    deliver({ type: 'history', events: [said(99), said(100)], more: true })
    expect(held()).toEqual(['m99', ...recent.map(e => e.id)])
  })

  it('keeps what was read back when the next message lands', () => {
    open(recent)
    deliver({ type: 'history', events: [said(98), said(99)], more: false })
    deliver({ type: 'event', event: said(200) })

    expect(held()).toEqual(['m98', 'm99', ...recent.map(e => e.id), 'm200'])
    expect(useCrew.getState().moreHistory).toBe(false)
  })

  it('brings the threads it names with it', () => {
    open(recent)
    deliver({ type: 'history', events: [started(1)], more: false })

    expect(useCrew.getState().threads['thread-1']?.title).toBe('thread 1')
  })

  it('leaves a thread archived since it was started archived', () => {
    open([archived(1), ...recent])
    deliver({ type: 'history', events: [started(1)], more: false })

    expect(useCrew.getState().threads['thread-1']?.status).toBe('archived')
  })
})
