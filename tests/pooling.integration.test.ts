import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

describe('pooling', () => {
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

  it('rejects a wrong session code', async () => {
    await expect(TestUi.connect(host.url, 'sam', 'nope00')).rejects.toThrow('Wrong session code')
  })

  it('registers people and agents, visible to everyone', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')

    await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Fake')

    const snapshot = (await ui.waitFor(m => m.type === 'welcome')) as Extract<
      import('../src/shared/protocol').ServerMessage,
      { type: 'welcome' }
    >
    expect(snapshot.snapshot.members.map(m => m.name)).toContain('sam')
    const agents = (await ui.waitForEvent(e => e.kind === 'agent.online')) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'agent.online' }
    >
    expect(agents.agentId).toBe(agentId('jamel', 'fake'))
  })

  it('routes a prompt to the right agent and streams the reply in order', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('hello @Fake', [agentId('jamel', 'fake')])

    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'agent.start' }
    >
    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.promptId === start.promptId
    )) as Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }>

    expect(end.ok).toBe(true)
    expect(end.text).toContain('fake[')
    expect(end.text).toContain('hello @Fake')

    const texts = ui.steps.filter(s => s.promptId === start.promptId && s.step.kind === 'text')
    expect(texts.length).toBe(3)
    expect(texts[0].step.text).toBe('fake[')
    expect(texts[2].step.text).toBe(']')

    const persisted = host.store.loadEvents().filter(e => e.kind === 'agent.end')
    expect(persisted.length).toBe(1)
  })

  it('streams tool and subagent steps', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_ACTIVITY: '1' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('do things @Fake', [agentId('jamel', 'fake')])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'agent.start' }
    >
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === start.promptId)

    const steps = ui.steps.filter(s => s.promptId === start.promptId)
    const subagent = steps.find(s => s.step.kind === 'subagent' && s.step.status === 'running')
    expect(subagent?.step.name).toBe('Helper')
    const subagentDone = steps.find(s => s.step.id === 'ta1' && s.step.status === 'done')
    expect(subagentDone).toBeTruthy()
    const toolNames = steps.filter(s => s.step.kind === 'tool').map(s => s.step.name)
    expect(toolNames).toContain('Glob')
  })

  it('says when an agent is not here', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = await connectRunner('jamel')
    await ui.waitForEvent(e => e.kind === 'agent.online')
    runner.close()
    await ui.waitForEvent(e => e.kind === 'agent.offline')

    ui.chat('you there @Fake', [agentId('jamel', 'fake')])
    const note = (await ui.waitForEvent(
      e => e.kind === 'message' && e.authorId === 'crew'
    )) as Extract<import('../src/shared/events').SessionEvent, { kind: 'message' }>
    expect(note.text).toContain('not here')
  })

  it('runs follow ups in one thread one at a time, in order', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '150' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('first @Fake', [agentId('jamel', 'fake')])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'thread.started' }
    >
    ui.chat('second', [], started.threadId)

    const ends: Array<Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }>> = []
    for (let i = 0; i < 2; i++) {
      const end = (await ui.waitForEvent(
        e => e.kind === 'agent.end' && !ends.some(seen => seen.promptId === e.promptId)
      )) as Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }>
      ends.push(end)
      expect(end.ok).toBe(true)
    }

    expect(ends[0].text).toContain('first @Fake')
    expect(ends[1].text).toContain('second')

    const starts = ui.events.filter(
      (e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.start' }> =>
        e.kind === 'agent.start'
    )
    expect(starts[1].ts).toBeGreaterThanOrEqual(ends[0].ts)
  })

  it('stops a running prompt when asked', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '400' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('slow work @Fake', [agentId('jamel', 'fake')])
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start')) as Extract<
      import('../src/shared/events').SessionEvent,
      { kind: 'agent.start' }
    >
    ui.cancel(start.promptId)

    const end = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.promptId === start.promptId
    )) as Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }>
    expect(end.ok).toBe(false)
    expect(end.error).toBe('Stopped')
  })
})
