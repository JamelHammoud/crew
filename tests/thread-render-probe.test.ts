// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { useBrowser } from '../src/renderer/src/state/browser'
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
landed()

const drawn = vi.hoisted(() => ({ items: 0, rows: 0, walks: 0 }))

vi.mock('../src/renderer/src/components/thread', async () => {
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/thread')>(
    '../src/renderer/src/components/thread'
  )
  return {
    ...actual,
    lastEnd: (...args: Parameters<typeof actual.lastEnd>) => {
      drawn.walks += 1
      return actual.lastEnd(...args)
    },
    lastStart: (...args: Parameters<typeof actual.lastStart>) => {
      drawn.walks += 1
      return actual.lastStart(...args)
    }
  }
})

vi.mock('../src/renderer/src/components/ThreadItems', async () => {
  const { createElement, memo } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/ThreadItems')>(
    '../src/renderer/src/components/ThreadItems'
  )
  const real = actual.default
  return {
    ...actual,
    default: memo((props: Parameters<typeof real>[0]) => {
      drawn.items += 1
      return createElement(real, props)
    })
  }
})

vi.mock('../src/renderer/src/components/StepRow', async () => {
  const { createElement, memo } = await import('react')
  const actual = await vi.importActual<typeof import('../src/renderer/src/components/StepRow')>(
    '../src/renderer/src/components/StepRow'
  )
  const real = actual.default
  return {
    ...actual,
    default: memo((props: Parameters<typeof real>[0]) => {
      drawn.rows += 1
      return createElement(real, props)
    })
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

const THREAD = 'thread-1'
const PROMPT = 'prompt-1'
const ASK = '@Claude replace the canvas'
const STEPS = 200

const events: SessionEvent[] = [
  {
    id: `${THREAD}-start`,
    ts: 1,
    kind: 'thread.started',
    threadId: THREAD,
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    title: ASK,
    byName: 'ALI'
  },
  {
    id: `${THREAD}-message`,
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: ASK,
    mentions: [AGENT.id],
    threadId: THREAD
  },
  {
    id: `${THREAD}-run`,
    ts: 3,
    kind: 'agent.start',
    threadId: THREAD,
    promptId: PROMPT,
    agentId: AGENT.id,
    agentLabel: AGENT.label,
    promptText: ASK,
    byName: 'ALI'
  }
]

const stepAt = (index: number): AgentStep => ({
  id: `step-${index}`,
  ts: 10 + index,
  kind: 'tool',
  status: 'done',
  name: index % 2 === 0 ? 'Read' : 'Bash',
  detail: `step number ${index}`
})

const thread = {
  id: THREAD,
  agentId: AGENT.id,
  agentLabel: AGENT.label,
  title: ASK,
  createdBy: 'ALI',
  status: 'open' as const,
  mode: 'build' as const
}

const seed = (steps: AgentStep[]) => ({
  connection: 'online' as const,
  place: 'project:here',
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [AGENT],
  events,
  threads: { [THREAD]: thread },
  openThreadIds: [THREAD],
  openThreadId: THREAD,
  threadPrompts: {},
  threadDrafts: {},
  threadCommands: {},
  queues: {},
  steps: { [PROMPT]: steps },
  tokens: {},
  pending: {}
})

const composer = (): HTMLTextAreaElement =>
  screen.getByPlaceholderText('Send a message or @ someone') as HTMLTextAreaElement

const openThread = (steps: AgentStep[]): void => {
  useCrew.setState(seed(steps))
  render(createElement(ThreadView, { threadId: THREAD }))
  drawn.items = 0
  drawn.rows = 0
}

beforeEach(() => {
  window.crew = {
    warmTerminal: () => undefined,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as typeof window.crew
  useBrowser.setState({ open: false })
})

afterEach(cleanup)

describe('what a long thread draws again', () => {
  it('draws no row again while somebody types in the composer', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openThread(steps)

    for (const value of ['h', 'he', 'hel', 'hell', 'hello']) {
      act(() => {
        fireEvent.change(composer(), { target: { value } })
      })
    }

    expect(composer().value).toBe('hello')
    expect(drawn.items).toBe(0)
    expect(drawn.rows).toBe(0)
  })

  it('shows a step that lands without redrawing what it did not change', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openThread(steps)

    act(() => {
      useCrew.setState({ steps: { [PROMPT]: [...steps, stepAt(STEPS)] } })
    })

    expect(screen.getByText(`step number ${STEPS}`)).toBeTruthy()
    expect(drawn.items).toBe(1)
  })

  it('shows the new words when a step is written again', () => {
    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    openThread(steps)

    act(() => {
      const next = [...steps]
      next[0] = { ...next[0], detail: 'the step said something else' }
      useCrew.setState({ steps: { [PROMPT]: next } })
    })

    expect(screen.getByText('the step said something else')).toBeTruthy()
    expect(screen.queryByText('step number 0')).toBeNull()
  })
})
