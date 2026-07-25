// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

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

const messages: SessionEvent[] = Array.from({ length: 8 }, (_, i) => ({
  id: `m${i}`,
  ts: 1_700_000_000_000 + i * 1000,
  kind: 'message',
  authorId: 'jamel',
  authorName: 'Jamel',
  text: `message ${i}`,
  mentions: []
}))

function boot() {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [{ id: 'jamel', name: 'Jamel', connected: true }],
    agents: [],
    events: messages,
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
    docsTarget: null
  })
  const view = render(createElement(Chat))
  const feed = view.container.querySelector('.overflow-y-auto') as HTMLElement
  const fade = () => view.container.querySelector('.bottom-0 > .bg-gradient-to-t') as HTMLElement
  return { view, feed, fade }
}

describe('chat scroll position', () => {
  it('comes back to where the reader left off', () => {
    const first = boot()
    first.feed.scrollTop = 300
    fireEvent.scroll(first.feed)
    first.view.unmount()

    const second = boot()
    expect(second.feed.scrollTop).toBe(300)
  })

  it('returns to the bottom when the reader was already there', () => {
    const first = boot()
    first.feed.scrollTop = 300
    fireEvent.scroll(first.feed)
    first.feed.scrollTop = scrollHeight - clientHeight
    fireEvent.scroll(first.feed)
    first.view.unmount()

    scrollHeight = 3000
    const second = boot()
    expect(second.feed.scrollTop).toBe(3000)
    scrollHeight = 2000
  })

  it('fades the messages above the composer only while there is more below', () => {
    const { feed, fade } = boot()
    feed.scrollTop = 300
    fireEvent.scroll(feed)
    expect(fade().className).toContain('opacity-100')

    feed.scrollTop = scrollHeight - clientHeight
    fireEvent.scroll(feed)
    expect(fade().className).toContain('opacity-0')
  })
})
