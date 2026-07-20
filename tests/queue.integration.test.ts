import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Routed = Extract<SessionEvent, { kind: 'message.route' }>

describe('queued messages', () => {
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

  async function queuedFollowUp(ui: TestUi, text: string) {
    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.chat(text, [], started.threadId)
    const routed = (await ui.waitForEvent(e => e.kind === 'message.route' && e.mode === 'queued')) as Routed
    return { started, routed }
  }

  it('edits a queued message before it runs', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { routed } = await queuedFollowUp(ui, 'first draft')
    ui.send({ type: 'queue.edit', promptId: routed.promptId, text: 'final version' })
    await ui.waitForEvent(e => e.kind === 'message.edited' && e.messageId === routed.messageId)

    const start = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.promptId === routed.promptId
    )) as Extract<SessionEvent, { kind: 'agent.start' }>
    expect(start.promptText).toBe('final version')
  })

  it('removes a queued message so it never runs', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { started, routed } = await queuedFollowUp(ui, 'never mind')
    ui.send({ type: 'queue.remove', promptId: routed.promptId })
    await ui.waitForEvent(e => e.kind === 'message.deleted' && e.messageId === routed.messageId)

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)
    await new Promise(r => setTimeout(r, 300))
    const startedRemoved = uis[0].events.some(e => e.kind === 'agent.start' && e.promptId === routed.promptId)
    expect(startedRemoved).toBe(false)
  })
})
