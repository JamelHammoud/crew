import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Said = Extract<SessionEvent, { kind: 'message' }>

// The fake CLI reads the whole prompt back, so what the agent was told is
// readable off its reply. These are lines out of the brief itself.
const SAID_OUT_LOUD = 'read back by a voice'
const A_CARD = 'fenced block'

describe('a thread somebody spoke', () => {
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

  async function connectRunner(name: string) {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
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

  async function ready() {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    return sam
  }

  it('tells the agent it is being spoken to, and how to draw a card', async () => {
    const sam = await ready()
    sam.chat('what broke', [fake], undefined, ['voice'])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.voice).toBe(true)
    const ended = (await sam.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId
    )) as Ended
    expect(ended.text).toContain(SAID_OUT_LOUD)
    expect(ended.text).toContain(A_CARD)
  })

  it('keeps telling it on every turn of the same conversation', async () => {
    const sam = await ready()
    sam.chat('first thing', [fake], undefined, ['voice'])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    sam.chat('and the other thing', [], started.threadId)
    const second = (await sam.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && (e.text ?? '').includes('and the other thing')
    )) as Ended
    expect(second.text).toContain(SAID_OUT_LOUD)
  })

  it('says none of it in a thread somebody typed', async () => {
    const sam = await ready()
    sam.chat('what broke @Fake', [fake])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    const ended = (await sam.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId
    )) as Ended
    expect(ended.text).not.toContain(SAID_OUT_LOUD)
  })

  // Pressing the mic never names anybody, so an agent that is here has to take
  // it the way a ghost thread's own agent does.
  it('is taken by an agent who is here without being named', async () => {
    const sam = await ready()
    sam.chat('hello there', [], undefined, ['voice'])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.voice).toBe(true)
    expect(started.agentId).toBe(fake)
  })

  it('says so rather than doing nothing when nobody is here', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    sam.chat('anyone there', [], undefined, ['voice'])
    const said = await sam.waitForEvent(e => e.kind === 'message' && e.authorName === 'crew')
    expect(said.kind === 'message' && said.text).toContain('No agent is here to talk to')
    expect(sam.events.some(e => e.kind === 'thread.started')).toBe(false)
  })

  it('is still a spoken thread after a restart', async () => {
    const sam = await ready()
    sam.chat('remember this', [fake], undefined, ['voice'])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    const revived = new CrewSession(host.store)
    const replayed = revived
      .snapshot()
      .events.find(e => e.kind === 'thread.started' && e.threadId === started.threadId) as Started | undefined
    expect(replayed?.voice).toBe(true)
  })
})
