// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Chat from '../src/renderer/src/views/Chat'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep, PooledAgent } from '../src/shared/llm'
import { NO_UPDATE } from '../src/shared/update'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
Element.prototype.getAnimations ??= () => []
landed()

const drawn = vi.hoisted(() => ({ cards: 0, messages: 0, huddles: 0 }))

vi.mock('../src/renderer/src/components/ThreadCard', async () => {
  const { createElement } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/ThreadCard')>(
    '../src/renderer/src/components/ThreadCard'
  )
  const real = actual.default
  return {
    ...actual,
    default: (props: Parameters<typeof real>[0]) => {
      drawn.cards += 1
      return createElement(real, props)
    }
  }
})

vi.mock('../src/renderer/src/components/ChatMessage', async () => {
  const { createElement } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/ChatMessage')>(
    '../src/renderer/src/components/ChatMessage'
  )
  const real = actual.default
  return {
    ...actual,
    default: (props: Parameters<typeof real>[0]) => {
      drawn.messages += 1
      return createElement(real, props)
    }
  }
})

vi.mock('../src/renderer/src/components/huddle/HuddleCard', async () => {
  const { createElement } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/huddle/HuddleCard')>(
    '../src/renderer/src/components/huddle/HuddleCard'
  )
  const real = actual.default
  return {
    ...actual,
    default: (props: Parameters<typeof real>[0]) => {
      drawn.huddles += 1
      return createElement(real, props)
    }
  }
})

const AGENT: PooledAgent = {
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

const CARDS = 40
const MESSAGES = 60
const HUDDLES = 4
const LIVE = 'thread-7'
const PROMPT = 'prompt-live'

const threadId = (index: number): string => `thread-${index}`

const cardEvents: SessionEvent[] = Array.from({ length: CARDS }, (_, index) => ({
  id: `start-${index}`,
  ts: 1000 + index,
  kind: 'thread.started',
  threadId: threadId(index),
  agentId: AGENT.id,
  agentLabel: AGENT.label,
  title: `@Claude do the ${index}th piece`,
  byName: 'ALI'
}))

const messageEvents: SessionEvent[] = Array.from({ length: MESSAGES }, (_, index) => ({
  id: `msg-${index}`,
  ts: 2000 + index,
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text: `something somebody said, number ${index}`,
  mentions: []
}))

const huddleEvents: SessionEvent[] = Array.from({ length: HUDDLES }, (_, index) => [
  {
    id: `huddle-start-${index}`,
    ts: 3000 + index * 2,
    kind: 'huddle.started' as const,
    huddleId: `huddle-${index}`,
    byId: 'ali',
    byName: 'ALI'
  },
  {
    id: `huddle-end-${index}`,
    ts: 3001 + index * 2,
    kind: 'huddle.ended' as const,
    huddleId: `huddle-${index}`,
    ms: 60000
  }
]).flat()

const runEvents: SessionEvent[] = [
  {
    id: 'run-live',
    ts: 4000,
    kind: 'agent.start',
    threadId: LIVE,
    promptId: PROMPT,
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    promptText: 'do the 7th piece',
    byName: 'ALI'
  }
]

const endEvents: SessionEvent[] = Array.from({ length: CARDS }, (_, index) =>
  threadId(index) === LIVE
    ? []
    : [
        {
          id: `run-${index}`,
          ts: 5000 + index * 2,
          kind: 'agent.start' as const,
          threadId: threadId(index),
          promptId: `prompt-${index}`,
          agentId: AGENT.id,
          agentLabel: AGENT.label,
          promptText: 'go',
          byName: 'ALI'
        },
        {
          id: `end-${index}`,
          ts: 5001 + index * 2,
          kind: 'agent.end' as const,
          threadId: threadId(index),
          promptId: `prompt-${index}`,
          agentId: AGENT.id,
          agentLabel: AGENT.label,
          ok: true,
          text: `the ${index}th piece is done`
        }
      ]
).flat()

const events: SessionEvent[] = [...cardEvents, ...messageEvents, ...huddleEvents, ...runEvents, ...endEvents]

const threads = Object.fromEntries(
  Array.from({ length: CARDS }, (_, index) => [
    threadId(index),
    {
      id: threadId(index),
      agentId: AGENT.id,
      agentLabel: AGENT.label,
      title: `@Claude do the ${index}th piece`,
      createdBy: 'ALI',
      status: 'open' as const,
      mode: 'build' as const
    }
  ])
)

const stepAt = (index: number): AgentStep => ({
  id: `step-${index}`,
  ts: 6000 + index,
  kind: 'tool',
  status: 'done',
  name: index % 2 === 0 ? 'Read' : 'Bash',
  detail: `step number ${index}`
})

const STEPS = 30

const seed = (steps: AgentStep[]) => ({
  connection: 'online' as const,
  place: 'project:here',
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [AGENT],
  events,
  threads,
  openThreadIds: [],
  openThreadId: null,
  threadPrompts: { [LIVE]: PROMPT },
  threadDrafts: {},
  threadCommands: {},
  chatDraft: '',
  chatCommands: [],
  queues: {},
  steps: { [PROMPT]: steps },
  tokens: {},
  costs: {},
  pending: {},
  moreHistory: false,
  loadingHistory: false
})

const composer = (): HTMLTextAreaElement =>
  screen.getByPlaceholderText('Ask Crew') as HTMLTextAreaElement

const openChat = (steps: AgentStep[]): void => {
  useCrew.setState(seed(steps))
  render(createElement(Chat))
  drawn.cards = 0
  drawn.messages = 0
  drawn.huddles = 0
}

beforeEach(() => {
  window.crew = {
    warmTerminal: () => undefined,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as typeof window.crew
})

afterEach(cleanup)

describe('what a long chat draws again', () => {
  it('draws no card again while somebody types in the composer', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openChat(steps)

    for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
      act(() => {
        fireEvent.change(composer(), { target: { value } })
      })
    }

    expect(composer().value).toBe('hello')
    expect(drawn.cards).toBe(0)
    expect(drawn.messages).toBe(0)
    expect(drawn.huddles).toBe(0)
  })

  it('draws only the working card again when a step lands', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openChat(steps)

    act(() => {
      useCrew.setState({
        steps: { [PROMPT]: [...steps, { ...stepAt(STEPS), status: 'running' as const, name: 'Grep' }] }
      })
    })

    expect(screen.getByText(/Searching/)).toBeTruthy()
    expect(drawn.cards).toBe(1)
    expect(drawn.messages).toBe(0)
    expect(drawn.huddles).toBe(0)
  })

  it('draws the card whose run ended and leaves the rest alone', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openChat(steps)

    act(() => {
      useCrew.setState({ threadPrompts: {} })
    })

    expect(drawn.cards).toBe(1)
    expect(drawn.messages).toBe(0)
  })

  it('says where a resting thread stands, and leaves what it said to the thread', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openChat(steps)

    expect(screen.getAllByText('Ready for review').length).toBe(CARDS - 1)
    expect(screen.queryByText('the 3th piece is done')).toBeNull()
  })
})
