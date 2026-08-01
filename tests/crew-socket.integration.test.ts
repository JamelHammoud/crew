import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import { CrewSocket } from '../src/renderer/src/api/ws'
import { startHost, type TestHost } from './helpers/session'

function hello(name: string, code: string): ClientMessage {
  return { type: 'hello', role: 'ui', name, code }
}

function welcomeFrom(socket: CrewSocket): Promise<Extract<ServerMessage, { type: 'welcome' }>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('welcome timed out')), 10000)
    socket.onMessage = message => {
      if (message.type !== 'welcome') return
      clearTimeout(timer)
      resolve(message)
    }
  })
}

describe('CrewSocket project switching', () => {
  const hosts: TestHost[] = []
  const sockets: CrewSocket[] = []

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.close()
    await Promise.all(hosts.splice(0).map(host => host.close()))
    vi.unstubAllGlobals()
  })

  it('switches between two live Crews and back through one renderer socket', async () => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('WebSocket', WebSocket)
    const first = await startHost()
    const second = await startHost()
    hosts.push(first, second)
    const socket = new CrewSocket()
    sockets.push(socket)

    const firstWelcome = welcomeFrom(socket)
    socket.connect(first.url, hello('Jamel', first.code))
    expect((await firstWelcome).snapshot.code).toBe(first.code)

    socket.close()
    const secondWelcome = welcomeFrom(socket)
    socket.connect(second.url, hello('Jamel', second.code))
    expect((await secondWelcome).snapshot.code).toBe(second.code)

    socket.close()
    const backWelcome = welcomeFrom(socket)
    socket.connect(first.url, hello('Jamel', first.code))
    expect((await backWelcome).snapshot.code).toBe(first.code)
  }, 30000)
})
