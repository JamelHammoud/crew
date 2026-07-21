import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Added = Extract<SessionEvent, { kind: 'todo.added' }>
type Edited = Extract<SessionEvent, { kind: 'todo.edited' }>
type Checked = Extract<SessionEvent, { kind: 'todo.checked' }>
type TodoStarted = Extract<SessionEvent, { kind: 'todo.started' }>
type ThreadStarted = Extract<SessionEvent, { kind: 'thread.started' }>

describe('todos', () => {
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

  it('adds, edits, checks, and tells everyone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    const pat = await TestUi.connect(host.url, 'pat', host.code)
    uis.push(sam, pat)

    sam.send({ type: 'todo.add', text: '  write the docs  ', agentId: fake })
    const added = (await pat.waitForEvent(e => e.kind === 'todo.added')) as Added
    expect(added.text).toBe('write the docs')
    expect(added.agentId).toBe(fake)
    expect(added.byName).toBe('sam')

    // Editing without an agent unassigns it.
    sam.send({ type: 'todo.edit', todoId: added.todoId, text: 'write the API docs' })
    const edited = (await pat.waitForEvent(e => e.kind === 'todo.edited')) as Edited
    expect(edited.text).toBe('write the API docs')
    expect(edited.agentId).toBeUndefined()

    pat.send({ type: 'todo.check', todoId: added.todoId, checked: true })
    const checked = (await sam.waitForEvent(e => e.kind === 'todo.checked')) as Checked
    expect(checked.checked).toBe(true)
    expect(checked.byName).toBe('pat')

    // Checking an already-checked todo is not a transition.
    pat.send({ type: 'todo.check', todoId: added.todoId, checked: true })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'todo.checked').length).toBe(1)

    // Todos ride in the snapshot as first-class state, so a late joiner sees
    // them even though their events never enter the trimmed window.
    const snapshot = host.session.snapshot()
    expect(snapshot.todos).toHaveLength(1)
    expect(snapshot.todos[0]).toMatchObject({ text: 'write the API docs', checked: true, createdBy: 'sam' })
    expect(snapshot.events.some(e => e.kind.startsWith('todo.'))).toBe(false)
  })

  it('ignores empty text and unknown todos', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)

    sam.send({ type: 'todo.add', text: '   ' })
    sam.send({ type: 'todo.edit', todoId: 'nope', text: 'x' })
    sam.send({ type: 'todo.remove', todoId: 'nope' })
    sam.send({ type: 'todo.check', todoId: 'nope', checked: true })
    sam.send({ type: 'todo.do', todoId: 'nope' })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind.startsWith('todo.'))).toBe(false)
    expect(host.session.snapshot().todos).toHaveLength(0)
  })

  it("'Do' turns a todo into a running thread and removes it", async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.send({ type: 'todo.add', text: 'tidy the readme', agentId: fake })
    const added = (await sam.waitForEvent(e => e.kind === 'todo.added')) as Added

    sam.send({ type: 'todo.do', todoId: added.todoId })
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.title).toBe('tidy the readme')
    expect(thread.agentId).toBe(fake)
    expect(thread.byName).toBe('sam')

    const started = (await sam.waitForEvent(e => e.kind === 'todo.started')) as TodoStarted
    expect(started.todoId).toBe(added.todoId)
    expect(started.threadId).toBe(thread.threadId)

    // The todo's text became the thread's first prompt and the run completes.
    await sam.waitForEvent(e => e.kind === 'message' && e.threadId === thread.threadId && e.text === 'tidy the readme')
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId && e.ok)
    expect(host.session.snapshot().todos).toHaveLength(0)

    // Doing it again is a no-op: the todo is gone.
    sam.send({ type: 'todo.do', todoId: added.todoId })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.started').length).toBe(1)
  })

  it("'Do' needs an agent, which can be picked at click time", async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.send({ type: 'todo.add', text: 'unassigned work' })
    const added = (await sam.waitForEvent(e => e.kind === 'todo.added')) as Added
    expect(added.agentId).toBeUndefined()

    // No agent assigned and none picked: nothing happens.
    sam.send({ type: 'todo.do', todoId: added.todoId })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.some(e => e.kind === 'thread.started')).toBe(false)

    sam.send({ type: 'todo.do', todoId: added.todoId, agentId: fake })
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as ThreadStarted
    expect(thread.agentId).toBe(fake)

    // A checked todo cannot be done into a thread.
    sam.send({ type: 'todo.add', text: 'already handled' })
    const second = (await sam.waitForEvent(e => e.kind === 'todo.added' && e.text === 'already handled')) as Added
    sam.send({ type: 'todo.check', todoId: second.todoId, checked: true })
    await sam.waitForEvent(e => e.kind === 'todo.checked')
    sam.send({ type: 'todo.do', todoId: second.todoId, agentId: fake })
    await new Promise(r => setTimeout(r, 200))
    expect(sam.events.filter(e => e.kind === 'thread.started').length).toBe(1)
  })

  it('survives a restart: pending and checked todos replay, started ones stay gone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.send({ type: 'todo.add', text: 'still pending', agentId: fake })
    sam.send({ type: 'todo.add', text: 'done by hand' })
    sam.send({ type: 'todo.add', text: 'became a thread', agentId: fake })
    const byHand = (await sam.waitForEvent(e => e.kind === 'todo.added' && e.text === 'done by hand')) as Added
    const became = (await sam.waitForEvent(e => e.kind === 'todo.added' && e.text === 'became a thread')) as Added
    sam.send({ type: 'todo.check', todoId: byHand.todoId, checked: true })
    await sam.waitForEvent(e => e.kind === 'todo.checked')
    sam.send({ type: 'todo.do', todoId: became.todoId })
    await sam.waitForEvent(e => e.kind === 'todo.started')

    const revived = new CrewSession(host.store)
    const todos = revived.snapshot().todos
    expect(todos).toHaveLength(2)
    expect(todos.find(t => t.text === 'still pending')).toMatchObject({ agentId: fake, checked: false })
    expect(todos.find(t => t.text === 'done by hand')).toMatchObject({ checked: true })
    expect(todos.some(t => t.text === 'became a thread')).toBe(false)
  })
})
