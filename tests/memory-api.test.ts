import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { MEMORY_LIMIT } from '../src/shared/memory'
import type { ServerMessage } from '../src/shared/protocol'
import { CrewSession } from '../src/server/session'
import type { Runner } from '../src/runner'
import type { Provider } from '../src/runner/providers/types'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Start = Extract<SessionEvent, { kind: 'agent.start' }>

const slow = (name: string, label: string, ms: number, prompts: string[]): Provider => ({
  name,
  label,
  steerable: true,
  fields: () => [],
  detect: async () => true,
  start: prompt => {
    prompts.push(prompt)
    return {
      done: new Promise(resolve => setTimeout(() => resolve({ text: 'done' }), ms)),
      kill: () => {}
    }
  }
})

describe('the crew memory over http', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []
  let base = ''
  let prompts: string[] = []

  beforeEach(async () => {
    host = await startHost()
    base = host.url.replace('ws://', 'http://').replace('/ws', '')
    prompts = []
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    uis = []
    runners = []
    await host.close()
  })

  const post = (path: string, body: unknown): Promise<{ status: number; body: any }> =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async res => ({ status: res.status, body: await res.json() }))

  const get = (path: string): Promise<{ status: number; body: any }> =>
    fetch(`${base}${path}`).then(async res => ({ status: res.status, body: await res.json() }))

  async function connectRunner(name: string, provider: Provider): Promise<void> {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [provider],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
  }

  async function openRun(
    ms = 1500,
    commands?: Parameters<TestUi['chat']>[3],
    memoryEnabled = true
  ): Promise<{ ui: TestUi; run: Start; agent: string }> {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    if (memoryEnabled) {
      ui.send({ type: 'memory.set', enabled: true })
      await ui.waitForEvent(e => e.kind === 'memory.setting' && e.enabled)
    }
    await connectRunner('sam', slow('one', 'One', ms, prompts))
    const agent = agentId('sam', 'one')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === agent)
    ui.chat('read the sync loop', [agent], undefined, commands)
    await ui.waitForEvent(e => e.kind === 'thread.started')
    return { ui, run: (await ui.waitForEvent(e => e.kind === 'agent.start')) as Start, agent }
  }

  it('starts off and keeps its prompt and api out of reach', async () => {
    const { run } = await openRun(1500, undefined, false)

    expect(host.session.snapshot().memoryEnabled).toBe(false)
    expect(prompts[0]).not.toContain('What this crew has learned')

    const put = await post('/memory', { promptId: run.promptId, memories: ['Something to keep'] })
    expect(put.status).toBe(400)
    expect(put.body.error).toContain('turned off')
  })

  it('writes one down, rewrites it, forgets it, and reads the list back', async () => {
    const { ui, run } = await openRun()

    const put = await post('/memory', {
      promptId: run.promptId,
      memories: ['The tests boot real servers, so run one suite at a time', 'The host holds the code it started with']
    })
    expect(put.status).toBe(200)
    expect(put.body.ids).toHaveLength(2)
    const [first, second] = put.body.ids as string[]
    expect(first).toMatch(/^[0-9a-f]{6}$/)

    const added = (await ui.waitForEvent(e => e.kind === 'memory.added')) as Extract<
      SessionEvent,
      { kind: 'memory.added' }
    >
    expect(added.text).toBe('The tests boot real servers, so run one suite at a time')
    expect(added.byName).toBe('One')
    expect(added.agentId).toBe(agentId('sam', 'one'))

    const twice = await post('/memory', {
      promptId: run.promptId,
      memories: ['the tests   boot real servers, so run one suite at a time']
    })
    expect(twice.body.ids).toEqual([first])

    const edited = await post(`/memory/${second}`, {
      promptId: run.promptId,
      text: 'The host holds the code it started with, so restart it after a change to the server'
    })
    expect(edited.body).toEqual({ ok: true })
    await ui.waitForEvent(e => e.kind === 'memory.edited')

    const read = await get(`/memory?promptId=${run.promptId}`)
    expect(read.body.memories.map((one: { text: string }) => one.text)).toEqual([
      'The tests boot real servers, so run one suite at a time',
      'The host holds the code it started with, so restart it after a change to the server'
    ])

    expect((await post(`/memory/${second}/forget`, { promptId: run.promptId })).body).toEqual({ ok: true })
    await ui.waitForEvent(e => e.kind === 'memory.removed')
    expect((await get(`/memory?promptId=${run.promptId}`)).body.memories).toHaveLength(1)

    const late = await TestUi.connect(host.url, 'robin', host.code)
    uis.push(late)
    const welcome = late.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect((welcome.snapshot.memories ?? []).map(one => one.id)).toEqual([first])
    expect(welcome.snapshot.events.some(event => event.kind.startsWith('memory.'))).toBe(false)
  })

  it('puts what the crew knows in front of the next agent, whoever it is', async () => {
    const { ui, run } = await openRun()
    await post('/memory', { promptId: run.promptId, memories: ['The tests boot real servers'] })
    await ui.waitForEvent(e => e.kind === 'memory.added')

    const other: string[] = []
    await connectRunner('pat', slow('two', 'Two', 40, other))
    const second = agentId('pat', 'two')
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === second)
    ui.chat('carry on @Two', [second])
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === second)

    expect(other[0]).toContain('What this crew has learned')
    expect(other[0]).toContain('The tests boot real servers')
  })

  it('refuses a promptId that is not a run going here', async () => {
    const { ui, run } = await openRun(20)

    const strange = await post('/memory', {
      promptId: '1e2d3c4b-0000-0000-0000-000000000000',
      memories: ['Anything at all']
    })
    expect(strange.status).toBe(400)
    expect(strange.body.error).toContain('not a run')

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.promptId === run.promptId)
    const late = await post('/memory', { promptId: run.promptId, memories: ['Too late'] })
    expect(late.status).toBe(400)
    expect((await get(`/memory?promptId=${run.promptId}`)).status).toBe(400)
    expect(ui.events.some(e => e.kind.startsWith('memory.'))).toBe(false)
  })

  it('refuses a hidden thread in words, so nothing about one reaches the crew', async () => {
    const { ui, run } = await openRun(1500, ['ghost'])

    const put = await post('/memory', { promptId: run.promptId, memories: ['Something only this window saw'] })
    expect(put.status).toBe(400)
    expect(put.body.error).toContain('hidden')
    expect(ui.events.some(e => e.kind.startsWith('memory.'))).toBe(false)
    expect(host.session.snapshot().memories).toEqual([])
  })

  it('refuses a full list with the move to make, rather than dropping the oldest', async () => {
    const { ui, run } = await openRun()
    for (let at = 0; at < MEMORY_LIMIT; at++) ui.send({ type: 'memory.add', text: `Fact number ${at}` })
    await ui.waitForEvent(e => e.kind === 'memory.added' && e.text === `Fact number ${MEMORY_LIMIT - 1}`)

    const full = await post('/memory', { promptId: run.promptId, memories: ['One more thing'] })
    expect(full.status).toBe(400)
    expect(full.body.error).toContain('Take one out')
    expect(host.session.snapshot().memories).toHaveLength(MEMORY_LIMIT)

    const already = await post('/memory', { promptId: run.promptId, memories: ['fact number 0'] })
    expect(already.status).toBe(200)
    expect(already.body.ids).toHaveLength(1)
  })

  it('comes back off the log the way the toolbox does', async () => {
    const { ui, run } = await openRun()
    const put = await post('/memory', { promptId: run.promptId, memories: ['The tests boot real servers'] })
    await ui.waitForEvent(e => e.kind === 'memory.added')

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.memoryEnabled).toBe(true)
    expect(revived.memories).toEqual([
      expect.objectContaining({ id: put.body.ids[0], text: 'The tests boot real servers', by: 'One' })
    ])
  })
})
