// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, it } from 'vitest'
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
const STEPS = 300
const CHATTER = 40

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
  } as unknown as SessionEvent,
  {
    id: `${THREAD}-message`,
    ts: 2,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: ASK,
    mentions: [AGENT.id],
    threadId: THREAD
  } as unknown as SessionEvent,
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
  } as unknown as SessionEvent
]

for (let i = 0; i < CHATTER; i++) {
  events.push({
    id: `${THREAD}-said-${i}`,
    ts: 100 + i,
    kind: 'message',
    authorId: 'ali',
    authorName: 'ALI',
    text: `a line of talk number ${i}`,
    threadId: THREAD,
    replyTo: i % 2 === 0 ? { targetId: `${THREAD}-message`, authorName: 'ALI', text: ASK } : undefined
  } as unknown as SessionEvent)
}

const older: SessionEvent[] = []
for (let i = 0; i < 6000; i++) {
  older.push({
    id: `old-${i}`,
    ts: -6000 + i,
    kind: 'agent.step',
    threadId: 'thread-0',
    promptId: 'prompt-0',
    agentId: AGENT.id,
    step: { id: `os-${i}`, ts: i, kind: 'tool', status: 'done', name: 'Read', detail: 'x'.repeat(120) }
  } as unknown as SessionEvent)
}

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
  events: [...older, ...events],
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

beforeEach(() => {
  window.crew = {
    warmTerminal: () => undefined,
    onUpdate: () => () => {},
    updateState: async () => NO_UPDATE
  } as unknown as typeof window.crew
  useBrowser.setState({ open: false })
})

afterEach(cleanup)

describe('what a keystroke costs', () => {
  it('measures', () => {
    const realSubscribe = useCrew.subscribe.bind(useCrew)
    let live = 0
    ;(useCrew as unknown as { subscribe: typeof realSubscribe }).subscribe = (listener => {
      live += 1
      const off = realSubscribe(listener as never)
      return () => {
        live -= 1
        off()
      }
    }) as typeof realSubscribe

    const steps = Array.from({ length: STEPS }, (_, index) => stepAt(index))
    useCrew.setState(seed(steps))
    render(createElement(ThreadView, { threadId: THREAD }))

    console.log(`events held: ${useCrew.getState().events.length}`)
    console.log(`live useCrew subscribers: ${live}`)

    const letters = 'hello there crew'.split('')
    let value = ''
    act(() => {
      fireEvent.change(composer(), { target: { value: 'x' } })
    })
    value = ''
    const t = performance.now()
    for (const letter of letters) {
      value += letter
      act(() => {
        fireEvent.change(composer(), { target: { value } })
      })
    }
    const each = (performance.now() - t) / letters.length
    console.log(`per keystroke: ${each.toFixed(2)}ms`)

    const s = performance.now()
    for (let i = 0; i < 30; i++) {
      act(() => {
        useCrew.setState({ steps: { [PROMPT]: [...steps, stepAt(STEPS + i)] } })
      })
    }
    console.log(`per step landing: ${((performance.now() - s) / 30).toFixed(2)}ms`)
    ;(useCrew as unknown as { subscribe: typeof realSubscribe }).subscribe = realSubscribe
  })
})
