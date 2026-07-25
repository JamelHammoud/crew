import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

describe('agent instances', () => {
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

  it('runs two instances of one provider concurrently', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '300' })],
      agents: [
        { instanceId: 'a', provider: 'fake', name: 'Fake A', settings: {} },
        { instanceId: 'b', provider: 'fake', name: 'Fake B', settings: {} }
      ],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake A')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake B')

    const idA = agentId('jamel', 'a')
    const idB = agentId('jamel', 'b')
    ui.chat('go a @Fake A', [idA])
    ui.chat('go b @Fake B', [idB])

    const endA = await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === idA)
    expect((endA as Extract<SessionEvent, { kind: 'agent.end' }>).ok).toBe(true)

    const startA = ui.events.findIndex(e => e.kind === 'agent.start' && e.agentId === idA)
    const startB = ui.events.findIndex(e => e.kind === 'agent.start' && e.agentId === idB)
    const finishA = ui.events.findIndex(e => e.kind === 'agent.end' && e.agentId === idA)
    expect(startA).toBeGreaterThanOrEqual(0)
    expect(startB).toBeGreaterThanOrEqual(0)
    expect(startB).toBeLessThan(finishA)
  })

  it('adds an agent at runtime and makes it mentionable, then removes it', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'base', provider: 'fake', name: 'Fake', settings: {} }],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    runner.addAgent({ instanceId: 'x', provider: 'fake', name: 'Fake X', settings: {} })
    const added = (await ui.waitFor(
      m => m.type === 'agent.added' && m.agent.label === 'Fake X'
    )) as Extract<ServerMessage, { type: 'agent.added' }>
    expect(added.agent.id).toBe(agentId('jamel', 'x'))
    const online = (await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake X')) as Extract<
      SessionEvent,
      { kind: 'agent.online' }
    >
    expect(online.agentId).toBe(agentId('jamel', 'x'))

    ui.chat('hello @Fake X', [agentId('jamel', 'x')])
    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.agentId === agentId('jamel', 'x')
    )) as Extract<SessionEvent, { kind: 'agent.end' }>
    expect(end.ok).toBe(true)
    expect(end.text).toContain('hello @Fake X')

    runner.removeAgent('x')
    const removed = (await ui.waitFor(
      m => m.type === 'agent.removed' && m.agentId === agentId('jamel', 'x')
    )) as Extract<ServerMessage, { type: 'agent.removed' }>
    expect(removed.agentId).toBe(agentId('jamel', 'x'))
  })

  // The server remembers agents across restarts. If the owner's machine lost
  // the local definition (a wiped store), the agent must not sit offline
  // forever on its own machine: the runner re-adopts it from the snapshot.
  it('re-adopts its own offline agent when the local definition was lost', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const first = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'uuid-1', provider: 'fake', name: 'Fake Fable', settings: { model: 'large' } }],
      reconnectDelayMs: 100
    })
    runners.push(first)
    first.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake Fable')
    first.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline' && e.label === 'Fake Fable')

    const adopted: Array<{ instanceId: string; provider: string; name: string }> = []
    const second = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [],
      reconnectDelayMs: 100,
      onAdopt: def => adopted.push(def)
    })
    runners.push(second)
    second.connect(host.url)

    // waitForEvent matches history, so wait for the second online — the adoption.
    const onlines = () =>
      ui.events.filter(e => e.kind === 'agent.online' && e.label === 'Fake Fable') as Array<
        Extract<SessionEvent, { kind: 'agent.online' }>
      >
    await waitUntil(() => onlines().length >= 2)
    expect(onlines()[1].agentId).toBe(agentId('jamel', 'uuid-1'))
    expect(adopted).toEqual([{ instanceId: 'uuid-1', provider: 'fake', name: 'Fake Fable', settings: { model: 'large' } }])

    // And it actually runs: the whole point of adoption.
    ui.chat('hello again @Fake Fable', [agentId('jamel', 'uuid-1')])
    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.agentId === agentId('jamel', 'uuid-1')
    )) as Extract<SessionEvent, { kind: 'agent.end' }>
    expect(end.ok).toBe(true)
  })

  // An installed CLI is not an agent: a runner brings only what it was given.
  it('enrolls nothing on its own', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await waitUntil(() => ui.events.some(e => e.kind === 'person.joined' && e.name === 'jamel'))
    await new Promise(r => setTimeout(r, 300))
    expect(host.session.snapshot().agents).toEqual([])
    expect(ui.events.some(e => e.kind === 'agent.online')).toBe(false)
  })

  it('renames your own agent and tells your machine about it', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    uis.push(ui)
    const renames: Array<[string, string]> = []
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'uuid-1', provider: 'fake', name: 'Fake', settings: {} }],
      reconnectDelayMs: 100,
      onRename: (instanceId, label) => renames.push([instanceId, label])
    })
    runners.push(runner)
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    const id = agentId('jamel', 'uuid-1')
    ui.send({ type: 'agent.rename', agentId: id, label: 'Trolls' })
    const renamed = (await ui.waitFor(m => m.type === 'agent.renamed')) as Extract<
      ServerMessage,
      { type: 'agent.renamed' }
    >
    expect(renamed.agentId).toBe(id)
    expect(renamed.label).toBe('Trolls')
    await waitUntil(() => renames.length === 1)
    expect(renames[0]).toEqual(['uuid-1', 'Trolls'])
    expect(host.session.snapshot().agents.find(a => a.id === id)?.label).toBe('Trolls')
  })

  it('refuses a rename from someone who does not own the agent', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
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
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    sam.send({ type: 'agent.rename', agentId: agentId('jamel', 'uuid-1'), label: 'Not yours' })
    await new Promise(r => setTimeout(r, 300))
    expect(sam.messages.some(m => m.type === 'agent.renamed')).toBe(false)
    expect(host.session.snapshot().agents[0].label).toBe('Fake')
  })

  it('lets anyone remove an agent they do not own, and it stays gone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    const forgotten: string[] = []
    const def = { instanceId: 'uuid-1', provider: 'fake', name: 'Fake', settings: {} }
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [def],
      reconnectDelayMs: 100,
      onForget: instanceId => forgotten.push(instanceId)
    })
    runners.push(runner)
    runner.connect(host.url)
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    const id = agentId('jamel', 'uuid-1')
    sam.send({ type: 'agent.remove', agentId: id })
    await sam.waitFor(m => m.type === 'agent.removed' && m.agentId === id)
    await waitUntil(() => forgotten.length === 1)
    expect(forgotten).toEqual(['uuid-1'])
    expect(host.session.snapshot().agents).toEqual([])

    // A machine still holding the old definition must not bring it back.
    const stale = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [def],
      reconnectDelayMs: 100
    })
    runners.push(stale)
    stale.connect(host.url)
    await new Promise(r => setTimeout(r, 500))
    expect(sam.messages.filter(m => m.type === 'agent.added' && m.agent.id === id)).toHaveLength(1)
    expect(host.session.snapshot().agents).toEqual([])
  })

  it('does not adopt agents owned by someone else', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const alis = testRunner({
      name: 'ali',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'uuid-2', provider: 'fake', name: 'Alis Fake', settings: {} }],
      reconnectDelayMs: 100
    })
    runners.push(alis)
    alis.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Alis Fake')
    alis.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline' && e.label === 'Alis Fake')

    const adopted: string[] = []
    const jamels = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'own', provider: 'fake', name: 'Own Fake', settings: {} }],
      reconnectDelayMs: 100,
      onAdopt: def => adopted.push(def.instanceId)
    })
    runners.push(jamels)
    jamels.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Own Fake')
    // A wrong adoption would surface as a second "Alis Fake" online; give it room.
    await new Promise(r => setTimeout(r, 300))
    expect(ui.events.filter(e => e.kind === 'agent.online' && e.label === 'Alis Fake')).toHaveLength(1)
    expect(adopted).toEqual([])
  })
})
