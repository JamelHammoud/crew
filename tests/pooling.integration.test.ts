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

    const chunks = ui.chunks.filter(c => c.promptId === start.promptId)
    expect(chunks.length).toBe(3)
    expect(chunks[0].text).toBe('fake[')
    expect(chunks[2].text).toBe(']')

    const persisted = host.store.loadEvents().filter(e => e.kind === 'agent.end')
    expect(persisted.length).toBe(1)
  })

  it('streams tool and subagent activity', async () => {
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

    const activity = ui.activities.filter(a => a.promptId === start.promptId)
    const subagent = activity.find(a => a.activity.kind === 'subagent' && a.activity.status === 'running')
    expect(subagent?.activity.name).toBe('Helper')
    const subagentDone = activity.find(a => a.activity.id === 'a1' && a.activity.status === 'done')
    expect(subagentDone).toBeTruthy()
    const toolNames = activity.filter(a => a.activity.kind === 'tool').map(a => a.activity.name)
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

  it('runs queued prompts one at a time, in order', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '150' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('first @Fake', [agentId('jamel', 'fake')])
    ui.chat('second @Fake', [agentId('jamel', 'fake')])

    const ends: string[] = []
    for (let i = 0; i < 2; i++) {
      const end = (await ui.waitForEvent(
        (e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }> =>
          e.kind === 'agent.end' && !ends.includes(e.promptId)
      )) as Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }>
      ends.push(end.promptId)
      expect(end.ok).toBe(true)
    }

    const firstEnd = ui.events.find(
      (e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }> =>
        e.kind === 'agent.end' && e.promptId === ends[0]
    )
    const secondEnd = ui.events.find(
      (e): e is Extract<import('../src/shared/events').SessionEvent, { kind: 'agent.end' }> =>
        e.kind === 'agent.end' && e.promptId === ends[1]
    )
    expect(firstEnd?.text).toContain('first @Fake')
    expect(secondEnd?.text).toContain('second @Fake')
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
