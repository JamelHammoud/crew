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

const step = (id: string, text: string, ts: number): AgentStep => ({
  id,
  kind: 'text',
  status: 'running',
  text,
  ts
})

const deltas: { promptId: string; step: AgentStep }[] = [
  { promptId: 'p1', step: step('s2', 'second', 2) },
  { promptId: 'p1', step: step('s1', 'first', 1) },
  { promptId: 'p2', step: step('s3', 'other', 1) },
  { promptId: 'p1', step: step('s2', 'second again', 2) }
]

const upsert = (steps: AgentStep[] | undefined, one: AgentStep): AgentStep[] =>
  [...(steps ?? []).filter(s => s.id !== one.id), one].sort((a, b) => a.ts - b.ts)

const unbuffered = (): Record<string, AgentStep[]> => {
  const steps: Record<string, AgentStep[]> = {}
  for (const { promptId, step: one } of deltas) steps[promptId] = upsert(steps[promptId], one)
  return steps
}

const stream = (): void => {
  for (const { promptId, step: one } of deltas) {
    socket().onMessage({ type: 'agent.step', promptId, agentId: 'a1', threadId: 't1', step: one })
  }
}

const written = (): { count: () => number; stop: () => void } => {
  let count = 0
  const stop = useCrew.subscribe((state, prev) => {
    if (state.steps !== prev.steps) count += 1
  })
  return { count: () => count, stop }
}

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 50))

const started = (promptId: string): SessionEvent => ({
  id: `start-${promptId}`,
  ts: 0,
  kind: 'agent.start',
  promptId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  promptText: 'go',
  byName: 'Jamel',
  threadId: 't1'
})

const stepEvent = (one: AgentStep): SessionEvent => ({
  id: 'e1',
  ts: 9,
  kind: 'agent.step',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  threadId: 't1',
  step: one
})

beforeEach(() => {
  useCrew.setState({ steps: {}, events: [] })
})

describe('a run streaming its steps', () => {
  it('writes the steps once for a burst that arrived in one frame', async () => {
    const writes = written()
    stream()

    expect(writes.count()).toBe(0)
    await settle()
    expect(writes.count()).toBe(1)
    writes.stop()
  })

  it('lands the same steps a delta at a time would have', async () => {
    stream()
    await settle()

    expect(useCrew.getState().steps).toEqual(unbuffered())
  })

  it('holds what is waiting until anything reads the steps exactly', () => {
    socket().onMessage({ type: 'event', event: started('p1') })
    socket().onMessage({ type: 'event', event: started('p2') })
    stream()
    expect(useCrew.getState().steps.p1).toBeUndefined()

    socket().onMessage({ type: 'event', event: stepEvent(step('s4', 'from the log', 4)) })

    const steps = useCrew.getState().steps
    expect(steps.p1?.map(one => one.id)).toEqual(['s1', 's2', 's4'])
    expect(steps.p2).toHaveLength(1)
  })

  it('drops what is waiting when the session is handed over again', async () => {
    stream()
    socket().onMessage({
      type: 'welcome',
      selfId: 'me',
      snapshot: { code: 'crew', members: [], agents: [], events: [], docs: {} }
    } as unknown as ServerMessage)
    await settle()

    expect(useCrew.getState().steps).toEqual({})
  })
})
