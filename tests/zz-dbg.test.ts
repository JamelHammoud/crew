// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'

const sockets: FakeSocket[] = []
class FakeSocket {
  onMessage: (msg: ServerMessage) => void = () => {}
  onStatus: () => void = () => {}
  constructor() { sockets.push(this) }
  connect(): void {}
  send(_msg: ClientMessage): void {}
  close(): void {}
}
vi.mock('../src/renderer/src/api/ws', () => ({ CrewSocket: FakeSocket }))
vi.mock('../src/renderer/src/media/sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/renderer/src/media/sounds')>()
  return { ...actual, playSound: () => {} }
})
const { useCrew } = await import('../src/renderer/src/state/store')

describe('dbg', () => {
  it('shows what lands', () => {
    useCrew.setState({ steps: {}, events: [] })
    sockets[0]!.onMessage({ type: 'agent.step', promptId: 'p1', agentId: 'a1', threadId: 't1', step: { id: 's1', kind: 'text', status: 'running', text: 'a', ts: 1 } })
    console.log('after push', JSON.stringify(useCrew.getState().steps))
    sockets[0]!.onMessage({ type: 'event', event: { id: 'e1', ts: 9, kind: 'agent.step', promptId: 'p1', agentId: 'a1', agentLabel: 'B', threadId: 't1', step: { id: 's4', kind: 'text', status: 'running', text: 'z', ts: 4 } } })
    console.log('after event', JSON.stringify(useCrew.getState().steps))
    console.log('events', useCrew.getState().events.length)
    expect(true).toBe(true)
  })
})
