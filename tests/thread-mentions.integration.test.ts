import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

describe('thread mentions', () => {
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

  async function connectRunner(name: string, providers = [makeFakeProvider()]) {
    const runner = new Runner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers,
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
  const buddy = agentId('jamel', 'buddy')

  it('mentioning another agent hands the next turn to them with the transcript', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', [makeFakeProvider(), makeFakeProvider({}, 'buddy', 'Buddy')])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === buddy)

    ui.chat('remember apple @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    ui.chat('pick this up @Buddy', [buddy], started.threadId)
    const handoff = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.agentId === buddy
    )) as Ended

    expect(handoff.ok).toBe(true)
    expect(handoff.text).toContain('pick this up')
    expect(handoff.text).toContain('remember apple')
    expect(ui.events.filter(e => e.kind === 'thread.started').length).toBe(1)
  })

  it('one message mentioning two agents runs each of them once', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', [makeFakeProvider(), makeFakeProvider({}, 'buddy', 'Buddy')])
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === buddy)

    ui.chat('kick off @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended

    ui.chat('both of you @Fake @Buddy', [fake, buddy], started.threadId)
    const ends: Ended[] = []
    for (let i = 0; i < 2; i++) {
      const end = (await ui.waitForEvent(
        e =>
          e.kind === 'agent.end' &&
          e.threadId === started.threadId &&
          e.promptId !== first.promptId &&
          !ends.some(seen => seen.promptId === e.promptId)
      )) as Ended
      ends.push(end)
    }

    expect(new Set(ends.map(e => e.agentId))).toEqual(new Set([fake, buddy]))
    for (const end of ends) expect(end.text).toContain('both of you')
    const copies = ui.events.filter(e => e.kind === 'message' && e.text === 'both of you @Fake @Buddy')
    expect(copies.length).toBe(1)
  })

  it('a mentioned agent picks up a thread whose own agent went offline', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const fakeRunner = await connectRunner('jamel')
    await connectRunner('ali', [makeFakeProvider({}, 'buddy', 'Buddy')])
    const aliBuddy = agentId('ali', 'buddy')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === aliBuddy)

    ui.chat('remember apple @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    fakeRunner.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline' && e.agentId === fake)

    ui.chat('carry on @Buddy', [aliBuddy], started.threadId)
    const handoff = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.agentId === aliBuddy
    )) as Ended

    expect(handoff.ok).toBe(true)
    expect(handoff.text).toContain('carry on')
    expect(handoff.text).toContain('remember apple')
  })
})
