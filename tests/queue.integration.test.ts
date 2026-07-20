import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>

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

  function queueOf(threadId: string) {
    return host.session.snapshot().queues[threadId] ?? []
  }

  async function queuedFollowUp(ui: TestUi, text: string) {
    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.chat(text, [], started.threadId)
    await waitUntil(() => queueOf(started.threadId).some(item => item.text === text))
    const item = queueOf(started.threadId).find(q => q.text === text)!
    return { started, item }
  }

  it('keeps a queued message out of the thread until it runs, and applies edits', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { item } = await queuedFollowUp(ui, 'first draft')
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'first draft')).toBe(false)

    ui.send({ type: 'queue.edit', promptId: item.promptId, text: 'final version' })
    const start = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.promptId === item.promptId
    )) as Extract<SessionEvent, { kind: 'agent.start' }>
    expect(start.promptText).toBe('final version')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'final version')
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'first draft')).toBe(false)
  })

  it('removes a queued message so it never runs or appears', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { started, item } = await queuedFollowUp(ui, 'never mind')
    ui.send({ type: 'queue.remove', promptId: item.promptId })
    await waitUntil(() => queueOf(started.threadId).length === 0)

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)
    await new Promise(r => setTimeout(r, 300))
    expect(ui.events.some(e => e.kind === 'agent.start' && e.promptId === item.promptId)).toBe(false)
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'never mind')).toBe(false)
  })
})
