import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId, type AgentDef } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

const saved: AgentDef = { instanceId: 'a', provider: 'fake', name: 'Bubbles', settings: {} }
const id = agentId('jamel', 'a')

describe('agent ownership', () => {
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

  function app(name: string, agents: AgentDef[]): Runner {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents,
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    return runner
  }

  function ownerOf(agent: string): string | undefined {
    return host.session.snapshot().agents.find(a => a.id === agent)?.ownerName
  }

  async function watcher(): Promise<TestUi> {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    return ui
  }

  it('keeps the agent with the account that registered it', async () => {
    const ui = await watcher()
    app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')
    expect(ownerOf(id)).toBe('jamel')

    app('jamel (dev)', [{ ...saved, id }])
    await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'jamel (dev)')

    expect(ownerOf(id)).toBe('jamel')
  })

  it('leaves the running agent alone when the second app disconnects', async () => {
    const ui = await watcher()
    app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')

    const second = app('jamel (dev)', [{ ...saved, id }])
    await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'jamel (dev)')
    second.close()
    await ui.waitForEvent(e => e.kind === 'person.left' && e.name === 'jamel (dev)')

    expect(ui.events.some(e => e.kind === 'agent.offline' && e.agentId === id)).toBe(false)

    ui.chat('go @Bubbles', [id])
    const end = await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === id)
    expect((end as Extract<SessionEvent, { kind: 'agent.end' }>).ok).toBe(true)
    expect(ownerOf(id)).toBe('jamel')
  })

  it('adopts an agent whose owner has gone', async () => {
    const ui = await watcher()
    const owner = app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')
    owner.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline' && e.agentId === id)

    app('jamel (dev)', [{ ...saved, id }])
    await waitUntil(() => ownerOf(id) === 'jamel (dev)')

    expect(ownerOf(id)).toBe('jamel (dev)')
  })
})
