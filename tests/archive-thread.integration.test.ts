import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Status = Extract<SessionEvent, { kind: 'thread.status' }>

describe('archiving threads', () => {
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
    const runner = new Runner({
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

  it('tells everyone, keeps the thread history, and survives a restart', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('tidy this up @Fake', [fake])
    const started = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    pat.send({ type: 'thread.archive', threadId: started.threadId })
    const archived = (await sam.waitForEvent(e => e.kind === 'thread.status')) as Status
    expect(archived.threadId).toBe(started.threadId)
    expect(archived.status).toBe('archived')
    expect(archived.byName).toBe('pat')

    pat.send({ type: 'thread.archive', threadId: started.threadId })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.status').length).toBe(1)

    const revived = new CrewSession(host.store)
    const events = revived.snapshot().events
    expect(events.some(e => e.kind === 'thread.started' && e.threadId === started.threadId)).toBe(true)
    expect(
      events.some(e => e.kind === 'thread.status' && e.threadId === started.threadId && e.status === 'archived')
    ).toBe(true)
    expect(events.some(e => e.kind === 'message' && e.threadId === started.threadId)).toBe(true)
  })

  it('ignores an archive for a thread that does not exist', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'thread.archive', threadId: 'nope' })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind === 'thread.status')).toBe(false)
  })
})
