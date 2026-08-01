// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentAlert } from '../src/shared/alerts'
import type { SessionEvent } from '../src/shared/events'
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

const banners: AgentAlert[] = []

const finished = (threadId: string): SessionEvent => ({
  id: `end-${threadId}`,
  ts: 4,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  ok: true,
  threadId
})

const mentioned = (threadId: string): SessionEvent => ({
  id: `said-${threadId}`,
  ts: 5,
  kind: 'message',
  text: '@Bubbles have a look at this',
  authorId: 'jamel',
  authorName: 'Jamel',
  mentions: [],
  threadId,
  memberMentionRefs: [{ id: 'me', name: 'Bubbles' }]
})

describe('the system banner', () => {
  beforeEach(() => {
    banners.length = 0
    window.crew = { notify: async (alert: AgentAlert) => void banners.push(alert) } as never
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    useCrew.setState({
      selfId: 'me',
      openThreadId: null,
      agents: [{ id: 'a1', label: 'Bubbles' }] as never,
      threads: {
        'thread-1': {
          id: 'thread-1',
          agentId: 'a1',
          agentLabel: 'Bubbles',
          title: '@Bubbles fix the sync loop',
          createdBy: 'Jamel',
          status: 'open',
          mode: 'build'
        }
      },
      threadPrompts: {},
      queues: {},
      events: []
    })
  })

  it('fires for a run that landed while the window was the one being looked at', () => {
    socket().onMessage({ type: 'event', event: finished('thread-1') })
    expect(banners.map(alert => alert.title)).toEqual(['Bubbles finished'])
  })

  it('fires for a mention with the window in front', () => {
    socket().onMessage({ type: 'event', event: mentioned('thread-1') })
    expect(banners.map(alert => alert.title)).toEqual(['Jamel mentioned you'])
  })

  it('says nothing about the thread already on the screen', () => {
    useCrew.setState({ openThreadId: 'thread-1' })
    socket().onMessage({ type: 'event', event: finished('thread-1') })
    expect(banners).toEqual([])
  })
})
