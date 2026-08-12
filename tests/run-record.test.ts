import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

// What a run took is only ever said live, in a message nothing writes down, so
// the end of the run is where it is kept. Without it a reload, a second member
// and everyone who was not watching have nothing to read at the foot of a
// thread that is already finished.
describe('what a finished run is worth', () => {
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

  async function connectRunner(env: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
      name: 'jamel',
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

  const fake = agentId('jamel', 'fake')

  it('writes down how long it took and what it counted', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner()
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('count me @Fake', [fake])
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended
    expect(end.ok).toBe(true)
    expect(end.ms).toBeGreaterThanOrEqual(0)
    expect(end.tokens).toBeGreaterThan(0)
  })

  // The record is the log's, not the window's. Somebody who connects after the
  // work is over reads the same line as whoever watched it happen.
  it('is still there for a window that never saw the run', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner()
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('count me @Fake', [fake])
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended

    const later = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(later)
    const welcome = (await later.waitFor(m => m.type === 'welcome')) as Extract<ServerMessage, { type: 'welcome' }>
    const seen = welcome.snapshot.events.find((e): e is Ended => e.kind === 'agent.end' && e.promptId === end.promptId)
    expect(seen?.ms).toBe(end.ms)
    expect(seen?.tokens).toBe(end.tokens)
  })

  // A run somebody stopped still spent what it spent, so it keeps its figures
  // the way a run that finished does.
  it('keeps the figures on a run that was stopped', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner({ FAKE_CLI_DELAY_MS: '250', FAKE_CLI_THINK: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('long job @Fake', [fake])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    await ui.waitFor(m => m.type === 'agent.step' && m.promptId === start.promptId && m.step.kind === 'text')
    ui.cancel(start.promptId)

    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === start.promptId)) as Ended
    expect(end.ok).toBe(false)
    expect(end.ms).toBeGreaterThan(0)
  })
})
