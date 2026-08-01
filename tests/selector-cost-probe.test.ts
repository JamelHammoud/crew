// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement, Fragment, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReplyQuote from '../src/renderer/src/components/ReplyQuote'
import SubagentList from '../src/renderer/src/components/subagents/SubagentList'
import { usePanelOpens } from '../src/renderer/src/components/panelOpens'
import { useThreadRead } from '../src/renderer/src/components/useThreadRead'
import { useBrowser } from '../src/renderer/src/state/browser'
import { useCrew } from '../src/renderer/src/state/store'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep, PooledAgent } from '../src/shared/llm'
import { landed } from './helpers/boot'

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

global.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver
landed()

const merges = vi.hoisted(() => ({ count: 0 }))

vi.mock('../src/shared/events', async () => {
  const actual = await vi.importActual<typeof import('../src/shared/events')>('../src/shared/events')
  return {
    ...actual,
    mergeEvents: (...args: Parameters<typeof actual.mergeEvents>) => {
      merges.count += 1
      return actual.mergeEvents(...args)
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

const THREAD = 'thread-1'
const PROMPT = 'prompt-1'
const HELPERS = 8
const QUOTES = 20
const WINDOW_EVENTS = 3000
const READ_EVENTS = 400

let touched = 0

// Every walk over the log reads one of these three off each event it passes, so
// counting them is the cost of a pass however the pass is written.
const watched = <T extends SessionEvent>(event: T): T => {
  const seen: Record<string, unknown> = { ...event }
  for (const field of ['kind', 'id', 'ts']) {
    const value = seen[field]
    Object.defineProperty(seen, field, {
      get: () => {
        touched += 1
        return value
      },
      enumerable: true,
      configurable: true
    })
  }
  return seen as T
}

const message = (index: number, at: number): SessionEvent => ({
  id: `msg-${index}`,
  ts: at,
  kind: 'message',
  authorId: 'ali',
  authorName: 'ALI',
  text: `something said ${index}`,
  mentions: [],
  threadId: THREAD,
  attachments:
    index % 5 === 0
      ? [{ id: `att-${index}`, name: `shot-${index}.png`, mime: 'image/png', file: `${index}.png`, size: 120 }]
      : undefined
})

const step = (index: number, at: number): SessionEvent => ({
  id: `step-event-${index}`,
  ts: at,
  kind: 'agent.step',
  threadId: THREAD,
  promptId: PROMPT,
  agentId: AGENT.id,
  step: {
    id: `step-${index}`,
    ts: at,
    kind: 'tool',
    status: 'done',
    name: index % 2 === 0 ? 'Read' : 'Bash',
    detail: `step number ${index}`
  }
})

const helperThread = (index: number): string => `${THREAD}-helper-${index}`

const helperEvents = (at: number): SessionEvent[] =>
  Array.from({ length: HELPERS }, (_, index) => ({
    id: `sent-${index}`,
    ts: at + index,
    kind: 'subagent.started' as const,
    threadId: helperThread(index),
    parentThreadId: THREAD,
    promptId: PROMPT,
    agentId: AGENT.id,
    name: `Helper ${index}`,
    subject: `piece ${index}`
  }))

// A window holding the tail of a busy day, and a page of the thread's own
// history read back under it, which is what makes mergeEvents real work.
const buildLog = (): { events: SessionEvent[]; readEvents: SessionEvent[] } => {
  const older: SessionEvent[] = [
    {
      id: `${THREAD}-start`,
      ts: 1,
      kind: 'thread.started',
      threadId: THREAD,
      agentId: AGENT.id,
      agentLabel: AGENT.label,
      title: 'replace the canvas',
      byName: 'ALI'
    }
  ]
  for (let index = 0; index < READ_EVENTS; index++) {
    older.push(index % 3 === 0 ? message(index, 2 + index) : step(index, 2 + index))
  }
  const held: SessionEvent[] = [
    {
      id: `${THREAD}-run`,
      ts: 1000,
      kind: 'agent.start',
      threadId: THREAD,
      promptId: PROMPT,
      agentId: AGENT.id,
      agentLabel: AGENT.label,
      promptText: 'replace the canvas',
      byName: 'ALI'
    },
    ...helperEvents(1001)
  ]
  for (let index = 0; index < WINDOW_EVENTS; index++) {
    const at = 1100 + index
    held.push(index % 4 === 0 ? message(READ_EVENTS + index, at) : step(READ_EVENTS + index, at))
  }
  return { events: held.map(watched), readEvents: older.map(watched) }
}

const { events, readEvents } = buildLog()

const steps: AgentStep[] = Array.from({ length: 200 }, (_, index) => ({
  id: `step-${index}`,
  ts: 10 + index,
  kind: 'tool',
  status: 'done',
  name: 'Read',
  detail: `step number ${index}`
}))

const thread = {
  id: THREAD,
  agentId: AGENT.id,
  agentLabel: AGENT.label,
  title: 'replace the canvas',
  createdBy: 'ALI',
  status: 'open' as const,
  mode: 'build' as const
}

const threads = {
  [THREAD]: thread,
  ...Object.fromEntries(
    Array.from({ length: HELPERS }, (_, index) => [
      helperThread(index),
      { ...thread, id: helperThread(index), parentThreadId: THREAD, helper: `Helper ${index}` }
    ])
  )
}

const seed = () => ({
  connection: 'online' as const,
  place: 'project:here',
  httpBase: 'http://127.0.0.1:2739',
  selfId: 'ali',
  selfName: 'ALI',
  members: [{ id: 'ali', name: 'ALI', connected: true }],
  agents: [AGENT],
  events,
  readEvents,
  readSteps: {},
  threads,
  openThreadIds: [THREAD],
  openThreadId: THREAD,
  threadPrompts: {},
  threadDrafts: {},
  threadCommands: {},
  queues: {},
  steps: { [PROMPT]: steps },
  tokens: {},
  costs: {},
  pending: {}
})

// A screenful of a thread column: the quotes on the messages in it, the helpers
// it sent out, and the two hooks everything else in the column hangs off.
function Screen(): ReactNode {
  useThreadRead(THREAD)
  usePanelOpens()
  return createElement(
    Fragment,
    null,
    ...Array.from({ length: QUOTES }, (_, index) =>
      createElement(ReplyQuote, {
        key: index,
        // Half of them point at a message the window still holds and half at one
        // that has fallen out of it, which is the walk that finds nothing.
        targetId: `message:msg-${index % 2 === 0 ? READ_EVENTS + index * 10 : index}`,
        authorId: 'ali',
        authorName: 'ALI',
        label: 'Replying to ALI',
        text: `quoted line ${index}`
      })
    ),
    createElement(SubagentList, { key: 'helpers', parentThreadId: THREAD, onOpen: () => {} })
  )
}

function Reader({ seen }: { seen: SessionEvent[][] }): ReactNode {
  const { events: held } = useThreadRead(THREAD)
  if (seen.at(-1) !== held) seen.push(held)
  return null
}

const stand = (): void => {
  useCrew.setState(seed())
  render(createElement(Screen))
  touched = 0
}

const cost = (write: () => void): number => {
  touched = 0
  act(write)
  return touched
}

beforeEach(() => {
  window.crew = { warmTerminal: () => undefined } as unknown as typeof window.crew
  useBrowser.setState({ open: false })
})

afterEach(cleanup)

describe('what one store write costs a thread column', () => {
  it('walks the log for nothing when a write touches neither the log nor the steps', () => {
    stand()
    const walked = cost(() => useCrew.setState({ tokens: { [PROMPT]: 40 } }))
    expect(walked).toBe(0)
  })

  it('reads nothing off the log when a step lands', () => {
    stand()
    const walked = cost(() => useCrew.setState({ steps: { [PROMPT]: [...steps, steps[0]] } }))
    expect(walked).toBe(0)
  })

  it('still finds the picture on the message a quote points at', () => {
    stand()
    const shots = document.querySelectorAll('img')
    expect(shots.length).toBe(QUOTES / 2)
  })

  it('lists every helper the thread sent out', () => {
    stand()
    expect(document.body.textContent).toContain(`piece ${HELPERS - 1}`)
  })

  it('marks the helper whose run fell over', () => {
    stand()
    expect(document.querySelectorAll('.text-danger').length).toBe(1)
  })

  it('hands back the same log a step landed on', () => {
    const seen: SessionEvent[][] = []
    useCrew.setState(seed())
    render(createElement(Reader, { seen }))
    act(() => useCrew.setState({ steps: { [PROMPT]: [...steps, steps[0]] } }))
    expect(seen.length).toBeGreaterThan(1)
    expect(seen.at(-1)).toBe(seen[0])
  })

  it('hands back a new log when an event lands', () => {
    const seen: SessionEvent[][] = []
    useCrew.setState(seed())
    render(createElement(Reader, { seen }))
    act(() => useCrew.setState({ events: [...events, message(9999, 9999)] }))
    expect(seen.at(-1)).not.toBe(seen[0])
  })
})
