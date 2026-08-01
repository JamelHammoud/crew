import { afterEach, describe, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import path from 'node:path'
import { Crews } from '../src/main/crews'
import type { ClientMessage, ServerMessage } from '../src/shared/protocol'
import { projectPlace } from '../src/shared/places'
import { CrewSocket } from '../src/renderer/src/api/ws'
import { initRepo } from './helpers/git'
import { startHost, tmpDir, type TestHost } from './helpers/session'

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
  const crews: Crews[] = []

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.close()
    await Promise.all(hosts.splice(0).map(host => host.close()))
    await Promise.all(crews.splice(0).map(app => app.shutdownAll()))
    vi.unstubAllGlobals()
  })

  it('returns from a private local project to a shared hosted project', async () => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('WebSocket', WebSocket)
    const state = tmpDir('crew-socket-project-state')
    const app = new Crews()
    app.setAgentsPath(path.join(state, 'agents.json'))
    app.setSessionPath(path.join(state, 'session.json'))
    app.setProjectsPath(path.join(state, 'projects'))
    crews.push(app)
    const hostedFolder = tmpDir('crew-socket-hosted')
    const localFolder = tmpDir('crew-socket-local')
    await initRepo(hostedFolder)
    await initRepo(localFolder)
    const hosted = await app.start(1, hostedFolder, 'Jamel', { home: 'folder', share: true })
    const local = await app.start(1, localFolder, 'Jamel', { home: 'private', share: false })
    const socket = new CrewSocket()
    sockets.push(socket)

    for (let index = 0; index < 20; index++) {
      const key = index % 2 === 0 ? projectPlace(localFolder) : projectPlace(hostedFolder)
      const expected = index % 2 === 0 ? local : hosted
      const selected = app.switchTo(1, key)
      expect(selected).not.toBeNull()
      const welcome = welcomeFrom(socket)
      socket.connect(selected!.wsUrl, hello(selected!.name, selected!.code))
      expect((await welcome).snapshot.code).toBe(expected.code)
    }
  }, 40000)

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

    const secondWelcome = welcomeFrom(socket)
    socket.connect(second.url, hello('Jamel', second.code))
    expect((await secondWelcome).snapshot.code).toBe(second.code)

    const backWelcome = welcomeFrom(socket)
    socket.connect(first.url, hello('Jamel', first.code))
    expect((await backWelcome).snapshot.code).toBe(first.code)
  }, 30000)

  it('returns to the shared host before the local Crew welcomes the renderer', async () => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('WebSocket', WebSocket)
    const state = tmpDir('crew-socket-fast-return-state')
    const app = new Crews()
    app.setAgentsPath(path.join(state, 'agents.json'))
    app.setSessionPath(path.join(state, 'session.json'))
    app.setProjectsPath(path.join(state, 'projects'))
    crews.push(app)
    const hostedFolder = tmpDir('crew-socket-fast-hosted')
    const localFolder = tmpDir('crew-socket-fast-local')
    await initRepo(hostedFolder)
    await initRepo(localFolder)
    const hosted = await app.start(1, hostedFolder, 'Jamel', { home: 'folder', share: true })
    const local = await app.start(1, localFolder, 'Jamel', { home: 'private', share: false })
    const socket = new CrewSocket()
    sockets.push(socket)
    const statuses: string[] = []
    socket.onStatus = status => statuses.push(status)

    const firstWelcome = welcomeFrom(socket)
    socket.connect(hosted.wsUrl, hello(hosted.name, hosted.code))
    await firstWelcome

    for (let index = 0; index < 20; index++) {
      app.switchTo(1, projectPlace(localFolder))
      socket.connect(local.wsUrl, hello(local.name, local.code))
      const back = app.switchTo(1, projectPlace(hostedFolder))
      const welcome = welcomeFrom(socket)
      socket.connect(back!.wsUrl, hello(back!.name, back!.code))
      expect((await welcome).snapshot.code).toBe(hosted.code)
    }

    expect(app.current(1)?.place).toBe(projectPlace(hostedFolder))
    expect(statuses.filter(status => status === 'closed')).toEqual([])
  }, 40000)

  it('keeps switching between two live Crews without a reconnecting state', async () => {
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('WebSocket', WebSocket)
    const first = await startHost()
    const second = await startHost()
    hosts.push(first, second)
    const socket = new CrewSocket()
    sockets.push(socket)
    const statuses: string[] = []
    socket.onStatus = status => statuses.push(status)

    for (let index = 0; index < 12; index++) {
      const host = index % 2 === 0 ? first : second
      const welcome = welcomeFrom(socket)
      socket.connect(host.url, hello('Jamel', host.code))
      expect((await welcome).snapshot.code).toBe(host.code)
    }

    expect(statuses.filter(status => status === 'closed')).toEqual([])
    expect(statuses.filter(status => status === 'open')).toHaveLength(12)
  }, 30000)
})
