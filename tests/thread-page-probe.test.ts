// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ThreadView from '../src/renderer/src/views/ThreadView'
import { setFindQuery } from '../src/renderer/src/components/find'
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

const VIEW = 800
const ROW = 30

const SAID = /^step number \d+$/

const drawnRows = (): HTMLElement[] => screen.queryAllByText(SAID)

const rows = (): number => drawnRows().length

Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => VIEW })

Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => rows() * ROW })

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
const STEPS = 1500

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

const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))

const thread = {
  id: THREAD,
  agentId: AGENT.id,
  agentLabel: AGENT.label,
  title: ASK,
  createdBy: 'ALI',
  status: 'open' as const,
  mode: 'build' as const
}

const seed = (held: AgentStep[]) => ({
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
  steps: { [PROMPT]: held },
  tokens: {},
  pending: {}
})

const scroller = (): HTMLElement => document.querySelector('.overflow-y-auto') as HTMLElement

const openThread = (held: AgentStep[] = steps): void => {
  useCrew.setState(seed(held))
  render(createElement(ThreadView, { threadId: THREAD }))
}

const oldestDrawn = (): string => drawnRows()[0]?.textContent ?? ''

const said = (index: number): boolean => screen.queryByText(`step number ${index}`) !== null

beforeEach(() => {
  window.crew = {
    warmTerminal: () => undefined,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as typeof window.crew
  useBrowser.setState({ open: false })
  setFindQuery('')
})

afterEach(() => {
  setFindQuery('')
  cleanup()
})

describe('what a long thread draws at all', () => {
  it('draws its tail rather than every row it holds', () => {
    openThread()

    expect(rows()).toBeLessThan(STEPS / 2)
    expect(said(STEPS - 1)).toBe(true)
    expect(said(0)).toBe(false)
  })

  it('reaches back as somebody comes up on the top of it', () => {
    openThread()
    const first = rows()

    act(() => {
      const el = scroller()
      el.scrollTop = 0
      fireEvent.scroll(el)
    })

    expect(rows()).toBeGreaterThan(first)
    expect(said(STEPS - 1)).toBe(true)
  })

  it('keeps the reader where they were standing when it reaches back', () => {
    openThread()
    const el = scroller()

    act(() => {
      el.scrollTop = 0
      fireEvent.scroll(el)
    })

    expect(el.scrollTop).toBeGreaterThan(0)
  })

  it('draws the whole of it for a search, and keeps it drawn afterwards', () => {
    openThread()

    act(() => setFindQuery('step number 0'))
    expect(said(0)).toBe(true)

    act(() => setFindQuery(''))
    expect(said(0)).toBe(true)
  })

  it('draws a step that lands without losing what it reached back for', () => {
    openThread()

    act(() => {
      const el = scroller()
      el.scrollTop = 0
      fireEvent.scroll(el)
    })
    const oldest = oldestDrawn()

    act(() => {
      useCrew.setState({ steps: { [PROMPT]: [...steps, stepAt(STEPS)] } })
    })

    expect(oldestDrawn()).toBe(oldest)
    expect(said(STEPS)).toBe(true)
  })

  it('keeps its drawn tail bounded while new steps land at the foot', () => {
    const firstSteps = steps.slice(0, 600)
    openThread(firstSteps)
    const first = rows()

    act(() => {
      const el = scroller()
      el.scrollTop = el.scrollHeight
      fireEvent.scroll(el)
    })

    act(() => {
      useCrew.setState({ steps: { [PROMPT]: steps } })
    })

    expect(rows()).toBeLessThanOrEqual(first)
    expect(said(firstSteps.length - 1)).toBe(false)
    expect(said(STEPS - 1)).toBe(true)
  })
})
