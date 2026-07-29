import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type SpawnStarted = Extract<SessionEvent, { kind: 'subagent.started' }>

const settle = () => new Promise(r => setTimeout(r, 400))

describe('a helper sent out of a ghost thread', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []
  let base = ''

  beforeEach(async () => {
    host = await startHost()
    base = host.url.replace('ws://', 'http://').replace('/ws', '')
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  const fake = agentId('jamel', 'fake')

  it('is hidden from the other window, and none of it is ever written down', async () => {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '40' })],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })

    const mine = await TestUi.connect(host.url, 'jamel', host.code)
    const theirs = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(mine, theirs)
    await mine.waitForEvent(e => e.kind === 'agent.online')

    mine.send({ type: 'subagent.add', name: 'Scout', brief: 'reads things', provider: 'fake' })
    await mine.waitForEvent(e => e.kind === 'subagent.added')

    mine.chat('look into this quietly @Fake', [fake], undefined, ['ghost'])
    const parent = (await mine.waitForEvent(e => e.kind === 'agent.start')) as Start

    const spawned = await fetch(`${base}/agents/spawn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ promptId: parent.promptId, role: 'Scout', subject: 'quiet', task: 'read the file' })
    }).then(r => r.json())
    expect(spawned.threadId).toBeTruthy()

    const out = (await mine.waitForEvent(e => e.kind === 'subagent.started')) as SpawnStarted
    expect(out.threadId).toBe(spawned.threadId)
    await mine.waitForEvent(e => e.kind === 'subagent.ended')
    await settle()

    // A hidden thread whose children are not hidden is a hidden thread that
    // leaks, so the child inherits it without exception.
    expect(theirs.events.some(e => e.kind === 'subagent.started')).toBe(false)
    expect(theirs.events.some(e => e.kind === 'subagent.ended')).toBe(false)
    expect(theirs.events.some(e => 'threadId' in e && e.threadId === spawned.threadId)).toBe(false)

    const written = host.store.loadEvents()
    expect(written.some(e => e.kind === 'subagent.started')).toBe(false)
    expect(written.some(e => 'threadId' in e && e.threadId === spawned.threadId)).toBe(false)
    // The role itself is the crew's and is written down. Only the run is hidden.
    expect(written.some(e => e.kind === 'subagent.added')).toBe(true)
  })

  it('goes when the window that opened the thread does', async () => {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '4000' })],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })

    const mine = await TestUi.connect(host.url, 'jamel', host.code)
    uis.push(mine)
    await mine.waitForEvent(e => e.kind === 'agent.online')
    mine.send({ type: 'subagent.add', name: 'Scout', brief: 'reads things', provider: 'fake' })
    await mine.waitForEvent(e => e.kind === 'subagent.added')

    mine.chat('quietly @Fake', [fake], undefined, ['ghost'])
    const parent = (await mine.waitForEvent(e => e.kind === 'agent.start')) as Start
    const spawned = await fetch(`${base}/agents/spawn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ promptId: parent.promptId, role: 'Scout', subject: 'quiet', task: 'take a while' })
    }).then(r => r.json())
    await mine.waitForEvent(e => e.kind === 'agent.start' && e.threadId === spawned.threadId)

    mine.close()
    await waitUntil(() => host.session.subagentState(spawned.threadId) === null)
    expect(host.store.loadEvents().some(e => 'threadId' in e && e.threadId === spawned.threadId)).toBe(false)
  })
})
