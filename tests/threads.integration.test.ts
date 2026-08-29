import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

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
    const runner = testRunner({
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
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect((start as Extract<SessionEvent, { kind: 'agent.start' }>).threadId).toBe(started.threadId)
    expect(end.ok).toBe(true)

    const seed = ui.events.find(e => e.kind === 'message' && e.threadId === started.threadId)
    expect(seed && seed.kind === 'message' ? seed.text : '').toContain('build the thing')
  })

  it('runs a failed thread again without repeating its message', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_FAIL: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('tidy the readme @Fake', [fake])
    const thread = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === thread.threadId
    )) as Extract<SessionEvent, { kind: 'agent.start' }>
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === first.promptId && !e.ok)

    ui.send({ type: 'thread.retry', threadId: thread.threadId })
    const retried = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === thread.threadId && e.promptId !== first.promptId
    )) as Extract<SessionEvent, { kind: 'agent.start' }>
    expect(retried.promptText).toBe(first.promptText)
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === retried.promptId)

    expect(ui.events.filter(e => e.kind === 'message' && e.threadId === thread.threadId)).toHaveLength(1)
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
      const started = (await ui.waitForEvent(e => e.kind === 'thread.started' && !seen.has(e.threadId))) as Started
      seen.add(started.threadId)
      expect(started.agentId).toBe(fake)
    }
    expect(seen.size).toBe(2)
  })

  it('includes the current prompt in a snapshot while a thread is working', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '500' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('keep working @Fake', [fake])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >

    expect(host.session.snapshot().threadPrompts?.[start.threadId!]).toBe(start.promptId)
  })

  it('replays the thread transcript on a follow-up', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('remember apple @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const firstEnd = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended

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
      const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === start.promptId)) as Ended
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
    const second = (await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId !== first.threadId)) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >

    ui.chat('are you still there', [], first.threadId)
    const replyStart = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === first.threadId && e.promptText === 'are you still there'
    )) as Extract<SessionEvent, { kind: 'agent.start' }>

    const secondEnd = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === second.promptId)) as Ended
    expect(replyStart.ts).toBeLessThanOrEqual(secondEnd.ts)

    const reply = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === replyStart.promptId)) as Ended
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

  it('streams thinking as it is written and keeps a silent block out of the thread', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_THINK_STREAM: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('think it over @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended

    const thoughts = ui.steps.filter(s => s.promptId === end.promptId && s.step.kind === 'thinking')
    expect(thoughts.some(s => s.step.status === 'running')).toBe(true)
    expect(thoughts.map(s => s.step.text)).toContain('weighing the options')

    // Every thought that reached the thread carries words, and each one grew
    // into place rather than landing whole at the end.
    expect(thoughts.every(s => s.step.text)).toBe(true)
    const ids = new Set(thoughts.map(s => s.step.id))
    expect(ids.size).toBe(1)

    const persisted = host.store
      .loadEvents()
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'agent.step' }> =>
          e.kind === 'agent.step' && e.promptId === end.promptId && e.step.kind === 'thinking'
      )
    expect(persisted).toHaveLength(1)
    expect(persisted[0].step.text).toBe('weighing the options')
  })

  it('keeps what the agent wrote before it was stopped', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '250', FAKE_CLI_THINK: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('long job @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    await ui.waitFor(m => m.type === 'agent.step' && m.promptId === start.promptId && m.step.kind === 'text')
    ui.cancel(start.promptId)

    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === start.promptId)) as Ended
    expect(end.ok).toBe(false)
    expect(end.error).toBe('Stopped')
    // A stop is written down as the thing somebody did rather than left to be
    // read out of whatever the CLI said as it was killed.
    expect(end.stopped).toBe(true)

    const kept = host.store
      .loadEvents()
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'agent.step' }> =>
          e.kind === 'agent.step' && e.promptId === start.promptId
      )
    expect(kept.some(e => e.step.kind === 'text' && e.step.text === 'fake[')).toBe(true)
    expect(kept.every(e => e.step.status === 'done')).toBe(true)
    expect(kept.every(e => e.threadId === started.threadId)).toBe(true)
  })

  it('hands unfinished work back to the agent on the next turn', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_ACTIVITY: '1', FAKE_CLI_DELAY_MS: '250' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('inspect the project @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    await ui.waitFor(
      message =>
        message.type === 'agent.step' &&
        message.promptId === first.promptId &&
        message.step.kind === 'text' &&
        message.step.text === 'fake['
    )
    ui.cancel(first.promptId)
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === first.promptId)

    ui.chat('continue', [], started.threadId)
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.promptId !== first.promptId
    )) as Ended

    expect(second.ok).toBe(true)
    expect(second.text).toContain('Fake was stopped before finishing. Work already shown in that run:')
    expect(second.text).toContain('[Helper: Helper: researching the question]')
    expect(second.text).toContain('[Tool: Glob: *.md]')
    expect(second.text).toContain('fake[')
  })

  it('reports tokens while a prompt runs', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('count me @Fake', [fake])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    const tokens = (await ui.waitFor(m => m.type === 'agent.tokens' && m.promptId === start.promptId)) as Extract<
      ServerMessage,
      { type: 'agent.tokens' }
    >
    expect(tokens.tokens).toBeGreaterThan(0)
    expect(tokens.agentId).toBe(fake)
  })

  it('writes down what a run took and spent when it ends', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('count me @Fake', [fake])
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end')) as Ended
    expect(end.ms).toBeGreaterThanOrEqual(0)
    expect(end.tokens).toBeGreaterThan(0)

    const written = host.store.loadEvents().find((e): e is Ended => e.kind === 'agent.end')
    expect(written?.ms).toBe(end.ms)
    expect(written?.tokens).toBe(end.tokens)
  })

  async function connectPair(env: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider(env)],
      agents: [
        { instanceId: 'a', provider: 'fake', name: 'Fake A', settings: {} },
        { instanceId: 'b', provider: 'fake', name: 'Fake B', settings: {} }
      ],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    return runner
  }

  it('a mention in a thread hands it to that agent', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectPair()
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake A')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake B')
    const idA = agentId('jamel', 'a')
    const idB = agentId('jamel', 'b')

    ui.chat('start here @Fake A', [idA])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.agentId).toBe(idA)
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    ui.chat('over to you @Fake B', [idB], started.threadId)
    const handed = (await ui.waitForEvent(
      e => e.kind === 'thread.agent' && e.threadId === started.threadId
    )) as Extract<SessionEvent, { kind: 'thread.agent' }>
    expect(handed.agentId).toBe(idB)
    expect(handed.agentLabel).toBe('Fake B')

    const reply = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.agentId === idB
    )) as Ended
    expect(reply.ok).toBe(true)
    expect(reply.text).toContain('over to you')
    expect(reply.text).toContain('start here')

    ui.chat('keep going', [], started.threadId)
    const followUp = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === started.threadId && e.promptText === 'keep going'
    )) as Extract<SessionEvent, { kind: 'agent.start' }>
    expect(followUp.agentId).toBe(idB)
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === followUp.promptId)) as Ended
    expect(end.ok).toBe(true)
  })

  it('mentioning two agents in a thread runs both on one message', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectPair()
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake A')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake B')
    const idA = agentId('jamel', 'a')
    const idB = agentId('jamel', 'b')

    ui.chat('start here @Fake A', [idA])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)

    ui.chat('both of you look at this @Fake A @Fake B', [idA, idB], started.threadId)
    const ends: Ended[] = []
    for (let i = 0; i < 2; i++) {
      const end = (await ui.waitForEvent(
        e =>
          e.kind === 'agent.end' &&
          e.threadId === started.threadId &&
          !ends.some(seen => seen.promptId === e.promptId) &&
          Boolean(e.text?.includes('both of you'))
      )) as Ended
      ends.push(end)
    }
    expect(new Set(ends.map(e => e.agentId))).toEqual(new Set([idA, idB]))
    expect(ends.every(e => e.ok)).toBe(true)

    const copies = ui.events.filter(
      e => e.kind === 'message' && e.threadId === started.threadId && e.text.includes('both of you')
    )
    expect(copies.length).toBe(1)
    expect(ui.events.some(e => e.kind === 'thread.agent')).toBe(false)
  })

  it('stops one thread without touching another', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
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
