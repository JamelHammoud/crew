// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const thread = (id: string) => ({
  id,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title: 'fix the sync loop',
  createdBy: 'Jamel',
  status: 'open' as const,
  mode: 'build' as const
})

describe('clicking a banner', () => {
  beforeEach(() => {
    useCrew.setState({
      place: 'project:/here',
      openThreadIds: [],
      openThreadId: null,
      threads: { 'thread-1': thread('thread-1') } as never
    })
  })

  it('opens the thread it names', () => {
    useCrew.getState().openAlertThread('thread-1', 'project:/here')
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
    expect(useCrew.getState().openThreadId).toBe('thread-1')
  })

  it('opens it when the banner named no project', () => {
    useCrew.getState().openAlertThread('thread-1', null)
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })

  it('takes the place of whatever was open', () => {
    useCrew.setState({ openThreadIds: ['thread-9'], openThreadId: 'thread-9' })
    useCrew.getState().openAlertThread('thread-1', 'project:/here')
    expect(useCrew.getState().openThreadIds).toEqual(['thread-1'])
  })
})
