import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

const saved = { instanceId: 'a', provider: 'fake', name: 'Bubbles', settings: {} }
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

  function app(name: string, agents: Array<Record<string, unknown>>): Runner {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: agents as never,
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    return runner
  }

  async function ownerOf(agent: string): Promise<string | undefined> {
    const ui = await TestUi.connect(host.url, `watcher-${agent}-${uis.length}`, host.code)
    uis.push(ui)
    const welcome = ui.messages.find(m => m.type === 'welcome')
    if (welcome?.type !== 'welcome') return undefined
    return welcome.snapshot.agents.find(a => a.id === agent)?.ownerName
  }

  it('keeps the agent with the account that registered it', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')
    expect(await ownerOf(id)).toBe('jamel')

    app('jamel (dev)', [{ ...saved, id }])
    await waitUntil(() => host.memberNames().includes('jamel (dev)'))

    expect(await ownerOf(id)).toBe('jamel')
  })

  it('leaves the running agent alone when the second app disconnects', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')

    const second = app('jamel (dev)', [{ ...saved, id }])
    await waitUntil(() => host.memberNames().includes('jamel (dev)'))
    second.close()
    await waitUntil(() => !host.memberNames().includes('jamel (dev)'))

    expect(ui.events.some(e => e.kind === 'agent.offline' && e.agentId === id)).toBe(false)

    ui.chat('go @Bubbles', [id])
    const end = await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === id)
    expect((end as Extract<SessionEvent, { kind: 'agent.end' }>).ok).toBe(true)
    expect(await ownerOf(id)).toBe('jamel')
  })

  it('still adopts an agent whose owner has gone', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const owner = app('jamel', [saved])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Bubbles')
    owner.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline' && e.agentId === id)

    app('jamel (dev)', [{ ...saved, id }])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === id)

    expect(await ownerOf(id)).toBe('jamel (dev)')
  })
})
