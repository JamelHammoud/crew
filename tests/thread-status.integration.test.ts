import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, tmpDir, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Status = Extract<SessionEvent, { kind: 'thread.status' }>

describe('thread status', () => {
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

  async function startThread(ui: TestUi): Promise<Started> {
    ui.chat('tidy this up @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)
    return started
  }

  it('marks done, reopens, and tells everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const started = await startThread(sam)

    pat.send({ type: 'thread.status', threadId: started.threadId, status: 'done' })
    const done = (await sam.waitForEvent(e => e.kind === 'thread.status' && e.status === 'done')) as Status
    expect(done.threadId).toBe(started.threadId)
    expect(done.byName).toBe('pat')

    // Same status again is not a transition, so nothing new goes out.
    pat.send({ type: 'thread.status', threadId: started.threadId, status: 'done' })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.status').length).toBe(1)

    sam.send({ type: 'thread.status', threadId: started.threadId, status: 'open' })
    const reopened = (await pat.waitForEvent(e => e.kind === 'thread.status' && e.status === 'open')) as Status
    expect(reopened.threadId).toBe(started.threadId)
    expect(reopened.byName).toBe('sam')
  })

  it('ignores unknown threads and unknown statuses', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const started = await startThread(sam)

    sam.send({ type: 'thread.status', threadId: 'nope', status: 'done' })
    sam.send({
      type: 'thread.status',
      threadId: started.threadId,
      status: 'blocked'
    } as never)
    // A thread starts open, so re-sending open is also a no-op.
    sam.send({ type: 'thread.status', threadId: started.threadId, status: 'open' })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind === 'thread.status')).toBe(false)
  })

  it('archives through the old message, unarchives through the new one, and survives a restart', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const started = await startThread(sam)

    sam.send({ type: 'thread.archive', threadId: started.threadId })
    const archived = (await sam.waitForEvent(
      e => e.kind === 'thread.status' && e.status === 'archived'
    )) as Status
    expect(archived.threadId).toBe(started.threadId)

    // Already archived: the old-style message must not fire a second event.
    sam.send({ type: 'thread.archive', threadId: started.threadId })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.status').length).toBe(1)

    sam.send({ type: 'thread.status', threadId: started.threadId, status: 'open' })
    await sam.waitForEvent(e => e.kind === 'thread.status' && e.status === 'open')
    sam.send({ type: 'thread.status', threadId: started.threadId, status: 'done' })
    await sam.waitForEvent(e => e.kind === 'thread.status' && e.status === 'done')

    // A restarted session replays every transition and lands on done.
    const revived = new CrewSession(host.store)
    const events = revived.snapshot().events
    expect(events.filter(e => e.kind === 'thread.status').length).toBe(3)
    expect((events.filter(e => e.kind === 'thread.status').at(-1) as Status).status).toBe('done')
  })

  it('replays old-format thread.archived events as archived status', async () => {
    const repo = tmpDir('old-log')
    const crewDir = path.join(repo, '.crew')
    fs.mkdirSync(crewDir, { recursive: true })
    const old: SessionEvent[] = [
      {
        id: 'e1',
        ts: 1,
        kind: 'thread.started',
        threadId: 't1',
        agentId: 'jamel/fake',
        agentLabel: 'Fake',
        title: 'old thread',
        byName: 'sam'
      },
      { id: 'e2', ts: 2, kind: 'thread.archived', threadId: 't1', byName: 'sam' }
    ]
    fs.writeFileSync(path.join(crewDir, 'chat.jsonl'), old.map(e => JSON.stringify(e)).join('\n') + '\n')

    const oldHost = await startHost(repo)
    try {
      const sam = await TestUi.connect(oldHost.url, 'sam', oldHost.code)
      uis.push(sam)
      // Replay left the thread archived, so archiving again is a no-op...
      sam.send({ type: 'thread.archive', threadId: 't1' })
      await new Promise(r => setTimeout(r, 200))
      expect(sam.events.some(e => e.kind === 'thread.status')).toBe(false)
      // ...while unarchiving is a real transition.
      sam.send({ type: 'thread.status', threadId: 't1', status: 'open' })
      const reopened = (await sam.waitForEvent(e => e.kind === 'thread.status')) as Status
      expect(reopened.status).toBe('open')
    } finally {
      await oldHost.close()
    }
  })

  it('reopens a done thread when a new message lands in it', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')
    const started = await startThread(sam)

    sam.send({ type: 'thread.status', threadId: started.threadId, status: 'done' })
    await sam.waitForEvent(e => e.kind === 'thread.status' && e.status === 'done')

    sam.chat('one more thing', [], started.threadId)
    const reopened = (await sam.waitForEvent(
      e => e.kind === 'thread.status' && e.status === 'open'
    )) as Status
    expect(reopened.threadId).toBe(started.threadId)
    expect(reopened.byName).toBe('sam')
  })
})
