import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Avatar = Extract<ServerMessage, { type: 'agent.avatar' }>

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const image = (name = 'face.png', mime = 'image/png', data = PNG.toString('base64')) => ({ name, mime, data })

describe('agent photos', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  const id = agentId('jamel', 'uuid-1')

  async function bringAgent(): Promise<void> {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'uuid-1', provider: 'fake', name: 'Fake', settings: {} }],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
  }

  it('puts an uploaded photo on your own agent and takes it back off', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    const other = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui, other)
    await bringAgent()
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    ui.send({ type: 'agent.avatar', agentId: id, image: image() })
    const set = (await other.waitFor(m => m.type === 'agent.avatar')) as Avatar
    expect(set.agentId).toBe(id)
    expect(set.file).toMatch(/\.png$/)
    expect(host.session.snapshot().agents.find(a => a.id === id)?.avatar).toBe(set.file)

    const onDisk = path.join(host.repoPath, '.crew', 'attachments', set.file!)
    expect(fs.readFileSync(onDisk).equals(PNG)).toBe(true)
    expect(host.store.loadSession()?.agents.find(a => a.id === id)?.avatar).toBe(set.file)

    ui.send({ type: 'agent.avatar', agentId: id, image: null })
    const cleared = (await other.waitFor(m => m.type === 'agent.avatar' && m.file === null)) as Avatar
    expect(cleared.agentId).toBe(id)
    expect(host.session.snapshot().agents.find(a => a.id === id)?.avatar).toBeUndefined()
    expect(host.store.loadSession()?.agents.find(a => a.id === id)?.avatar).toBeUndefined()
  })

  it('refuses a photo from someone who does not own the agent, and files that are not images', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui, sam)
    await bringAgent()
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    sam.send({ type: 'agent.avatar', agentId: id, image: image('mine.png') })
    ui.send({ type: 'agent.avatar', agentId: id, image: image('notes.pdf', 'application/pdf') })
    await new Promise(r => setTimeout(r, 300))
    expect(sam.messages.some(m => m.type === 'agent.avatar')).toBe(false)
    expect(host.session.snapshot().agents.find(a => a.id === id)?.avatar).toBeUndefined()

    ui.send({ type: 'agent.avatar', agentId: id, image: image() })
    await waitUntil(() => host.session.snapshot().agents.some(a => a.id === id && !!a.avatar))
  })
})
