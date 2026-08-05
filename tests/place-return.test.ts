// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import type { CurrentSession } from '../src/shared/session'

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

const ONE = 'project:/Users/jamel/one'
const TWO = 'project:/Users/jamel/two'

const asked: string[] = []

const sessionFor = (place: string): CurrentSession => ({
  wsUrl: 'ws://127.0.0.1:2739/ws',
  place,
  name: 'Jamel',
  code: 'abc123',
  link: null,
  folder: place.replace('project:', ''),
  home: 'folder',
  shared: false,
  synced: false,
  hosting: true,
  crewRemote: null,
  tracked: true,
  projectSync: false
})

window.crew = {
  switchTo: (key: string) => {
    asked.push(key)
    return Promise.resolve(sessionFor(key))
  },
  warmTerminal: () => undefined
} as unknown as CrewBridge

const { useCrew } = await import('../src/renderer/src/state/store')

const socket = (): FakeSocket => sockets[0]

const opened = (threadId: string): SessionEvent => ({
  id: `${threadId}-start`,
  ts: 1,
  kind: 'thread.started',
  threadId,
  agentId: 'a1',
  agentLabel: 'Bubbles',
  title: 'Check the plan charge',
  byName: 'Jamel'
})

const welcome = (): void =>
  socket().onMessage({
    type: 'welcome',
    selfId: 'me',
    snapshot: {
      code: 'abc123',
      members: [{ id: 'me', name: 'Jamel', connected: true }],
      agents: [],
      events: [opened('t1'), opened('t2')],
      docs: {}
    }
  } as unknown as ServerMessage)

const land = (place: string): void => {
  useCrew.getState().connect(sessionFor(place))
  welcome()
}

beforeEach(() => {
  asked.length = 0
  land(ONE)
})

describe('coming back to a project', () => {
  it('opens the thread it was left reading', async () => {
    useCrew.getState().openThreadAlone('t1')

    await useCrew.getState().switchTo(TWO)
    welcome()
    expect(useCrew.getState().openThreadIds).toEqual([])

    await useCrew.getState().switchTo(ONE)
    welcome()

    expect(asked).toEqual([TWO, ONE])
    expect(useCrew.getState().openThreadIds).toEqual(['t1'])
  })

  it('opens no thread at all when the project itself is what was asked for', async () => {
    useCrew.getState().openThreadAlone('t1')

    await useCrew.getState().switchTo(TWO)
    welcome()

    useCrew.getState().wantThread(null)
    await useCrew.getState().switchTo(ONE)
    welcome()

    expect(useCrew.getState().openThreadIds).toEqual([])
    expect(useCrew.getState().openThreadId).toBe(null)
  })

  it('opens the one thread asked for rather than the row it was left with', async () => {
    useCrew.getState().openThreadAlone('t1')

    await useCrew.getState().switchTo(TWO)
    welcome()

    useCrew.getState().wantThread('t2')
    await useCrew.getState().switchTo(ONE)
    welcome()

    expect(useCrew.getState().openThreadIds).toEqual(['t2'])
    expect(useCrew.getState().openThreadId).toBe('t2')
  })
})
