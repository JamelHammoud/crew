import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { ServerMessage } from '../src/shared/protocol'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

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
    const runner = new Runner({
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
    const runner = new Runner({
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
    const added = (await ui.waitFor(m => m.type === 'agent.added')) as Extract<ServerMessage, { type: 'agent.added' }>
    expect(added.agent.label).toBe('Fake X')
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
})
