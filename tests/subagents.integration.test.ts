import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { FAN_LIMIT } from '../src/shared/subagents'
import { Runner } from '../src/runner'
import { makeFakeProvider, makeSteerableProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Start = Extract<SessionEvent, { kind: 'agent.start' }>
type End = Extract<SessionEvent, { kind: 'agent.end' }>
type RoleAdded = Extract<SessionEvent, { kind: 'subagent.added' }>
type SpawnStarted = Extract<SessionEvent, { kind: 'subagent.started' }>
type SpawnEnded = Extract<SessionEvent, { kind: 'subagent.ended' }>

describe('subagents', () => {
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

  const steery = agentId('jamel', 'steery')
  const fake = agentId('jamel', 'fake')

  // The parent talks and the helper works, so they are two different CLIs: one
  // that takes a message mid-run and one that answers quickly.
  async function connectRunner(parentDelayMs = 3000, childDelayMs = 20): Promise<Runner> {
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [
        makeSteerableProvider({ FAKE_CLI_DELAY_MS: String(parentDelayMs) }),
        makeFakeProvider({ FAKE_CLI_DELAY_MS: String(childDelayMs) })
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

  async function addRole(ui: TestUi, name: string, provider = 'fake'): Promise<RoleAdded> {
    ui.send({ type: 'subagent.add', name, brief: `${name} does one piece of work and answers.`, provider })
    return (await ui.waitForEvent(e => e.kind === 'subagent.added' && e.name === name)) as RoleAdded
  }

  const post = (path: string, body: unknown): Promise<{ status: number; body: any }> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async res => ({ status: res.status, body: await res.json() }))

  async function openParent(ui: TestUi, agent: string, text = 'hold the thread open'): Promise<Start> {
    ui.chat(text, [agent])
    await ui.waitForEvent(e => e.kind === 'thread.started')
    return (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start
  }

  it('sends a helper out, keeps the parent working, and folds the answer into its turn', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner()
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    const role = await addRole(ui, 'Scout')

    const parent = await openParent(ui, steery)
    const spawned = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'read the schema',
      task: 'find every table in the schema'
    })
    expect(spawned.status).toBe(200)
    expect(spawned.body.threadId).toBeTruthy()

    const out = (await ui.waitForEvent(e => e.kind === 'subagent.started')) as SpawnStarted
    expect(out.roleId).toBe(role.roleId)
    expect(out.roleName).toBe('Scout')
    expect(out.subject).toBe('read the schema')
    expect(out.parentThreadId).toBe(parent.threadId)
    expect(out.parentPromptId).toBe(parent.promptId)
    // The role named a provider, so it ran on that machine's agent for it
    // rather than on the one that asked.
    expect(out.agentId).toBe(fake)

    // The helper's own thread is an ordinary thread: it runs, it says what it
    // did, and that answer is in the log once.
    const done = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === out.threadId)) as End
    expect(done.ok).toBe(true)
    expect(done.text).toContain('find every table in the schema')

    const ended = (await ui.waitForEvent(e => e.kind === 'subagent.ended')) as SpawnEnded
    expect(ended.threadId).toBe(out.threadId)
    expect(ended.ok).toBe(true)
    expect(ended).not.toHaveProperty('text')

    // It landed in the turn the parent was already in rather than opening a
    // second one, and nothing was written into the chat as though somebody had
    // said it.
    const parentEnd = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === parent.threadId,
      15000
    )) as End
    expect(parentEnd.text).toContain('steered:Scout finished after')
    expect(parentEnd.text).toContain('find every table in the schema')
    expect(ui.events.filter(e => e.kind === 'agent.start' && e.threadId === parent.threadId)).toHaveLength(1)
    expect(ui.events.some(e => e.kind === 'message' && e.text.includes('Scout finished after'))).toBe(false)
  })

  it('gives the answer a turn of its own when the parent cannot take one mid-run', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(20, 20)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    await addRole(ui, 'Auditor')

    const parent = await openParent(ui, fake)
    await post('/agents/spawn', { promptId: parent.promptId, role: 'Auditor', subject: 'check', task: 'check the tests' })
    const out = (await ui.waitForEvent(e => e.kind === 'subagent.started')) as SpawnStarted

    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === parent.threadId && e.promptId !== parent.promptId,
      15000
    )) as Start
    expect(second.promptText).toContain('Auditor finished after')
    expect(second.promptText).toContain('check the tests')
    // A turn, not a message. Nobody scrolls past a helper's raw answer pasted
    // into the chat as though it had been said.
    expect(ui.events.some(e => e.kind === 'message' && e.text.includes('Auditor finished after'))).toBe(false)
    expect(ui.events.some(e => e.kind === 'message.route' && e.promptId === second.promptId)).toBe(false)
    expect(out.parentThreadId).toBe(parent.threadId)
  })

  it('gathers a run of helpers finishing together into one interruption', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(20, 20)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    await addRole(ui, 'Scout')

    const parent = await openParent(ui, fake)
    for (const subject of ['schema', 'tests', 'docs']) {
      await post('/agents/spawn', { promptId: parent.promptId, role: 'Scout', subject, task: `look at the ${subject}` })
    }
    await waitUntil(() => ui.events.filter(e => e.kind === 'subagent.ended').length === 3)

    const woken = (await ui.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === parent.threadId && e.promptId !== parent.promptId,
      15000
    )) as Start
    for (const subject of ['schema', 'tests', 'docs']) expect(woken.promptText).toContain(`look at the ${subject}`)
    // One heading, one turn: three steers into a live turn is three times the
    // model is pulled off what it was doing.
    await new Promise(r => setTimeout(r, 600))
    expect(ui.events.filter(e => e.kind === 'agent.start' && e.threadId === parent.threadId)).toHaveLength(2)
  })

  it('refuses a spawn that names a run nobody is doing, and one with no role', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(20, 20)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    await addRole(ui, 'Scout')

    const dead = await post('/agents/spawn', { promptId: 'not-a-run', role: 'Scout', subject: 'x', task: 'x' })
    expect(dead.status).toBe(400)
    expect(dead.body.error).toContain('not a run')

    const parent = await openParent(ui, steery)
    const nameless = await post('/agents/spawn', { promptId: parent.promptId, role: 'Nobody', subject: 'x', task: 'x' })
    expect(nameless.status).toBe(400)
    expect(nameless.body.error).toContain('No role called')
    const empty = await post('/agents/spawn', { promptId: parent.promptId, role: 'Scout', subject: 'x', task: '  ' })
    expect(empty.status).toBe(400)
  })

  it('holds the fan at its limit and hands the room back as helpers come home', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(6000, 4000)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    await addRole(ui, 'Scout')

    ui.send({ type: 'subagent.prefs', on: true, fan: FAN_LIMIT })
    await new Promise(r => setTimeout(r, 200))
    const parent = await openParent(ui, steery)
    for (let i = 0; i < FAN_LIMIT; i++) {
      const sent = await post('/agents/spawn', {
        promptId: parent.promptId,
        role: 'Scout',
        subject: `job ${i}`,
        task: `do job ${i}`
      })
      expect(sent.status).toBe(200)
    }
    const over = await post('/agents/spawn', { promptId: parent.promptId, role: 'Scout', subject: 'x', task: 'one more' })
    expect(over.status).toBe(400)
    expect(over.body.error).toContain(`${FAN_LIMIT} running`)
  })

  it('talks to a helper that is still going, and stops one', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(6000, 6000)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === steery)
    await addRole(ui, 'Scout', 'steery')

    const parent = await openParent(ui, steery)
    const spawned = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'the long one',
      task: 'take your time'
    })
    const child = spawned.body.threadId as string
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === child)

    const said = await post(`/agents/${child}/say`, { promptId: parent.promptId, text: 'also check the docs' })
    expect(said.status).toBe(200)

    const look = await fetch(`${base}/agents/${child}?promptId=${parent.promptId}`).then(r => r.json())
    expect(look.state).toBe('working')
    expect(look.subject).toBe('the long one')
    expect(look.role).toBe('Scout')

    const stopped = await post(`/agents/${child}/stop`, { promptId: parent.promptId })
    expect(stopped.status).toBe(200)
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === child && e.ok === false)

    // Somebody else's run cannot reach it, however its id was come by.
    const trespass = await post(`/agents/${child}/say`, { promptId: 'not-a-run', text: 'hello' })
    expect(trespass.status).toBe(404)
  })

  it('comes back from a wait inside its bound rather than hanging on', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(9000, 9000)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === steery)
    await addRole(ui, 'Scout', 'steery')

    const parent = await openParent(ui, steery)
    const spawned = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'slow',
      task: 'take a while'
    })
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === spawned.body.threadId)

    const at = Date.now()
    const waited = await post('/agents/wait', {
      promptId: parent.promptId,
      ids: [spawned.body.threadId],
      ms: 1200
    })
    expect(Date.now() - at).toBeLessThan(5000)
    expect(waited.body.pending).toEqual([spawned.body.threadId])
    expect(waited.body.finished).toEqual([])
  })

  it('stopping a run stops the helpers it sent out', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner(9000, 9000)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === steery)
    await addRole(ui, 'Scout', 'steery')

    const parent = await openParent(ui, steery)
    const spawned = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'along for the ride',
      task: 'take a while'
    })
    const child = spawned.body.threadId as string
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === child)

    ui.cancel(parent.promptId)
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === child && e.ok === false, 20000)
    // A helper called off does not wake anybody: there is no run left to wake.
    await new Promise(r => setTimeout(r, 800))
    expect(ui.events.filter(e => e.kind === 'agent.start' && e.threadId === parent.threadId)).toHaveLength(1)
  })

  it('sends nothing out for somebody who has turned helpers off', async () => {
    const ui = await TestUi.connect(host.url, 'jamel', host.code)
    uis.push(ui)
    await connectRunner(20, 20)
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === fake)
    await addRole(ui, 'Scout')

    ui.send({ type: 'subagent.prefs', on: false, fan: 4 })
    await waitUntil(() => host.session.subagentRoles().length === 1)
    const parent = await openParent(ui, steery)
    const refused = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'x',
      task: 'read the file'
    })
    expect(refused.status).toBe(400)
    expect(refused.body.error).toContain('turned off')

    // And it is never suggested either: the words about helpers are left off
    // the prompt entirely, so it does not occur to the agent to try.
    ui.send({ type: 'subagent.prefs', on: true, fan: 1 })
    await new Promise(r => setTimeout(r, 200))
    const again = await post('/agents/spawn', {
      promptId: parent.promptId,
      role: 'Scout',
      subject: 'x',
      task: 'read the file'
    })
    expect(again.status).toBe(200)
    const over = await post('/agents/spawn', { promptId: parent.promptId, role: 'Scout', subject: 'y', task: 'more' })
    expect(over.status).toBe(400)
    expect(over.body.error).toContain('1 running')
  })

  it('keeps the roles in the snapshot and out of the trimmed window', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const role = await addRole(ui, 'Reviewer')
    expect(host.session.snapshot().subagents).toMatchObject([{ name: 'Reviewer', provider: 'fake', createdBy: 'sam' }])
    expect(host.session.snapshot().events.some(e => e.kind.startsWith('subagent.'))).toBe(false)

    ui.send({ type: 'subagent.edit', roleId: role.roleId, name: 'Critic', brief: 'reads a diff', provider: '' })
    await ui.waitForEvent(e => e.kind === 'subagent.edited')
    expect(host.session.snapshot().subagents?.[0]).toMatchObject({ name: 'Critic', brief: 'reads a diff' })
    expect(host.session.snapshot().subagents?.[0].provider).toBeUndefined()

    ui.send({ type: 'subagent.remove', roleId: role.roleId })
    await ui.waitForEvent(e => e.kind === 'subagent.removed')
    expect(host.session.snapshot().subagents).toHaveLength(0)
  })
})
