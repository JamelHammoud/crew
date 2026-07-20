import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider, makeSteerableProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Route = Extract<SessionEvent, { kind: 'message.route' }>

describe('steering a run in flight', () => {
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

  async function connectRunner(steerable: boolean, env: NodeJS.ProcessEnv = {}) {
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [steerable ? makeSteerableProvider(env) : makeFakeProvider(env)],
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

  const steery = agentId('jamel', 'steery')
  const fake = agentId('jamel', 'fake')

  it('folds a message sent mid-run into the run already in flight', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(true, { FAKE_CLI_DELAY_MS: '700' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('start the work @Steery', [steery])
    const thread = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start

    // Wait for output so we know the run is genuinely under way before steering.
    await ui.waitFor(msg => msg.type === 'agent.step' && msg.promptId === start.promptId)
    ui.chat('actually do it the other way', [], thread.threadId)

    const route = (await ui.waitForEvent(e => e.kind === 'message.route' && e.mode === 'steered')) as Route
    expect(route.promptId).toBe(start.promptId)

    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended
    expect(end.promptId).toBe(start.promptId)
    expect(end.ok).toBe(true)
    // The steer landed inside that same run rather than starting another one.
    expect(end.text).toContain('steered:New message from sam: actually do it the other way')
    expect(ui.events.filter(e => e.kind === 'agent.start')).toHaveLength(1)
  })

  it('queues instead of steering when the agent cannot take a mid-run message', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(false, { FAKE_CLI_DELAY_MS: '400' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('start the work @Fake', [fake])
    const thread = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start

    ui.chat('and one more thing', [], thread.threadId)
    const route = (await ui.waitForEvent(
      e => e.kind === 'message.route' && e.promptId !== start.promptId
    )) as Route
    expect(route.mode).toBe('queued')

    // The queued message gets a run of its own once the first one is done.
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.promptId === route.promptId
    )) as Start
    expect(second.promptText).toBe('and one more thing')
  })

  it('reports a steerable agent so the UI can label the composer', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(true)
    const added = await ui.waitFor(msg => msg.type === 'agent.added')
    expect(added.type === 'agent.added' && added.agent.steerable).toBe(true)
  })

  it('gives a steer its own turn when the run ends before it lands', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(true, { FAKE_CLI_DELAY_MS: '20' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('quick one @Steery', [steery])
    const thread = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended

    ui.chat('follow up', [], thread.threadId)
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.promptId !== first.promptId && e.threadId === thread.threadId
    )) as Start
    expect(second.promptText).toBe('follow up')
  })
})
