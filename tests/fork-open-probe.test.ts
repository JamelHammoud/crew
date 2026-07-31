// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import type { SessionEvent } from '../src/shared/events'

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
vi.mock('../src/renderer/src/media/sounds', () => ({
  playSound: () => {},
  primeSounds: () => {},
  setSoundVolume: () => {}
}))

const { useCrew } = await import('../src/renderer/src/state/store')

const socket = (): FakeSocket => sockets[0]

const forkOf = (threadId: string): ClientMessage | undefined =>
  socket().sent.find(msg => msg.type === 'chat.send' && msg.commands?.includes('fork'))

const landed = (threadId: string, forkedFrom: string): SessionEvent => ({
  id: 'fork-start',
  ts: 9,
  kind: 'thread.started',
  threadId,
  agentId: 'ali/claude',
  agentLabel: 'Claude 2',
  title: 'try it with the header on top',
  byName: 'ALI',
  forkedFrom,
  forkedAt: 8
})

describe('opening a fork', () => {
  beforeEach(() => {
    socket().sent = []
    useCrew.setState({ openThreadId: 'thread-1', threadDrafts: {}, threadCommands: {}, pending: {} })
  })

  it('names the id it opens under, and goes there the moment it lands', () => {
    useCrew.getState().sendChat('try it with the header on top', 'thread-1', undefined, undefined, undefined, ['fork'])

    const sent = forkOf('thread-1')
    expect(sent?.type).toBe('chat.send')
    const forkId = sent && sent.type === 'chat.send' ? sent.forkId : undefined
    expect(forkId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    socket().onMessage({ type: 'event', event: landed(forkId!, 'thread-1') })
    expect(useCrew.getState().openThreadId).toBe(forkId)
  })

  it('leaves an ordinary message unnamed, and everyone else where they were', () => {
    useCrew.getState().sendChat('and the changelog', 'thread-1')
    const plain = socket().sent.find(msg => msg.type === 'chat.send')
    expect(plain && plain.type === 'chat.send' ? plain.forkId : 'set').toBeUndefined()

    socket().onMessage({ type: 'event', event: landed('somebody-elses-fork', 'thread-1') })
    expect(useCrew.getState().openThreadId).toBe('thread-1')
  })
})
