import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'
import { CrewSession } from '../src/server/session'
import { Store } from '../src/server/store'
import { createCrewServer } from '../src/server/index'

describe('reconnect', () => {
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

  async function connectRunner(name: string, env: NodeJS.ProcessEnv = {}) {
    const runner = new Runner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider(env)],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
    return runner
  }

  it('fails an in-flight prompt when the runner drops', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '500' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('slow @Fake', [agentId('jamel', 'fake')])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    runner.dropConnection()

    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.promptId === start.promptId
    )) as Extract<SessionEvent, { kind: 'agent.end' }>
    expect(end.ok).toBe(false)
    expect(end.error).toContain('disconnected')
    await ui.waitForEvent(e => e.kind === 'agent.offline')
  })

  it('resumes taking prompts after the runner reconnects', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = await connectRunner('jamel')
    const firstOnline = await ui.waitForEvent(e => e.kind === 'agent.online')

    runner.dropConnection()
    await ui.waitForEvent(e => e.kind === 'agent.offline')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e !== firstOnline)

    ui.chat('back again @Fake', [agentId('jamel', 'fake')])
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.ok)) as Extract<
      SessionEvent,
      { kind: 'agent.end' }
    >
    expect(end.text).toContain('back again @Fake')
  })

  it('keeps history when the host restarts', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')
    ui.chat('remember this @Fake', [agentId('jamel', 'fake')])
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.ok)
    ui.close()

    for (const runner of runners) runner.close()
    runners = []
    const repoPath = host.repoPath
    await host.close()

    const store = new Store(repoPath)
    const session = new CrewSession(store)
    const server = await createCrewServer(session, { port: 0, host: '127.0.0.1' })
    host = {
      server,
      session,
      store,
      code: session.code,
      url: `ws://127.0.0.1:${server.port()}/ws`,
      repoPath,
      close: () => server.close()
    }

    const ui2 = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui2)
    const welcome = ui2.messages.find(m => m.type === 'welcome') as Extract<
      import('../src/shared/protocol').ServerMessage,
      { type: 'welcome' }
    >
    const texts = welcome.snapshot.events
      .filter((e): e is Extract<SessionEvent, { kind: 'message' }> => e.kind === 'message')
      .map(e => e.text)
    expect(texts).toContain('remember this @Fake')
    const fake = welcome.snapshot.agents.find(a => a.id === agentId('jamel', 'fake'))
    expect(fake?.status).toBe('offline')
  })
})
