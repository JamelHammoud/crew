import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientMessage } from '../src/shared/protocol'
import { CrewSocket, type SocketStatus } from '../src/renderer/src/api/ws'

const made: NativeSocket[] = []

class NativeSocket {
  static OPEN = 1
  readyState = 0
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  closed = false

  constructor(readonly url: string) {
    made.push(this)
  }

  send(message: string): void {
    this.sent.push(message)
  }

  close(): void {
    this.closed = true
  }

  open(): void {
    this.readyState = NativeSocket.OPEN
    this.onopen?.()
  }

  finishClose(): void {
    this.readyState = 3
    this.onclose?.()
  }

  message(value: unknown): void {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent)
  }
}

const hello = (name: string): ClientMessage => ({ type: 'hello', role: 'ui', name, code: 'crew-code' })

beforeEach(() => {
  made.length = 0
  vi.useFakeTimers()
  vi.stubGlobal('window', globalThis)
  globalThis.WebSocket = NativeSocket as unknown as typeof WebSocket
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CrewSocket', () => {
  it('closes the first Crew and ignores its late events after a second Crew connects', () => {
    const socket = new CrewSocket()
    const statuses: SocketStatus[] = []
    const messages: unknown[] = []
    socket.onStatus = status => statuses.push(status)
    socket.onMessage = message => messages.push(message)

    socket.connect('ws://127.0.0.1:1001/ws', hello('One'))
    const first = made[0]
    first.open()
    socket.connect('ws://127.0.0.1:1002/ws', hello('Two'))
    const second = made[1]
    second.open()

    first.finishClose()
    first.message({ type: 'typing.room', typists: [{ memberId: 'old', where: null }] })
    vi.advanceTimersByTime(20000)

    expect(statuses).toEqual(['connecting', 'open', 'connecting', 'open'])
    expect(messages).toEqual([])
    expect(made).toHaveLength(2)
    expect(first.closed).toBe(true)
    expect(JSON.parse(second.sent[0])).toMatchObject({ type: 'hello', name: 'Two' })
  })

  it('cancels a scheduled retry when another Crew is selected', () => {
    const socket = new CrewSocket()
    socket.connect('ws://127.0.0.1:1001/ws', hello('One'))
    made[0].finishClose()

    socket.connect('ws://127.0.0.1:1002/ws', hello('Two'))
    made[1].open()
    vi.advanceTimersByTime(2000)

    expect(made.map(item => item.url)).toEqual(['ws://127.0.0.1:1001/ws', 'ws://127.0.0.1:1002/ws'])
  })
})
