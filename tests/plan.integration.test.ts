import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { PLAN_INSTRUCTIONS } from '../src/shared/plan'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type ThreadStarted = Extract<SessionEvent, { kind: 'thread.started' }>
type ThreadPlan = Extract<SessionEvent, { kind: 'thread.plan' }>
type AgentEnd = Extract<SessionEvent, { kind: 'agent.end' }>

describe('plan mode', () => {
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
    const runner = new Runner({
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

  const fake = agentId('jamel', 'fake')

  it('/plan opens a planning thread and keeps the reply as the plan', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /plan tidy the readme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.mode).toBe('plan')
    // The command itself is not part of the work.
    expect(thread.title).toBe('@Fake tidy the readme')

    const plan = (await sam.waitForEvent(e => e.kind === 'thread.plan')) as ThreadPlan
    expect(plan.threadId).toBe(thread.threadId)
    expect(plan.agentId).toBe(fake)
    // The fake CLI echoes its prompt, so the plan carries what the agent was told.
    expect(plan.text).toContain(PLAN_INSTRUCTIONS)
    expect(plan.text).toContain('tidy the readme')
  })

  it('Implement plan hands the plan back as the brief and leaves plan mode', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /plan add a dark theme', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    await sam.waitForEvent(e => e.kind === 'thread.plan')

    sam.send({ type: 'plan.implement', threadId: thread.threadId })
    await sam.waitForEvent(e => e.kind === 'thread.implement' && e.threadId === thread.threadId)
    await sam.waitForEvent(e => e.kind === 'message' && e.threadId === thread.threadId && e.text === 'Implement the plan.')

    const ends = sam.events.filter(e => e.kind === 'agent.end') as AgentEnd[]
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId && ends.length < 2)
    const build = (sam.events.filter(e => e.kind === 'agent.end') as AgentEnd[]).at(-1)!
    expect(build.text).toContain('The plan this thread agreed on')
    // Out of plan mode the agent is no longer told to stop at a plan.
    expect(build.text).not.toContain(PLAN_INSTRUCTIONS)

    // Implementing twice does not start a second build.
    sam.send({ type: 'plan.implement', threadId: thread.threadId })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.implement').length).toBe(1)
  })

  it('/plan without a mention goes to the only agent here, and asks when there are more', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('/plan rename the buttons')
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.agentId).toBe(fake)
    expect(thread.mode).toBe('plan')
    expect(thread.title).toBe('rename the buttons')

    await connectRunner('pat', 'other', 'Other')
    await sam.waitForEvent(e => e.kind === 'agent.online' && e.label === 'Other')

    sam.chat('/plan rename the tabs')
    await sam.waitForEvent(e => e.kind === 'message' && e.authorId === 'crew')
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.started').length).toBe(1)
  })

  it('/plan inside a thread is ordinary text', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake write the docs', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.mode).toBeUndefined()
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    sam.chat('/plan is not a command here', [], thread.threadId)
    await sam.waitForEvent(
      e => e.kind === 'message' && e.threadId === thread.threadId && e.text === '/plan is not a command here'
    )
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind === 'thread.plan')).toBe(false)
  })

  it('a plan survives a restart', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake /plan split the file', [fake])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    const plan = (await sam.waitForEvent(e => e.kind === 'thread.plan')) as ThreadPlan

    const revived = new CrewSession(host.store).snapshot()
    const started = revived.events.find(
      (e): e is ThreadStarted => e.kind === 'thread.started' && e.threadId === thread.threadId
    )
    const kept = revived.events.find(
      (e): e is ThreadPlan => e.kind === 'thread.plan' && e.threadId === thread.threadId
    )
    expect(started?.mode).toBe('plan')
    expect(kept?.text).toBe(plan.text)
  })
})
