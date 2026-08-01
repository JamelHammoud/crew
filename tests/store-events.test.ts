// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'

const sockets: FakeSocket[] = []

class FakeSocket {
  sent: ClientMessage[] = []
  onMessage: (msg: ServerMessage) => void = () => {}
  onStatus: () => void = () => {}

  constructor() {
    sockets.push(this)
  }

  connect(): void {}
  send(msg: ClientMessage): void {
    this.sent.push(msg)
  }
  close(): void {}
}

vi.mock('../src/renderer/src/api/ws', () => ({ CrewSocket: FakeSocket }))
vi.mock('../src/renderer/src/media/sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/renderer/src/media/sounds')>()
  return { ...actual, playSound: () => {} }
})

const { useCrew } = await import('../src/renderer/src/state/store')

const socket = (): FakeSocket => sockets[0]

const land = (event: SessionEvent): void => socket().onMessage({ type: 'event', event })

let seq = 0

const message = (text = 'hi'): SessionEvent => ({
  id: `m${seq++}`,
  ts: seq,
  kind: 'message',
  authorId: 'a',
  authorName: 'A',
  text,
  mentions: []
})

const started = (promptId: string, threadId = 't1'): SessionEvent => ({
  id: `s${seq++}`,
  ts: seq,
  kind: 'agent.start',
  promptId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  promptText: 'go',
  byName: 'Jamel',
  threadId
})

const step = (id: string, ts: number): AgentStep => ({ id, kind: 'text', status: 'running', text: id, ts })

const stepped = (promptId: string, one: AgentStep): SessionEvent => ({
  id: `e${seq++}`,
  ts: seq,
  kind: 'agent.step',
  promptId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  threadId: 't1',
  step: one
})

const threadStarted = (threadId: string): SessionEvent => ({
  id: `t${seq++}`,
  ts: seq,
  kind: 'thread.started',
  threadId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title: 'Work',
  byName: 'Jamel'
})

const held = () => {
  const { members, agents, threads, threadPrompts, activePrompts, steps, events, docs, todos } = useCrew.getState()
  return { members, agents, threads, threadPrompts, activePrompts, steps, events, docs, todos }
}

const moved = (before: ReturnType<typeof held>): string[] => {
  const after = held()
  return Object.keys(before)
    .filter(key => before[key as keyof typeof before] !== after[key as keyof typeof after])
    .sort()
}

const upsert = (steps: AgentStep[] | undefined, one: AgentStep): AgentStep[] =>
  [...(steps ?? []).filter(s => s.id !== one.id), one].sort((a, b) => a.ts - b.ts)

beforeEach(() => {
  seq = 0
  useCrew.setState({
    events: [],
    eventLimit: 500,
    members: [{ id: 'me', name: 'Jamel', connected: true }],
    agents: [
      {
        id: 'a1',
        label: 'Bubbles',
        provider: 'claude',
        ownerId: 'me',
        ownerName: 'Jamel',
        status: 'idle',
        runs: {},
        settings: {},
        fields: []
      }
    ],
    threads: {},
    threadPrompts: {},
    activePrompts: {},
    steps: {},
    docs: {},
    todos: []
  })
})

describe('an event landing', () => {
  it('leaves everything it did not touch exactly where it was', () => {
    const before = held()
    land(message())

    expect(moved(before)).toEqual(['events'])
  })

  it('writes the steps of a run and nothing else', () => {
    land(started('p1'))
    const before = held()
    land(stepped('p1', step('b1', 1)))

    expect(moved(before)).toEqual(['events', 'steps'].sort())
  })

  it('writes the threads only when a thread event lands', () => {
    const before = held()
    land(threadStarted('t1'))

    expect(moved(before)).toEqual(['events', 'threads'].sort())
    expect(useCrew.getState().threads.t1?.title).toBe('Work')
  })

  it('writes the people only when somebody arrives or goes', () => {
    const before = held()
    land({ id: 'j1', ts: 1, kind: 'person.joined', memberId: 'm2', name: 'Ali' })

    expect(moved(before)).toEqual(['members'])
    expect(useCrew.getState().members.map(m => m.name)).toEqual(['Jamel', 'Ali'])
  })

  it('holds the whole window still for an event that rides in the snapshot', () => {
    land(message())
    const before = held()
    land({ id: 'd1', ts: 2, kind: 'doc', page: 'main', text: 'draft', byName: 'Jamel' })

    expect(moved(before)).toEqual(['docs'])
  })

  it('keeps the window to what it is allowed to hold', () => {
    useCrew.setState({ eventLimit: 5 })
    for (let i = 0; i < 40; i++) land(message(`line ${i}`))

    const { events } = useCrew.getState()
    expect(events.filter(e => e.kind !== 'agent.step')).toHaveLength(5)
    expect((events[events.length - 1] as { text: string }).text).toBe('line 39')
  })

  it('takes a run’s steps out of the window with its start', () => {
    useCrew.setState({ eventLimit: 3 })
    land(started('p1'))
    land(stepped('p1', step('b1', 1)))
    for (let i = 0; i < 5; i++) land(message())

    const { events } = useCrew.getState()
    expect(events.some(e => e.kind === 'agent.step')).toBe(false)
  })
})

describe('a session arriving whole', () => {
  it('builds the same runs a step at a time would have', () => {
    const steps = [step('b3', 3), step('b1', 1), step('b2', 2), step('b1', 1)]
    const events: SessionEvent[] = [started('p1'), ...steps.map(one => stepped('p1', one))]

    socket().onMessage({
      type: 'welcome',
      selfId: 'me',
      snapshot: {
        code: 'crew',
        members: [{ id: 'me', name: 'Jamel', connected: true }],
        agents: [
          {
            id: 'a1',
            label: 'Bubbles',
            provider: 'claude',
            ownerId: 'me',
            ownerName: 'Jamel',
            status: 'idle',
            runs: { p2: { steps: [step('c2', 2), step('c1', 1)], tokens: 10 } },
            settings: {},
            fields: []
          }
        ],
        events,
        docs: {}
      }
    } as unknown as ServerMessage)

    const one: Record<string, AgentStep[]> = {}
    for (const held of steps) one.p1 = upsert(one.p1, held)
    for (const held of [step('c2', 2), step('c1', 1)]) one.p2 = upsert(one.p2, held)

    expect(useCrew.getState().steps).toEqual(one)
  })
})
