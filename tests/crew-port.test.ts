import net from 'node:net'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { Crews } from '../src/main/crews'
import { projectPlace } from '../src/shared/places'
import { createCrewServer, type CrewServer } from '../src/server/index'
import { loopbackAnswers, portToAsk } from '../src/server/port'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import type { ServerMessage } from '../src/shared/protocol'
import { initRepo } from './helpers/git'
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
    if (process.platform === 'darwin') expect(stolen).not.toBeNull()
    if (!stolen) return
    standing.push(stolen)
    const back = await firstReply(`ws://127.0.0.1:${port}/ws`, shared.session.code)
    expect(back).toEqual({ type: 'error', message: 'Wrong session code' })
  })
})

describe('two crews open in one app', () => {
  const apps: Crews[] = []

  afterEach(async () => {
    await Promise.all(apps.splice(0).map(app => app.shutdownAll()))
  })

  it('leaves the one you opened first reachable when you come back to it', async () => {
    const state = tmpDir('two-crews-state')
    const app = new Crews()
    app.setAgentsPath(path.join(state, 'agents.json'))
    app.setSessionPath(path.join(state, 'session.json'))
    app.setProjectsPath(path.join(state, 'projects'))
    apps.push(app)
    const hostedFolder = tmpDir('two-crews-hosted')
    const localFolder = tmpDir('two-crews-local')
    await initRepo(hostedFolder)
    await initRepo(localFolder)

    const hosted = await app.start(1, hostedFolder, 'Jamel', { home: 'folder', share: true })
    const local = await app.start(1, localFolder, 'Jamel', { home: 'private', share: false })
    expect(hosted.wsUrl).not.toBe(local.wsUrl)

    const back = app.switchTo(1, projectPlace(hostedFolder))
    expect(back).not.toBeNull()
    expect((await firstReply(back!.wsUrl, back!.code)).type).toBe('welcome')
    const away = app.switchTo(1, projectPlace(localFolder))
    expect((await firstReply(away!.wsUrl, away!.code)).type).toBe('welcome')
  }, 60000)

  it('opens two projects asked for in the same breath one at a time', async () => {
    const state = tmpDir('two-crews-race-state')
    const app = new Crews()
    app.setAgentsPath(path.join(state, 'agents.json'))
    app.setSessionPath(path.join(state, 'session.json'))
    app.setProjectsPath(path.join(state, 'projects'))
    apps.push(app)
    const one = tmpDir('two-crews-race-one')
    const two = tmpDir('two-crews-race-two')
    await initRepo(one)
    await initRepo(two)

    const [first, second] = await Promise.all([
      app.start(1, one, 'Jamel', { home: 'folder', share: true }),
      app.start(2, two, 'Jamel', { home: 'private', share: false })
    ])
    expect(first.wsUrl).not.toBe(second.wsUrl)
    expect((await firstReply(first.wsUrl, first.code)).type).toBe('welcome')
    expect((await firstReply(second.wsUrl, second.code)).type).toBe('welcome')
  }, 60000)

  it('opens one crew for one folder asked for twice at once', async () => {
    const state = tmpDir('one-crew-twice-state')
    const app = new Crews()
    app.setAgentsPath(path.join(state, 'agents.json'))
    app.setSessionPath(path.join(state, 'session.json'))
    app.setProjectsPath(path.join(state, 'projects'))
    apps.push(app)
    const folder = tmpDir('one-crew-twice')
    await initRepo(folder)

    const [first, second] = await Promise.all([
      app.start(1, folder, 'Jamel', { home: 'private' }),
      app.start(2, folder, 'Jamel', { home: 'private' })
    ])
    expect(second.wsUrl).toBe(first.wsUrl)
    expect(app.places()).toHaveLength(1)
  }, 60000)
})
