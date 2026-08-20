import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { agentId } from '../src/shared/llm'
import {
  cleanPlugin,
  cleanPluginName,
  installPlugin,
  mcpServersOf,
  offerForAppUrl,
  pluginApprovalFingerprint,
  pluginApprovalTarget,
  pluginCanLaunch,
  PLUGIN_BLURB_LIMIT,
  PLUGIN_CATALOG,
  PLUGIN_FULL,
  PLUGIN_LIMIT,
  PLUGIN_OFFERS,
  pluginMenuInput,
  pluginNamed,
  pluginTyped,
  resolvePlugin,
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
  url: 'https://mcp.linear.app/sse'
}

const add = (plugin: unknown) => ({ type: 'plugin.add' as const, plugin: installPlugin(plugin as CrewPlugin) })

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
    expect(landed.plugin).toEqual({ catalogId: 'playwright', name: 'playwright' })
    expect(landed.byName).toBe('sam')

    const [plugin] = pluginsIn(host)
    expect(plugin).toMatchObject({
      id: landed.pluginId,
      name: 'playwright',
      catalogId: 'playwright',
      by: 'sam'
    })
    expect(resolvePlugin(plugin)).toMatchObject({
      label: 'Playwright',
      blurb: 'Open a page and click through it',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@playwright/mcp@0.0.79'],
      packageId: 'playwright-mcp'
    })
    expect(plugin.id).toMatch(/^[0-9a-f]{6}$/)

    pat.send(add(LINEAR))
    await waitUntil(() => pluginsIn(host).length === 2)
    expect(pluginsIn(host)[1]).toMatchObject({
      name: 'linear',
      catalogId: 'linear',
      by: 'pat'
    })
    expect(resolvePlugin(pluginsIn(host)[1]!)).toMatchObject({
      transport: 'http',
      url: 'https://mcp.linear.app/mcp'
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
    expect(pluginsIn(host)[0]).toMatchObject({ id: first.pluginId, catalogId: 'playwright', name: 'playwright' })
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
    expect(prompt.plugins).toEqual([expect.objectContaining({ catalogId: 'playwright', name: 'playwright' })])
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
  it('keeps Raylight editing separate from the MCP it gives agents', () => {
    const raylight = PLUGIN_OFFERS.find(offer => offer.name === 'raylight')!
    expect(raylight).toMatchObject({
      url: 'https://api.raylight.app/mcp',
      appUrl: 'https://www.raylight.app/projects'
    })
    const saved = cleanPlugin(raylight)!
    expect(saved).toEqual({ catalogId: 'raylight', name: 'raylight' })
    expect(resolvePlugin(saved)).toMatchObject({
      url: 'https://api.raylight.app/mcp',
      appUrl: 'https://www.raylight.app/projects'
    })
    expect(offerForAppUrl('https://raylight.app/editor/launch-video')?.name).toBe('raylight')
    expect(offerForAppUrl('https://raylight.app/account')).toBeUndefined()
    expect(offerForAppUrl('https://not-raylight.app/editor/launch-video')).toBeUndefined()
  })

  it('refreshes a legacy Raylight installation without reinstalling it', () => {
    const legacy: CrewPlugin = {
      id: 'old-raylight',
      name: 'raylight',
      label: 'Old Raylight',
      blurb: 'Old copy',
      transport: 'http',
      url: 'https://api.raylight.app/old',
      by: 'Jamel',
      ts: 1
    }
    const resolved = resolvePlugin(legacy)
    expect(resolved).toMatchObject({
      id: legacy.id,
      catalogId: 'raylight',
      label: 'Raylight',
      url: 'https://api.raylight.app/mcp',
      appUrl: 'https://www.raylight.app/projects',
      trusted: true,
      authentication: 'oauth'
    })
    expect(pluginCanLaunch(legacy)).toBe(true)
    expect(pluginNamed('/raylight', [legacy])).toBe(legacy)
  })

  it('refreshes Linear from its retired SSE endpoint', () => {
    const legacy: CrewPlugin = {
      id: 'old-linear',
      name: 'linear',
      label: 'Linear',
      blurb: '',
      transport: 'http',
      url: 'https://mcp.linear.app/sse',
      by: 'Jamel',
      ts: 1
    }
    expect(resolvePlugin(legacy).url).toBe('https://mcp.linear.app/mcp')
    expect(mcpServersOf([legacy])).toEqual({ linear: { type: 'http', url: 'https://mcp.linear.app/mcp' } })
  })

  it('matches every installed plugin alias', () => {
    const raylight = { ...PLUGIN_OFFERS.find(offer => offer.name === 'raylight')!, id: 'r', by: 'Jamel', ts: 1 }
    const figma = { ...PLUGIN_OFFERS.find(offer => offer.name === 'figma')!, id: 'f', by: 'Jamel', ts: 1 }
    expect(pluginTyped('/raylight ', [raylight, figma])).toBe(raylight)
    expect(pluginNamed('/raylight', [raylight, figma])).toBe(raylight)
    expect(pluginTyped('/figma ', [raylight, figma])).toBe(figma)
    expect(pluginTyped('/raylight', [raylight])).toBeNull()
    expect(pluginMenuInput('/plugin ray')).toBe(true)
  })

  it('drops an unsafe editing address without dropping the MCP', () => {
    const clean = cleanPlugin({
      name: 'unsafe-app',
      label: 'Unsafe app',
      blurb: '',
      transport: 'http',
      url: 'https://mcp.example.com',
      appUrl: 'javascript:alert(1)'
    })
    expect(clean).toMatchObject({ url: 'https://mcp.example.com/' })
    expect(clean).not.toHaveProperty('appUrl')
  })

  it('offers nothing that wants a key typed in', () => {
    for (const offer of PLUGIN_OFFERS) expect(offer.keys ?? []).toEqual([])
  })

  it('holds runtime identity and trust policy outside saved installations', () => {
    const playwright = PLUGIN_CATALOG.find(plugin => plugin.id === 'playwright')!
    const chrome = PLUGIN_CATALOG.find(plugin => plugin.id === 'chrome-devtools')!
    expect(playwright.transport).toMatchObject({
      kind: 'stdio',
      packageId: 'playwright-mcp',
      packageName: '@playwright/mcp',
      version: '0.0.79'
    })
    expect(chrome.transport).toMatchObject({
      kind: 'stdio',
      packageId: 'chrome-devtools-mcp',
      version: '1.7.0'
    })
    expect(JSON.stringify(PLUGIN_CATALOG)).not.toContain('@latest')
    for (const plugin of PLUGIN_CATALOG) {
      expect(plugin.allowedOrigins).toBeInstanceOf(Array)
      expect(plugin.documentationUrl).toMatch(/^https:\/\//)
    }
  })

  it('fingerprints only custom endpoints and commands for approval', async () => {
    const remote = {
      name: 'private-service',
      transport: 'http' as const,
      url: 'https://mcp.example.com/tools'
    }
    const command = {
      name: 'private-command',
      transport: 'stdio' as const,
      command: '/opt/private-mcp',
      args: ['--safe']
    }
    expect(pluginApprovalTarget(remote)).toBe('origin:https://mcp.example.com')
    expect(await pluginApprovalFingerprint(remote)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(await pluginApprovalFingerprint({ ...remote, url: 'https://mcp.example.com/other' })).toBe(
      await pluginApprovalFingerprint(remote)
    )
    expect(await pluginApprovalFingerprint({ ...remote, url: 'https://other.example.com/tools' })).not.toBe(
      await pluginApprovalFingerprint(remote)
    )
    expect(await pluginApprovalFingerprint(command)).not.toBe(
      await pluginApprovalFingerprint({ ...command, args: ['--unsafe'] })
    )
    expect(pluginApprovalTarget({ name: 'raylight' })).toBeNull()
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
      expect(clean?.catalogId).toBe(offer.catalogId)
      expect(resolvePlugin(clean!).transport).toBe(offer.transport)
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
    expect(Object.keys(mcpServersOf(held.slice(0, PLUGIN_LIMIT)))).toHaveLength(Math.min(held.length, PLUGIN_LIMIT))
  })
})
