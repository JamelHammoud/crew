import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Handed = Extract<SessionEvent, { kind: 'thread.agent' }>
type Fallback = Extract<SessionEvent, { kind: 'thread.fallback' }>
type Notice = Extract<ServerMessage, { type: 'notice' }>

const settle = () => new Promise(r => setTimeout(r, 400))

describe('a fallback agent', () => {
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

  const flaky = agentId('sam', 'flaky')
  const spare = agentId('sam', 'spare')
  const doomed = agentId('sam', 'doomed')
  const patsSpare = agentId('pat', 'spare')

  // One machine running three: one that always falls over, one that answers, and
  // a second that always falls over, so a fallback failing too can be watched.
  async function connectRunner(name: string, extra: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [
        makeFakeProvider({ FAKE_CLI_FAIL: '1', ...extra }, 'flaky', 'Flaky'),
        makeFakeProvider(extra, 'spare', 'Spare'),
        makeFakeProvider({ FAKE_CLI_FAIL: '1', ...extra }, 'doomed', 'Doomed')
      ],
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

  async function openThread(ui: TestUi, text = 'tidy the readme') {
    ui.chat(`${text} @Flaky`, [flaky])
    return (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
  }

  it('takes over a run that fell over, and the thread moves with it', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    const first = (await sam.waitForEvent(e => e.kind === 'agent.start')) as Start
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.promptId === first.promptId)

    sam.chat('@Spare', [spare], thread.threadId, ['fallback'])
    const named = (await sam.waitForEvent(e => e.kind === 'thread.fallback')) as Fallback
    expect(named.agentId).toBe(spare)
    expect(named.byName).toBe('sam')

    sam.chat('now the changelog', [], thread.threadId)
    const failed = (await sam.waitForEvent(
      e => e.kind === 'agent.end' && e.agentId === flaky && e.promptId !== first.promptId
    )) as Ended
    expect(failed.ok).toBe(false)

    // The same message, handed on, in a run of its own on the fallback.
    const retry = (await sam.waitForEvent(
      e => e.kind === 'agent.start' && e.agentId === spare && e.threadId === thread.threadId
    )) as Start
    expect(retry.promptText).toBe('now the changelog')
    expect(retry.promptId).not.toBe(failed.promptId)

    const handed = (await sam.waitForEvent(e => e.kind === 'thread.agent')) as Handed
    expect(handed.agentId).toBe(spare)
    // Nobody did it, so there is nobody to name.
    expect(handed.byName).toBeUndefined()
    await settle()

    // It is the message being tried again rather than a second message, so it is
    // never written into the thread twice.
    const said = sam.events.filter(e => e.kind === 'message' && e.text === 'now the changelog')
    expect(said).toHaveLength(1)
  })

  it('hands a message on once and no further', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    await sam.waitForEvent(e => e.kind === 'agent.end')

    sam.chat('@Doomed', [doomed], thread.threadId, ['fallback'])
    await sam.waitForEvent(e => e.kind === 'thread.fallback')

    sam.chat('now the changelog', [], thread.threadId)
    await waitUntil(
      () =>
        sam.events.filter(e => e.kind === 'agent.end' && e.agentId === doomed && e.threadId === thread.threadId)
          .length === 1
    )
    await settle()

    // The first run and the one hop, and nothing after it: the fallback failed
    // too and that is the end of it rather than a pair passing one message back
    // and forth.
    const runs = sam.events.filter(
      e => e.kind === 'agent.start' && e.threadId === thread.threadId && e.promptText === 'now the changelog'
    )
    expect(runs).toHaveLength(2)
  })

  it('never takes a run somebody stopped', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', { FAKE_CLI_DELAY_MS: '3000' })
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    const first = (await sam.waitForEvent(e => e.kind === 'agent.start')) as Start

    sam.chat('@Spare', [spare], thread.threadId, ['fallback'])
    await sam.waitForEvent(e => e.kind === 'thread.fallback')

    sam.cancel(first.promptId)
    const ended = (await sam.waitForEvent(e => e.kind === 'agent.end' && e.promptId === first.promptId)) as Ended
    expect(ended.stopped).toBe(true)
    await settle()

    // Stopping is a decision rather than a fault, so nothing was handed on.
    expect(sam.events.some(e => e.kind === 'thread.agent')).toBe(false)
    expect(sam.events.some(e => e.kind === 'agent.start' && e.agentId === spare)).toBe(false)
  })

  it('is taken off by naming nobody, and then a failure moves nothing', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    await sam.waitForEvent(e => e.kind === 'agent.end')

    sam.chat('@Spare', [spare], thread.threadId, ['fallback'])
    await sam.waitForEvent(e => e.kind === 'thread.fallback' && e.agentId === spare)

    // An empty box with the chip on it is the way off, so it is the one send
    // that goes through with nothing typed.
    sam.chat('', [], thread.threadId, ['fallback'])
    const off = (await sam.waitForEvent(e => e.kind === 'thread.fallback' && e.agentId === undefined)) as Fallback
    expect(off.agentLabel).toBeUndefined()

    sam.chat('now the changelog', [], thread.threadId)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.agentId === flaky && e.ok === false)
    await settle()

    expect(sam.events.some(e => e.kind === 'thread.agent')).toBe(false)
    expect(sam.events.some(e => e.kind === 'agent.start' && e.agentId === spare)).toBe(false)
  })

  it('replays, so a session coming back up still knows who takes over', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    await sam.waitForEvent(e => e.kind === 'agent.end')
    sam.chat('@Spare', [spare], thread.threadId, ['fallback'])
    await sam.waitForEvent(e => e.kind === 'thread.fallback')
    await settle()

    const revived = new CrewSession(host.store).snapshot()
    const named = revived.events.filter((e): e is Fallback => e.kind === 'thread.fallback')
    expect(named).toHaveLength(1)
    expect(named[0].agentId).toBe(spare)
    expect(named[0].threadId).toBe(thread.threadId)
  })

  it('says why it did not happen, to the one who asked and nobody else', async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('sam')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 3)

    const thread = await openThread(sam)
    await sam.waitForEvent(e => e.kind === 'agent.end')

    // The thread is already on that one, so there is nothing for it to take over.
    sam.chat('@Flaky', [flaky], thread.threadId, ['fallback'])
    const notice = (await sam.waitFor(msg => msg.type === 'notice')) as Notice
    expect(notice.text).toBe('This thread is already on them. Mention somebody else to take over.')
    // The message never happened, so it goes back in the composer it was typed
    // in, which is this thread's.
    expect(notice.unsent).toBe(true)
    expect(notice.where).toBe(thread.threadId)
    await settle()
    expect(pat.messages.some(m => m.type === 'notice')).toBe(false)
    expect(sam.events.some(e => e.kind === 'thread.fallback')).toBe(false)
  })

  it('only ever hands a hidden thread to an agent of your own', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam')
    await connectRunner('pat')
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 6)

    sam.chat('tidy the readme @Flaky', [flaky], undefined, ['ghost'])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(thread.ghost).toBe(true)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    sam.chat('@Spare', [patsSpare], thread.threadId, ['fallback'])
    const notice = (await sam.waitFor(msg => msg.type === 'notice')) as Notice
    expect(notice.text).toBe("That agent runs on somebody else's machine. Mention one of your own.")

    // One of your own is taken, and none of it is written down.
    sam.chat('@Spare', [spare], thread.threadId, ['fallback'])
    const named = (await sam.waitForEvent(e => e.kind === 'thread.fallback')) as Fallback
    expect(named.agentId).toBe(spare)
    await settle()

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.events.some(e => e.kind === 'thread.fallback')).toBe(false)
  })
})
