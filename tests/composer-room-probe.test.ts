// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

afterEach(cleanup)

const watchers = new Map<Element, (() => void)[]>()

class TestResizeObserver {
  private readonly cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(el: Element): void {
    const fire = () => this.cb([], this as unknown as ResizeObserver)
    watchers.set(el, [...(watchers.get(el) ?? []), fire])
  }
  unobserve(el: Element): void {
    watchers.delete(el)
  }
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
if (!Element.prototype.getAnimations) Element.prototype.getAnimations = () => []
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => new DOMRect()
if (typeof globalThis.CSS === 'undefined') (globalThis as { CSS?: unknown }).CSS = {}

const heights = new WeakMap<HTMLElement, number>()
const tops = new WeakMap<HTMLElement, number>()
const CLIENT_HEIGHT = 500
let scrollHeight = 2000

Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return heights.get(this) ?? 0
  }
})
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight })
Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => CLIENT_HEIGHT })
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
const { default: ThreadView } = await import('../src/renderer/src/views/ThreadView')
const { useCrew } = await import('../src/renderer/src/state/store')

const agent: PooledAgent = {
  id: 'ali/claude',
  label: 'Claude',
  provider: 'claude',
  ownerId: 'ali',
  ownerName: 'ALI',
  status: 'idle',
  runs: {},
  settings: {},
  fields: []
}

const messages: SessionEvent[] = Array.from({ length: 6 }, (_, i) => ({
  id: `m${i}`,
  ts: 1_700_000_000_000 + i * 1000,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: `message ${i}`,
  mentions: []
}))

const threadEvents: SessionEvent[] = [
  {
    id: 'thread-start',
    ts: 1,
    kind: 'thread.started',
    threadId: 'thread-1',
    agentId: agent.id,
    agentLabel: agent.label,
    title: '@Claude look at the icons',
    byName: 'ALI'
  },
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: '@Claude look at the icons',
    mentions: [agent.id],
    threadId: 'thread-1'
  }
]

function state(over: Record<string, unknown>) {
  useCrew.setState({
    place: 'project:one',
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [agent],
    events: messages,
    docs: {},
    threads: {},
    threadPrompts: {},
    threadDrafts: {},
    chatDraft: '',
    chatCommands: [],
    queues: {},
    steps: {},
    tokens: {},
    costs: {},
    pending: {},
    openThreadIds: [],
    openThreadId: null,
    docsTarget: null,
    ...over
  })
}

function bootChat() {
  state({})
  const view = render(createElement(Chat))
  const scroller = view.container.querySelector('.overflow-y-auto') as HTMLElement
  return {
    content: scroller.firstElementChild as HTMLElement,
    overlay: scroller.nextElementSibling as HTMLElement,
    scroller
  }
}

function bootThread() {
  state({
    events: threadEvents,
    threads: {
      'thread-1': {
        id: 'thread-1',
        agentId: agent.id,
        agentLabel: agent.label,
        title: '@Claude look at the icons',
        createdBy: 'ALI',
        status: 'open',
        mode: 'build'
      }
    },
    openThreadIds: ['thread-1'],
    openThreadId: 'thread-1'
  })
  const view = render(createElement(ThreadView, { threadId: 'thread-1' }))
  const scroller = view.container.querySelector('.overflow-y-auto') as HTMLElement
  return {
    content: scroller.firstElementChild as HTMLElement,
    overlay: scroller.nextElementSibling as HTMLElement,
    scroller
  }
}

const grow = (el: HTMLElement, height: number) => {
  heights.set(el, height)
  act(() => {
    for (const fire of watchers.get(el) ?? []) fire()
  })
}

const room = (content: HTMLElement) => parseFloat(content.style.paddingBottom)

describe('the room the composer takes', () => {
  it('is read off the composer rather than written down, in the chat', () => {
    const { content, overlay } = bootChat()
    grow(overlay, 420)

    expect(room(content)).toBe(404)
  })

  it('is read off the composer in a thread, header and all', () => {
    const { content, overlay } = bootThread()
    grow(overlay, 380)

    expect(room(content)).toBe(364)
  })

  it('grows with a composer that grows, so nothing is left behind it', () => {
    const { content, overlay } = bootChat()
    grow(overlay, 220)
    const rest = room(content)
    grow(overlay, 500)

    expect(room(content)).toBeGreaterThan(rest)
    expect(room(content)).toBe(484)
  })

  it('never falls under the air a short composer still leaves', () => {
    const { content, overlay } = bootChat()
    grow(overlay, 40)

    expect(room(content)).toBe(120)
  })

  it('carries the reader with it, so the last thing said stays on screen', () => {
    const { content, overlay, scroller } = bootChat()
    scroller.scrollTop = scrollHeight - CLIENT_HEIGHT
    scrollHeight = 2400
    grow(overlay, 500)

    expect(room(content)).toBe(484)
    expect(scroller.scrollTop).toBe(2400)
    scrollHeight = 2000
  })
})
