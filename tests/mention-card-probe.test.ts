// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act, createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(cleanup)
import type { SessionEvent } from '../src/shared/events'
import type { PooledAgent } from '../src/shared/llm'

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
Element.prototype.getAnimations ??= () => []
if (typeof globalThis.CSS === 'undefined') {
  ;(globalThis as { CSS?: unknown }).CSS = {}
}
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { default: Chat } = await import('../src/renderer/src/views/Chat')
const { useCrew } = await import('../src/renderer/src/state/store')

const BUBBLES: PooledAgent = {
  id: 'bubbles',
  label: 'Bubbles',
  provider: 'claude',
  ownerId: 'jamel',
  ownerName: 'Jamel',
  status: 'idle',
  runs: {},
  settings: { model: 'claude-opus-5', effort: 'high' },
  fields: [
    { key: 'model', label: 'Model', options: [{ value: 'claude-opus-5', label: 'Opus 5' }], default: 'claude-opus-5' },
    { key: 'effort', label: 'Thinking', options: [{ value: 'high', label: 'High' }], default: 'high' }
  ]
}

const events: SessionEvent[] = [
  {
    id: 'message-1',
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: 'ask @Bubbles about it, @Jamel',
    mentions: ['bubbles'],
    mentionRefs: [{ id: 'bubbles', label: 'Bubbles' }],
    memberMentionRefs: [{ id: 'jamel', name: 'Jamel' }]
  }
]

function boot(activePrompts: Record<string, string[]> = {}, agent: PooledAgent = BUBBLES) {
  useCrew.setState({
    connection: 'online',
    selfId: 'jamel',
    selfName: 'Jamel',
    members: [
      { id: 'jamel', name: 'Jamel', connected: true },
      { id: 'ali', name: 'ALI', connected: true }
    ],
    agents: [agent],
    activePrompts,
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

function hover(label: string): HTMLElement {
  vi.useFakeTimers()
  try {
    fireEvent.mouseEnter(screen.getByText(label).parentElement!)
    act(() => void vi.advanceTimersByTime(400))
  } finally {
    vi.useRealTimers()
  }
  return document.body.querySelector('.glass.fixed') as HTMLElement
}

describe('the card behind an agent mention', () => {
  it('names whose machine it runs on, in their own name', () => {
    boot()
    const card = hover('@Bubbles')
    expect(card).toBeTruthy()
    expect(card.textContent).toContain('Bubbles')
    expect(card.textContent).toContain('Jamel')
    expect(card.textContent).not.toContain('PC')
  })

  it('wears the provider mark rather than writing the key out', () => {
    boot()
    const card = hover('@Bubbles')
    expect(card.textContent).not.toContain('claude')
    expect(card.querySelector('img')).toBeTruthy()
  })

  it('reads the settings back under a rule, label beside value', () => {
    boot()
    const card = hover('@Bubbles')
    expect(card.textContent).toContain('Model')
    expect(card.textContent).toContain('Opus 5')
    expect(card.textContent).toContain('Thinking')
    expect(card.textContent).toContain('High')
  })

  it('shows the overall usage percentage when limits are available', () => {
    boot({}, {
      ...BUBBLES,
      usage: {
        provider: 'claude',
        fetchedAt: Date.now(),
        windows: [
          { key: 'session', label: '5-hour limit', percent: 63 },
          { key: 'weekly', label: 'Weekly limit', percent: 21 }
        ]
      }
    })
    const card = hover('@Bubbles')
    expect(card.textContent).toContain('Usage')
    expect(card.textContent).toContain('63%')
    expect(card.textContent).not.toContain('21%')
  })

  it('leaves usage out when no limit is available', () => {
    boot({}, {
      ...BUBBLES,
      usage: { provider: 'claude', fetchedAt: Date.now(), windows: [], error: 'Unavailable' }
    })
    const card = hover('@Bubbles')
    expect(card.textContent).not.toContain('Usage')
    expect(card.textContent).not.toContain('Unavailable')
  })

  // The one thing the card can say that the chip it stands off cannot.
  it('says it is working while it is on a thread, and how many', () => {
    boot({ bubbles: ['p1', 'p2'] })
    const card = hover('@Bubbles')
    expect(card.textContent).toContain('Working')
    expect(card.textContent).toContain('on 2 threads')
  })

  it('says nothing about a thread count of one', () => {
    boot({ bubbles: ['p1'] })
    const card = hover('@Bubbles')
    expect(card.textContent).toContain('Working')
    expect(card.textContent).not.toContain('threads')
  })

  it('stands down when nothing is running', () => {
    boot()
    const card = hover('@Bubbles')
    expect(card.textContent).not.toContain('Working')
  })

  // Glass lifts with whatever is behind it, so a solid grey on one of these is a
  // line that is not there over a photograph.
  it('sets nothing on the glass in a solid grey', () => {
    boot({ bubbles: ['p1'] })
    const card = hover('@Bubbles')
    for (const el of [card, ...card.querySelectorAll('*')]) {
      const written = el.getAttribute('class') ?? ''
      expect(written).not.toContain('text-fg-muted')
      expect(written).not.toContain('text-fg-secondary')
      expect(written).not.toContain('text-fg-faint')
    }
  })
})

describe('the card behind a member mention', () => {
  it('is as wide as what it holds rather than the agent card width', () => {
    boot()
    const mine = hover('@Jamel')
    expect(mine.style.width).toBe('max-content')
    expect(mine.style.maxWidth).toBe('240px')
    cleanup()

    boot()
    const agent = hover('@Bubbles')
    expect(agent.style.width).toBe('240px')
  })

  it('puts You in a pill beside your own name', () => {
    boot()
    const card = hover('@Jamel')
    expect(card.textContent).toContain('Jamel')
    expect(card.textContent).toContain('You')
  })

  it('says nothing of the sort about somebody else', () => {
    boot()
    const card = hover('@Bubbles')
    expect(card.textContent).not.toContain('You')
  })
})
