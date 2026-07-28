import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type ThreadStarted = Extract<SessionEvent, { kind: 'thread.started' }>
type AgentEnd = Extract<SessionEvent, { kind: 'agent.end' }>

const settle = () => new Promise(r => setTimeout(r, 300))

describe('ghost threads', () => {
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

  async function connectRunner(name: string, provider = 'fake', label = 'Fake') {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({}, provider, label)],
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

  const fake = agentId('jamel', 'fake')

  const about = (ui: TestUi, threadId: string) =>
    ui.events.filter(e => 'threadId' in e && e.threadId === threadId)

  it('/ghost opens a thread the window keeps to itself, and writes none of it down', async () => {
    const sam = await connectUi('sam')
    const samSecondWindow = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /ghost read the readme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.ghost).toBe(true)
    // The command itself is not part of the work.
    expect(thread.title).toBe('@Fake read the readme')

    const end = (await sam.waitForEvent(e => e.kind === 'agent.end')) as AgentEnd
    expect(end.threadId).toBe(thread.threadId)
    expect(end.text).toContain('read the readme')
    expect(sam.steps.some(step => step.threadId === thread.threadId)).toBe(true)
    await settle()

    // Nobody else hears any of it, and neither does the same person's other
    // window: a ghost thread belongs to the one that opened it.
    for (const other of [samSecondWindow, pat]) {
      expect(other.events.some(e => e.kind === 'thread.started')).toBe(false)
      expect(about(other, thread.threadId)).toEqual([])
      expect(other.steps).toEqual([])
      expect(other.messages.some(m => m.type === 'queue.state' && m.threadId === thread.threadId)).toBe(false)
    }

    // And a host reading its own log back finds no trace of it.
    const revived = new CrewSession(host.store).snapshot()
    expect(revived.events.some(e => 'threadId' in e && e.threadId === thread.threadId)).toBe(false)
    expect(revived.events.some(e => e.kind === 'message' && e.text.includes('read the readme'))).toBe(false)
  })

  it('an agent picks up where the ghost thread left off', async () => {
    const sam = await connectUi('sam')
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /ghost read the readme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    await sam.waitForEvent(e => e.kind === 'agent.end')

    sam.chat('now the changelog', [], thread.threadId)
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.end').length === 2)
    const second = sam.events.filter((e): e is AgentEnd => e.kind === 'agent.end')[1]
    // The transcript is kept for the window and nowhere else, so the second turn
    // still knows what the first one was asked.
    expect(second.text).toContain('now the changelog')
    expect(second.text).toContain('read the readme')
  })

  it('a ghost thread is nobody else’s to write in', async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /ghost read the readme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    await sam.waitForEvent(e => e.kind === 'agent.end')

    pat.chat('let me in', [], thread.threadId)
    pat.send({ type: 'thread.status', threadId: thread.threadId, status: 'done' })
    await settle()

    expect(sam.events.some(e => e.kind === 'message' && e.text === 'let me in')).toBe(false)
    expect(sam.events.some(e => e.kind === 'thread.status')).toBe(false)
    expect(sam.events.filter(e => e.kind === 'agent.start').length).toBe(1)
  })

  it('the thread goes when the window does', async () => {
    const sam = await connectUi('sam')
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /ghost read the readme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    await sam.waitForEvent(e => e.kind === 'agent.end')

    sam.close()
    await settle()

    // Whoever comes next is handed a session that never held it.
    const next = await connectUi('sam')
    const snapshot = await next.waitFor(m => m.type === 'welcome')
    if (snapshot.type !== 'welcome') throw new Error('no welcome')
    expect(snapshot.snapshot.events.some(e => 'threadId' in e && e.threadId === thread.threadId)).toBe(false)
    expect(snapshot.snapshot.queues[thread.threadId]).toBeUndefined()

    next.chat('still there?', [], thread.threadId)
    await settle()
    expect(next.events.some(e => e.kind === 'message' && e.text === 'still there?')).toBe(false)
  })
})
