import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider, makeSteerableProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Notice = Extract<ServerMessage, { type: 'notice' }>

const settle = () => new Promise(r => setTimeout(r, 300))

describe('commands inside a thread', () => {
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

  async function connectRunner(name: string, steerable: boolean, env: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
      name,
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

  async function connectUi(name: string) {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  const steery = agentId('sam', 'steery')
  const patsFake = agentId('pat', 'fake')

  it('/queue holds a message back from a run that would have taken it', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', true, { FAKE_CLI_DELAY_MS: '700' })
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('start the work @Steery', [steery])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await sam.waitForEvent(e => e.kind === 'agent.start')) as Start
    await sam.waitFor(msg => msg.type === 'agent.step' && msg.promptId === first.promptId)

    sam.chat('and the changelog', [], thread.threadId, undefined, ['queue'])

    // It waits its turn and gets a run of its own, rather than being folded into
    // the one already going the way it would have been.
    const second = (await sam.waitForEvent(
      e => e.kind === 'agent.start' && e.promptId !== first.promptId && e.threadId === thread.threadId
    )) as Start
    expect(second.promptText).toBe('and the changelog')
    expect(sam.events.some(e => e.kind === 'message.route' && e.mode === 'steered')).toBe(false)

    const held = sam.messages.filter(
      m => m.type === 'queue.state' && m.threadId === thread.threadId && m.items.length > 0
    )
    expect(held.length).toBeGreaterThan(0)
  })

  it('goes into the run in flight without it', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', true, { FAKE_CLI_DELAY_MS: '700' })
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('start the work @Steery', [steery])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await sam.waitForEvent(e => e.kind === 'agent.start')) as Start
    await sam.waitFor(msg => msg.type === 'agent.step' && msg.promptId === first.promptId)

    sam.chat('and the changelog', [], thread.threadId, undefined, ['steer'])
    const route = await sam.waitForEvent(e => e.kind === 'message.route' && e.mode === 'steered')
    expect(route.kind === 'message.route' && route.promptId).toBe(first.promptId)
    expect(sam.events.filter(e => e.kind === 'agent.start')).toHaveLength(1)
  })

  it('/btw answers on the side, reading the thread and saying nothing in it', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Steery tidy the readme', [steery])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    sam.chat('what is a changelog for', [], thread.threadId, undefined, ['btw'])
    const aside = (await sam.waitForEvent(
      e => e.kind === 'thread.started' && e.threadId !== thread.threadId
    )) as Started
    expect(aside.aside).toBe(thread.threadId)
    expect(aside.ghost).toBe(true)

    const answer = (await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === aside.threadId)) as Ended
    // The fake CLI echoes its prompt, so the answer says what it was handed: the
    // thread it was asked about, and the question.
    expect(answer.text).toContain('tidy the readme')
    expect(answer.text).toContain('what is a changelog for')
    expect(answer.text).toContain('This is a question asked on the side')
    await settle()

    // Nothing about it landed in the thread it was asked from.
    const inThread = sam.events.filter(e => 'threadId' in e && e.threadId === thread.threadId)
    expect(inThread.some(e => e.kind === 'message' && e.text === 'what is a changelog for')).toBe(false)
    expect(inThread.filter(e => e.kind === 'agent.start')).toHaveLength(1)
  })

  it('a question on the side reaches nobody else and is written down nowhere', async () => {
    const sam = await connectUi('sam')
    const samSecondWindow = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Steery tidy the readme', [steery])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    sam.chat('what is a changelog for', [], thread.threadId, undefined, ['btw'])
    const aside = (await sam.waitForEvent(
      e => e.kind === 'thread.started' && e.threadId !== thread.threadId
    )) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === aside.threadId)
    await settle()

    for (const other of [samSecondWindow, pat]) {
      expect(other.events.some(e => 'threadId' in e && e.threadId === aside.threadId)).toBe(false)
      expect(other.steps.some(step => step.threadId === aside.threadId)).toBe(false)
    }

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.events.some(e => 'threadId' in e && e.threadId === aside.threadId)).toBe(false)
    expect(revived.events.some(e => e.kind === 'message' && e.text === 'what is a changelog for')).toBe(false)
  })

  it("takes a question on somebody else's thread with an agent of your own", async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('pat', false)
    await connectRunner('sam', true)
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 2)

    pat.chat('@Fake tidy the readme', [patsFake])
    const thread = (await pat.waitForEvent(e => e.kind === 'thread.started')) as Started
    await pat.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    sam.chat('what is a changelog for', [], thread.threadId, undefined, ['btw'])
    const aside = (await sam.waitForEvent(
      e => e.kind === 'thread.started' && e.threadId !== thread.threadId
    )) as Started
    // The thread's own agent runs on Pat's machine, so one of Sam's answers it.
    expect(aside.agentId).toBe(steery)
    expect(aside.aside).toBe(thread.threadId)
  })

  it('says why a question on the side did not happen, to the one who asked', async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('pat', false)
    await pat.waitForEvent(e => e.kind === 'agent.online')

    pat.chat('@Fake tidy the readme', [patsFake])
    const thread = (await pat.waitForEvent(e => e.kind === 'thread.started')) as Started

    sam.chat('what is a changelog for', [], thread.threadId, undefined, ['btw'])
    const notice = (await sam.waitFor(msg => msg.type === 'notice')) as Notice
    expect(notice.text).toBe('No agent of yours is here to take it.')
    await settle()
    expect(pat.messages.some(m => m.type === 'notice')).toBe(false)
    expect(sam.events.some(e => e.kind === 'thread.started' && e.threadId !== thread.threadId)).toBe(false)
  })
})
