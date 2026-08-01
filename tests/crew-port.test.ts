import net from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { createCrewServer, type CrewServer } from '../src/server/index'
import { loopbackAnswers, portToAsk } from '../src/server/port'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import type { ServerMessage } from '../src/shared/protocol'
import { tmpDir } from './helpers/session'

function crewOn(port: number, host: string): Promise<CrewServer> {
  const session = new CrewSession(new Store(tmpDir('port-crew')))
  return createCrewServer(session, { port, host })
}

async function freePort(): Promise<number> {
  const probe = net.createServer()
  await new Promise<void>(done => probe.listen(0, '127.0.0.1', done))
  const address = probe.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>(done => probe.close(() => done()))
  return port
}

function firstReply(url: string, code: string): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('nothing came back'))
    }, 5000)
    ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', role: 'ui', name: 'Jamel', code })))
    ws.on('message', raw => {
      clearTimeout(timer)
      ws.close()
      resolve(JSON.parse(raw.toString()) as ServerMessage)
    })
    ws.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

describe('the port a crew takes', () => {
  const standing: CrewServer[] = []

  afterEach(async () => {
    await Promise.all(standing.splice(0).map(server => server.close()))
  })

  it('reads a shared crew as holding loopback, not just its own address', async () => {
    const port = await freePort()
    expect(await loopbackAnswers(port)).toBe(false)
    expect(await portToAsk(port)).toBe(port)
    standing.push(await crewOn(port, '0.0.0.0'))
    expect(await loopbackAnswers(port)).toBe(true)
    expect(await portToAsk(port)).toBe(0)
  })

  // macOS lets the second of these bind, and hands it every loopback connection
  // the first one was already being reached on. Asking for the preferred port
  // without looking is what put a private crew in front of a shared one.
  it('leaves a shared crew reachable after a private one opens', async () => {
    const preferred = await freePort()
    const shared = await crewOn(await portToAsk(preferred), '0.0.0.0')
    standing.push(shared)
    const local = await crewOn(await portToAsk(preferred), '127.0.0.1')
    standing.push(local)

    expect(shared.port()).toBe(preferred)
    expect(local.port()).not.toBe(shared.port())

    const back = await firstReply(`ws://127.0.0.1:${shared.port()}/ws`, shared.session.code)
    expect(back.type).toBe('welcome')
    const other = await firstReply(`ws://127.0.0.1:${local.port()}/ws`, local.session.code)
    expect(other.type).toBe('welcome')
  })

  it('says which crew answers when two take the same loopback port', async () => {
    const port = await freePort()
    const shared = await crewOn(port, '0.0.0.0')
    standing.push(shared)
    let stolen: CrewServer | null = null
    try {
      stolen = await crewOn(port, '127.0.0.1')
    } catch {
      stolen = null
    }
    if (!stolen) return
    standing.push(stolen)
    const back = await firstReply(`ws://127.0.0.1:${port}/ws`, shared.session.code)
    expect(back).toEqual({ type: 'error', message: 'Wrong session code' })
  })
})
