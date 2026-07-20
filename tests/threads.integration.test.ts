import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

describe('threads', () => {
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

  async function connectRunner(name: string, env: NodeJS.ProcessEnv = {}) {
    const runner = new Runner({
      name,
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

  it('a mention from the main chat starts a thread scoped to the agent', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('build the thing @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.agentId).toBe(fake)
    expect(started.title).toContain('build the thing')

    const start = await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId
    )) as Ended
    expect((start as Extract<SessionEvent, { kind: 'agent.start' }>).threadId).toBe(started.threadId)
    expect(end.ok).toBe(true)

    const seed = ui.events.find(e => e.kind === 'message' && e.threadId === started.threadId)
    expect(seed && seed.kind === 'message' ? seed.text : '').toContain('build the thing')
  })

  it('mentioning the same agent twice opens two separate threads', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '80' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('first @Fake', [fake])
    ui.chat('second @Fake', [fake])

    const seen = new Set<string>()
    for (let i = 0; i < 2; i++) {
      const started = (await ui.waitForEvent(
        e => e.kind === 'thread.started' && !seen.has(e.threadId)
      )) as Started
      seen.add(started.threadId)
      expect(started.agentId).toBe(fake)
    }
    expect(seen.size).toBe(2)
  })

  it('replays the thread transcript on a follow-up', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('remember apple @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const firstEnd = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId
    )) as Ended

    ui.chat('now say banana', [], started.threadId)
    const secondEnd = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.promptId !== firstEnd.promptId
    )) as Ended

    expect(secondEnd.text).toContain('now say banana')
    expect(secondEnd.text).toContain('remember apple')
  })

  it('runs two threads with the same agent at the same time', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '300' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('first @Fake', [fake])
    ui.chat('second @Fake', [fake])

    const starts: Array<Extract<SessionEvent, { kind: 'agent.start' }>> = []
    for (let i = 0; i < 2; i++) {
      const start = (await ui.waitForEvent(
        e => e.kind === 'agent.start' && !starts.some(seen => seen.promptId === e.promptId)
      )) as Extract<SessionEvent, { kind: 'agent.start' }>
      starts.push(start)
    }
    expect(new Set(starts.map(s => s.threadId)).size).toBe(2)

    const firstEnd = await ui.waitForEvent(e => e.kind === 'agent.end')
    expect(starts[1].ts).toBeLessThan(firstEnd.ts)

    for (const start of starts) {
      const end = (await ui.waitForEvent(
        e => e.kind === 'agent.end' && e.promptId === start.promptId
      )) as Ended
      expect(end.ok).toBe(true)
    }
  })

  it('answers a reply sent while the agent is busy in another thread', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '300' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('first @Fake', [fake])
    const first = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === first.threadId)

    ui.chat('second @Fake', [fake])
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId !== first.threadId
    )) as Extract<SessionEvent, { kind: 'agent.start' }>

    ui.chat('are you still there', [], first.threadId)
    const replyStart = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === first.threadId && e.promptText === 'are you still there'
    )) as Extract<SessionEvent, { kind: 'agent.start' }>

    const secondEnd = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === second.promptId)) as Ended
    expect(replyStart.ts).toBeLessThanOrEqual(secondEnd.ts)

    const reply = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.promptId === replyStart.promptId
    )) as Ended
    expect(reply.ok).toBe(true)
    expect(reply.text).toContain('are you still there')
  })

  it('streams steps per thread and replays them after a restart', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_ACTIVITY: '1', FAKE_CLI_THINK: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('do things @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended

    const live = ui.steps.filter(s => s.promptId === end.promptId)
    expect(live.every(s => s.threadId === started.threadId)).toBe(true)
    expect(live.filter(s => s.step.kind === 'text').length).toBeGreaterThan(1)
    expect(live.some(s => s.step.kind === 'thinking' && s.step.text === 'weighing the options')).toBe(true)
    expect(live.some(s => s.step.kind === 'subagent')).toBe(true)

    const persisted = host.store
      .loadEvents()
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'agent.step' }> =>
          e.kind === 'agent.step' && e.promptId === end.promptId
      )
    expect(persisted.map(e => e.step.kind)).toContain('thinking')
    expect(persisted.every(e => e.step.status === 'done')).toBe(true)
    expect(persisted.every(e => e.threadId === started.threadId)).toBe(true)
    const texts = persisted.filter(e => e.step.kind === 'text').map(e => e.step.text)
    expect(texts).toContain('fake[')
    expect(texts).toContain(']')
  })

  it('stops one thread without touching another', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '400' })],
      agents: [
        { instanceId: 'a', provider: 'fake', name: 'Fake A', settings: {} },
        { instanceId: 'b', provider: 'fake', name: 'Fake B', settings: {} }
      ],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake A')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake B')

    const idA = agentId('jamel', 'a')
    const idB = agentId('jamel', 'b')
    ui.chat('slow a @Fake A', [idA])
    ui.chat('slow b @Fake B', [idB])

    const startA = (await ui.waitForEvent(e => e.kind === 'agent.start' && e.agentId === idA)) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.agentId === idB)
    ui.cancel(startA.promptId)

    const endA = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === idA)) as Ended
    const endB = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === idB)) as Ended
    expect(endA.ok).toBe(false)
    expect(endA.error).toBe('Stopped')
    expect(endB.ok).toBe(true)
  })
})
