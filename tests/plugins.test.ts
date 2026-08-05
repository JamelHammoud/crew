import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { agentId } from '../src/shared/llm'
import {
  cleanPlugin,
  cleanPluginName,
  mcpServersOf,
  PLUGIN_BLURB_LIMIT,
  PLUGIN_FULL,
  PLUGIN_LIMIT,
  PLUGIN_OFFERS,
  type CrewPlugin
} from '../src/shared/plugins'
import type { RegisteredLlm, ServerMessage } from '../src/shared/protocol'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Notice = Extract<ServerMessage, { type: 'notice' }>
type Prompt = Extract<ServerMessage, { type: 'prompt' }>

const PLAYWRIGHT = {
  name: 'Playwright',
  label: 'Playwright',
  blurb: 'Open a page and click through it',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@playwright/mcp@latest']
}

const LINEAR = {
  name: 'linear',
  label: 'Linear',
  blurb: 'The issues and what is on them',
  transport: 'http',
  url: 'https://mcp.example.com/linear'
}

const add = (plugin: unknown) => ({ type: 'plugin.add' as const, plugin })

const pluginsIn = (host: TestHost): CrewPlugin[] => host.session.snapshot().plugins ?? []

interface FakeRunner {
  ws: WebSocket
  messages: ServerMessage[]
}

async function runnerOn(host: TestHost, name: string, llms: RegisteredLlm[] = []): Promise<FakeRunner> {
  const ws = new WebSocket(host.url)
  const runner: FakeRunner = { ws, messages: [] }
  ws.on('message', raw => runner.messages.push(JSON.parse(raw.toString()) as ServerMessage))
  await new Promise<void>((resolve, reject) => {
    ws.on('error', reject)
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', role: 'runner', name, code: host.code, llms }))
      resolve()
    })
  })
  return runner
}

describe('what the crew has plugged in', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let runners: FakeRunner[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.ws.close()
    uis = []
    runners = []
    await host.close()
  })

  it('takes one from anybody here and hands it to everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(add(PLAYWRIGHT))
    const landed = await pat.waitForEvent(e => e.kind === 'plugin.added')
    if (landed.kind !== 'plugin.added') throw new Error('expected plugin.added')
    expect(landed.plugin).toMatchObject({ name: 'playwright', transport: 'stdio', command: 'npx' })
    expect(landed.byName).toBe('sam')

    const [plugin] = pluginsIn(host)
    expect(plugin).toMatchObject({
      id: landed.pluginId,
      name: 'playwright',
      label: 'Playwright',
      blurb: 'Open a page and click through it',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp@latest'],
      by: 'sam'
    })
    expect(plugin.id).toMatch(/^[0-9a-f]{6}$/)

    pat.send(add(LINEAR))
    await waitUntil(() => pluginsIn(host).length === 2)
    expect(pluginsIn(host)[1]).toMatchObject({
      name: 'linear',
      transport: 'http',
      url: 'https://mcp.example.com/linear',
      by: 'pat'
    })
  })

  it('rides in the snapshot rather than in the chat, and comes back off the log', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send(add(PLAYWRIGHT))
    await sam.waitForEvent(e => e.kind === 'plugin.added')

    const late = await TestUi.connect(host.url, 'robin', host.code)
    uis.push(late)
    const welcome = late.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.snapshot.plugins).toHaveLength(1)
    expect(welcome.snapshot.events.some(event => event.kind.startsWith('plugin.'))).toBe(false)

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.plugins).toEqual([expect.objectContaining({ name: 'playwright', by: 'sam' })])
    expect(revived.events.some(event => event.kind.startsWith('plugin.'))).toBe(false)
  })

  it('reads the same plugin added twice as one', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send(add(PLAYWRIGHT))
    const first = await sam.waitForEvent(e => e.kind === 'plugin.added')
    if (first.kind !== 'plugin.added') throw new Error('expected plugin.added')

    sam.send(add({ ...PLAYWRIGHT, name: 'PLAYWRIGHT', label: 'Playwright again', command: 'pnpm' }))
    await new Promise(r => setTimeout(r, 250))

    expect(pluginsIn(host)).toHaveLength(1)
    expect(pluginsIn(host)[0]).toMatchObject({ id: first.pluginId, label: 'Playwright', command: 'npx' })
    expect(sam.events.filter(e => e.kind === 'plugin.added')).toHaveLength(1)
  })

  it('refuses a full store with the move to make, rather than dropping the oldest', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    for (let at = 0; at < PLUGIN_LIMIT; at++) sam.send(add({ ...PLAYWRIGHT, name: `plugin-${at}` }))
    await waitUntil(() => pluginsIn(host).length === PLUGIN_LIMIT)

    sam.send(add({ ...PLAYWRIGHT, name: 'one-too-many' }))
    const notice = (await sam.waitFor(m => m.type === 'notice')) as Notice
    expect(notice.text).toBe(PLUGIN_FULL)
    expect(pluginsIn(host)).toHaveLength(PLUGIN_LIMIT)
    expect(pluginsIn(host).some(one => one.name === 'one-too-many')).toBe(false)
  })

  it('turns away a record it cannot run', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send(add({ ...PLAYWRIGHT, name: '   ' }))
    sam.send(add({ name: 'nothing-to-run', label: 'Nothing', blurb: '', transport: 'stdio' }))
    sam.send(add({ name: 'not-a-url', label: 'Nope', blurb: '', transport: 'http', url: 'ftp://example.com/mcp' }))
    sam.send(add(null))
    await new Promise(r => setTimeout(r, 250))

    expect(pluginsIn(host)).toHaveLength(0)
    expect(sam.events.some(e => e.kind === 'plugin.added')).toBe(false)
  })

  it('takes one out for everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send(add(PLAYWRIGHT))
    const added = await pat.waitForEvent(e => e.kind === 'plugin.added')
    if (added.kind !== 'plugin.added') throw new Error('expected plugin.added')

    pat.send({ type: 'plugin.remove', pluginId: added.pluginId })
    const gone = await sam.waitForEvent(e => e.kind === 'plugin.removed')
    if (gone.kind !== 'plugin.removed') throw new Error('expected plugin.removed')
    expect(gone.pluginId).toBe(added.pluginId)
    await waitUntil(() => pluginsIn(host).length === 0)
    expect(new CrewSession(host.store).snapshot().plugins).toEqual([])
  })

  it('leaves them to the crew rather than to a runner', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.send(add(PLAYWRIGHT))
    const added = await sam.waitForEvent(e => e.kind === 'plugin.added')
    if (added.kind !== 'plugin.added') throw new Error('expected plugin.added')

    const runner = await runnerOn(host, 'mac')
    runners.push(runner)
    runner.ws.send(JSON.stringify(add({ ...PLAYWRIGHT, name: 'theirs' })))
    runner.ws.send(JSON.stringify({ type: 'plugin.remove', pluginId: added.pluginId }))
    await new Promise(r => setTimeout(r, 250))

    expect(pluginsIn(host)).toHaveLength(1)
    expect(pluginsIn(host)[0]).toMatchObject({ id: added.pluginId, name: 'playwright' })
  })

  it('puts what the crew has plugged in on every prompt going out', async () => {
    const runner = await runnerOn(host, 'mac', [
      { instanceId: 'fake', provider: 'fake', label: 'Fake', fields: [], settings: {} }
    ])
    runners.push(runner)
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await waitUntil(() => host.session.snapshot().agents.length > 0)

    sam.send(add(PLAYWRIGHT))
    await sam.waitForEvent(e => e.kind === 'plugin.added')

    sam.chat('open the signup page', [agentId('mac', 'fake')])
    await waitUntil(() => runner.messages.some(m => m.type === 'prompt'))
    const prompt = runner.messages.find(m => m.type === 'prompt') as Prompt
    expect(prompt.plugins).toEqual([
      expect.objectContaining({ name: 'playwright', transport: 'stdio', command: 'npx' })
    ])
  })

  it('says nothing about plugins on a prompt when the crew has none', async () => {
    const runner = await runnerOn(host, 'mac', [
      { instanceId: 'fake', provider: 'fake', label: 'Fake', fields: [], settings: {} }
    ])
    runners.push(runner)
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await waitUntil(() => host.session.snapshot().agents.length > 0)

    sam.chat('do the thing', [agentId('mac', 'fake')])
    await waitUntil(() => runner.messages.some(m => m.type === 'prompt'))
    const prompt = runner.messages.find(m => m.type === 'prompt') as Prompt
    expect(prompt.plugins).toBeUndefined()
  })
})

describe('what the store offers', () => {
  it('offers nothing that wants a key typed in', () => {
    for (const offer of PLUGIN_OFFERS) expect(offer.keys ?? []).toEqual([])
  })

  it('names each one once', () => {
    const names = PLUGIN_OFFERS.map(one => one.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(cleanPluginName(name)).toBe(name)
  })

  it('holds every offer to what a plugin may be', () => {
    for (const offer of PLUGIN_OFFERS) {
      const clean = cleanPlugin(offer)
      expect(clean, offer.name).not.toBeNull()
      expect(clean?.name).toBe(offer.name)
      expect(clean?.transport).toBe(offer.transport)
      expect(offer.blurb.length).toBeLessThanOrEqual(PLUGIN_BLURB_LIMIT)
    }
  })

  it('reaches every remote over https, and this computer over loopback', () => {
    for (const offer of PLUGIN_OFFERS) {
      if (offer.transport !== 'http') {
        expect(offer.command, offer.name).toBeTruthy()
        continue
      }
      const url = new URL(offer.url!)
      if (url.protocol === 'http:') expect(url.hostname).toBe('127.0.0.1')
      else expect(url.protocol).toBe('https:')
    }
  })

  it('runs every one of them, since none of them wants a key', () => {
    const held = PLUGIN_OFFERS.map((offer, i) => ({ ...offer, id: `${i}`, by: 'Jamel', ts: i }))
    expect(Object.keys(mcpServersOf(held.slice(0, PLUGIN_LIMIT)))).toHaveLength(
      Math.min(held.length, PLUGIN_LIMIT)
    )
  })
})
