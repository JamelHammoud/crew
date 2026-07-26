// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
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

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const events: SessionEvent[] = [
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: 'ping @Jamel and @Bubbles, not @ALI',
    mentions: ['bubbles'],
    mentionRefs: [{ id: 'bubbles', label: 'Bubbles' }],
    memberMentionRefs: [{ id: 'jamel', name: 'Jamel' }]
  }
]

function boot(selfId: string) {
  useCrew.setState({
    connection: 'online',
    selfId,
    selfName: selfId === 'jamel' ? 'Jamel' : 'ALI',
    members: [
      { id: 'jamel', name: 'Jamel', connected: true },
      { id: 'ali', name: 'ALI', connected: true }
    ],
    agents: [
      {
        id: 'bubbles',
        label: 'Bubbles',
        provider: 'claude',
        status: 'idle',
        ownerId: 'jamel',
        ownerName: 'Jamel',
        runs: {},
        settings: {},
        fields: []
      }
    ],
    events,
    docs: { main: { title: 'Main', text: '' } },
    boards: [],
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
    designTarget: null
  })
  render(createElement(Chat))
}

describe('a mention of you', () => {
  it('tints your own chip and leaves the rest plain', () => {
    boot('jamel')
    expect(screen.getByText('@Jamel').className).toContain('text-attention')
    expect(screen.getByText('@ALI').className).toContain('text-fg')
    expect(screen.getByText('@ALI').className).not.toContain('attention')
    expect(screen.getByText('@Bubbles').className).not.toContain('attention')
  })

  it('leaves the chip plain for everyone else reading it', () => {
    boot('ali')
    expect(screen.getByText('@Jamel').className).not.toContain('attention')
    expect(screen.getByText('@ALI').className).toContain('text-attention')
  })
})
