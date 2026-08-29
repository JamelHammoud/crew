import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { commandTyped, commandsIn, threadCommands } from '../src/shared/commands'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider, makeSteerableProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>
type Notice = Extract<ServerMessage, { type: 'notice' }>

const settle = () => new Promise(r => setTimeout(r, 300))

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const image = () => ({ name: 'shot.png', mime: 'image/png', data: PNG.toString('base64') })

// What the agent was handed under the one heading a thread is read to it under.
// The talk inside it carries whole prompts of its own, since the fake CLI
// answers with what it was given, so this is read from the first heading on.
const soFar = (text: string | undefined): string => (text ?? '').slice((text ?? '').indexOf('Thread so far:'))

describe('what a thread offers to fork with', () => {
  it('carries on from here whether or not there is a turn to go into', () => {
    const idle = threadCommands(false).map(command => command.name)
    expect(idle).toContain('fork')
    expect(idle).toContain('btw')
    expect(idle).not.toContain('steer')
    expect(idle).not.toContain('queue')

    const live = threadCommands(true).map(command => command.name)
    expect(live).toEqual(['steer', 'queue', 'btw', 'fork', 'goal', 'fallback'])
  })

  it('is a thread’s own, so the chat never offers it', () => {
    expect(commandsIn('chat').map(command => command.name)).not.toContain('fork')
  })

  it('is read off the whole of what was typed and nowhere else', () => {
    const idle = threadCommands(false)
    expect(commandTyped('/fork ', idle)).toBe('fork')
    expect(commandTyped('/Fork ', idle)).toBe('fork')
    expect(commandTyped('carry on and /fork it ', idle)).toBe(null)
    expect(commandTyped('/fork', idle)).toBe(null)
    // With no turn to go into neither of the live ones is offered, so neither
    // can be typed either.
    expect(commandTyped('/steer ', idle)).toBe(null)
    expect(commandTyped('/steer ', threadCommands(true))).toBe('steer')
  })
})

describe('forking a thread', () => {
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

  async function connectRunner(name: string, steerable: boolean, env: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
      name,
      code: host.code,
      repoPath: host.repoPath,
      providers: [steerable ? makeSteerableProvider(env) : makeFakeProvider(env)],
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

  async function connectUi(name: string) {
    const ui = await TestUi.connect(host.url, name, host.code)
    uis.push(ui)
    return ui
  }

  const steery = agentId('sam', 'steery')
  const samsFake = agentId('sam', 'fake')
  const patsFake = agentId('pat', 'fake')

  // A thread with one turn in it and the answer already back, which is the place
  // anybody forks from.
  async function threadWith(ui: TestUi, text: string, mentions: string[], commands?: ('plan' | 'tickets')[]) {
    ui.chat(text, mentions, undefined, commands)
    const thread = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)
    return thread
  }

  async function say(ui: TestUi, text: string, threadId: string) {
    ui.chat(text, [], threadId)
    return (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === threadId && e.text?.includes(text) === true
    )) as Ended
  }

  function fork(ui: TestUi, text: string, threadId: string, mentions: string[] = [], forkId?: string) {
    ui.send({ type: 'chat.send', text, mentions, threadId, commands: ['fork'], forkId })
  }

  // Several forks off one thread all point at it, so the one this call opened is
  // the one nothing has seen before rather than the first that matches.
  async function forked(ui: TestUi, text: string, threadId: string, mentions: string[] = [], forkId?: string) {
    const seen = new Set(ui.events.filter(e => e.kind === 'thread.started').map(e => e.threadId))
    fork(ui, text, threadId, mentions, forkId)
    return (await ui.waitForEvent(
      e => e.kind === 'thread.started' && e.forkedFrom === threadId && !seen.has(e.threadId)
    )) as Started
  }

  it('opens a thread of its own and leaves the one it came from exactly as it was', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake tidy the readme', [samsFake])
    const before = Date.now()
    const said = sam.messages.length
    const carried = await forked(sam, 'try the changelog instead', thread.threadId)

    expect(carried.threadId).not.toBe(thread.threadId)
    expect(carried.forkedFrom).toBe(thread.threadId)
    expect(carried.forkedAt).toBeGreaterThanOrEqual(before)
    // Nobody was named, so it goes on under the agent that was already on it.
    expect(carried.agentId).toBe(samsFake)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === carried.threadId)
    await settle()

    // The thread it came from got none of it: no message, no run, nothing held.
    const parent = sam.events.filter(e => 'threadId' in e && e.threadId === thread.threadId)
    expect(parent.some(e => e.kind === 'message' && e.text === 'try the changelog instead')).toBe(false)
    expect(parent.filter(e => e.kind === 'agent.start')).toHaveLength(1)
    expect(parent.some(e => e.kind === 'thread.agent')).toBe(false)
    expect(sam.messages.slice(said).some(m => m.type === 'queue.state' && m.threadId === thread.threadId)).toBe(false)
  })

  it('reads what was said before it, in one run of talk, and none of what was said after', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake the readme is stale', [samsFake])
    const carried = await forked(sam, 'carry on with the changelog', thread.threadId)
    const first = (await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === carried.threadId)) as Ended

    // The fake CLI echoes the prompt it was handed, so the answer says what the
    // fork was given to read.
    expect(first.text).toContain('the readme is stale')
    expect(first.text).toContain('carry on with the changelog')
    // One run of talk rather than a thread and a conversation about it, so what
    // was said before the fork stands ahead of what has been said since under
    // the one heading, and nothing anywhere says a fork was made.
    const block = soFar(first.text)
    expect(block.indexOf('the readme is stale')).toBeLessThan(block.indexOf('carry on with the changelog'))
    expect(first.text).not.toContain('The thread, which you are not in:')
    expect(first.text).not.toContain('Your conversation on the side:')
    expect(first.text).not.toContain('forked')

    // The thread it came from carries on without it, and none of that reaches
    // the fork on a later turn.
    await say(sam, 'never mind, do the licence', thread.threadId)
    const later = await say(sam, 'and the version number', carried.threadId)
    expect(later.text).toContain('the readme is stale')
    expect(later.text).toContain('carry on with the changelog')
    expect(later.text).toContain('and the version number')
    expect(later.text).not.toContain('never mind, do the licence')
  })

  it('leaves an unfinished parent request behind', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false, { FAKE_CLI_DELAY_MS: '200' })
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake settle the release notes', [samsFake])
    sam.chat('replace every settings screen', [], thread.threadId)
    await sam.waitForEvent(
      e => e.kind === 'agent.start' && e.threadId === thread.threadId && e.promptText === 'replace every settings screen'
    )

    const carried = await forked(sam, 'only fix the empty state', thread.threadId)
    const answer = (await sam.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === carried.threadId
    )) as Ended

    expect(answer.text).toContain('settle the release notes')
    expect(answer.text).toContain('only fix the empty state')
    expect(answer.text).not.toContain('replace every settings screen')
  })

  it('takes the agent it is handed, and the thread’s own where none is', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await connectRunner('sam', true)
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 2)

    const thread = await threadWith(sam, '@Fake tidy the readme', [samsFake])
    const carried = await forked(sam, 'try it with @Steery', thread.threadId, [steery])
    expect(carried.agentId).toBe(steery)
    // The thread it came from keeps the agent it had.
    expect(sam.events.some(e => e.kind === 'thread.agent' && e.threadId === thread.threadId)).toBe(false)

    const plain = await forked(sam, 'and one more way', thread.threadId)
    expect(plain.agentId).toBe(samsFake)
  })

  it('carries the plan, the board and the tickets in with it', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.send({ type: 'design.create', boardId: 'the-board', name: 'The board' })
    await sam.waitFor(m => m.type === 'design.boards' && m.boards.some(b => b.id === 'the-board'))

    sam.send({
      type: 'chat.send',
      text: '@Fake work out the rewrite',
      mentions: [samsFake],
      commands: ['plan', 'tickets'],
      boardId: 'the-board'
    })
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(thread.mode).toBe('plan')
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    const carried = await forked(sam, 'carry on the other way', thread.threadId)
    expect(carried.mode).toBe('plan')
    expect(carried.boardId).toBe('the-board')
    expect(carried.tickets).toBe(true)
  })

  it('carries the plan the thread agreed on once it is being built', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake work out the rewrite', [samsFake], ['plan'])
    await sam.waitForEvent(e => e.kind === 'thread.plan' && e.threadId === thread.threadId)
    sam.send({ type: 'plan.implement', threadId: thread.threadId })
    await sam.waitForEvent(e => e.kind === 'thread.implement' && e.threadId === thread.threadId)

    const carried = await forked(sam, 'carry on the other way', thread.threadId)
    expect(carried.mode).toBeUndefined()
    const answer = (await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === carried.threadId)) as Ended
    expect(answer.text).toContain('The plan this thread agreed on:')
  })

  it('opens under the id it was asked for, and names one itself where it cannot', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake tidy the readme', [samsFake])

    const asked = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    const mine = await forked(sam, 'carry on here', thread.threadId, [], asked)
    expect(mine.threadId).toBe(asked)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === mine.threadId)

    const junk = await forked(sam, 'and another way', thread.threadId, [], 'not-a-uuid')
    expect(junk.threadId).not.toBe('not-a-uuid')
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === junk.threadId)

    // An id something already answers to is named again rather than taken, or
    // one fork would land on top of another.
    const taken = await forked(sam, 'and one more', thread.threadId, [], asked)
    expect(taken.threadId).not.toBe(asked)
    expect(taken.threadId).not.toBe(thread.threadId)
  })

  it('says why a fork with nothing to carry on with did not happen, to the one who asked', async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake tidy the readme', [samsFake])
    sam.send({
      type: 'chat.send',
      text: '   ',
      mentions: [],
      threadId: thread.threadId,
      commands: ['fork'],
      attachments: [image()]
    })

    const notice = (await sam.waitFor(msg => msg.type === 'notice')) as Notice
    expect(notice.text).toBe('Say what to carry on with.')
    await settle()
    expect(pat.messages.some(m => m.type === 'notice')).toBe(false)
    expect(sam.events.some(e => e.kind === 'thread.started' && e.forkedFrom !== undefined)).toBe(false)
    // Nothing landed in the thread it was asked from either.
    const inThread = sam.events.filter(e => 'threadId' in e && e.threadId === thread.threadId)
    expect(inThread.filter(e => e.kind === 'message')).toHaveLength(1)
  })

  it('a fork with nothing in it at all does nothing at all', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(sam, '@Fake tidy the readme', [samsFake])
    fork(sam, '   ', thread.threadId)
    await settle()

    expect(sam.messages.some(m => m.type === 'notice')).toBe(false)
    expect(sam.events.some(e => e.kind === 'thread.started' && e.forkedFrom !== undefined)).toBe(false)
  })

  it('says why a fork nobody can take did not happen', async () => {
    const sam = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('pat', false)
    await pat.waitForEvent(e => e.kind === 'agent.online')

    const thread = await threadWith(pat, '@Fake tidy the readme', [patsFake])
    // The thread's own agent has been taken out of the crew, so there is nobody
    // for the fork to open on and nobody stands in for it.
    pat.send({ type: 'agent.remove', agentId: patsFake })
    await sam.waitFor(m => m.type === 'agent.removed' && m.agentId === patsFake)

    fork(sam, 'carry on here', thread.threadId)
    const notice = (await sam.waitFor(msg => msg.type === 'notice')) as Notice
    expect(notice.text).toBe('Mention an agent with @ to say who should take it.')
    await settle()
    expect(sam.events.some(e => e.kind === 'thread.started' && e.forkedFrom === thread.threadId)).toBe(false)
  })

  it('a fork of a hidden thread is hidden, so nobody else sees it and nothing is written down', async () => {
    const sam = await connectUi('sam')
    const samSecondWindow = await connectUi('sam')
    const pat = await connectUi('pat')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('@Fake tidy the readme', [samsFake], undefined, ['ghost'])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(thread.ghost).toBe(true)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    const carried = await forked(sam, 'carry on with the changelog', thread.threadId)
    expect(carried.ghost).toBe(true)
    const answer = (await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === carried.threadId)) as Ended
    expect(answer.text).toContain('tidy the readme')
    await settle()

    // Two windows on one folder are one member and two different people here.
    for (const other of [samSecondWindow, pat]) {
      expect(other.events.some(e => 'threadId' in e && e.threadId === carried.threadId)).toBe(false)
      expect(other.steps.some(step => step.threadId === carried.threadId)).toBe(false)
    }

    const revived = new CrewSession(host.store).snapshot()
    expect(revived.events.some(e => 'threadId' in e && e.threadId === carried.threadId)).toBe(false)
    expect(revived.events.some(e => e.kind === 'message' && e.text === 'carry on with the changelog')).toBe(false)
  })

  it('a fork of a hidden thread only ever runs on an agent of your own', async () => {
    const sam = await connectUi('sam')
    await connectRunner('pat', false)
    await connectRunner('sam', true)
    await waitUntil(() => sam.events.filter(e => e.kind === 'agent.online').length === 2)

    sam.chat('@Steery tidy the readme', [steery], undefined, ['ghost'])
    const thread = (await sam.waitForEvent(e => e.kind === 'thread.started')) as Started
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === thread.threadId)

    // Pat's agent is named, and a hidden thread cannot go to somebody else's
    // machine, so it reads the way naming an agent who is not here reads.
    const carried = await forked(sam, 'carry on with the changelog', thread.threadId, [patsFake])
    expect(carried.ghost).toBe(true)
    expect(carried.agentId).toBe(steery)
  })

  it('reads the whole line it came down, and none of what any of them did after', async () => {
    const sam = await connectUi('sam')
    await connectRunner('sam', false)
    await sam.waitForEvent(e => e.kind === 'agent.online')

    const alpha = await threadWith(sam, '@Fake alpha one', [samsFake])
    const beta = await forked(sam, 'beta one', alpha.threadId)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === beta.threadId)

    await say(sam, 'alpha two', alpha.threadId)

    const gamma = await forked(sam, 'gamma one', beta.threadId)
    await sam.waitForEvent(e => e.kind === 'agent.end' && e.threadId === gamma.threadId)
    expect(gamma.forkedFrom).toBe(beta.threadId)

    await say(sam, 'beta two', beta.threadId)

    const answer = await say(sam, 'gamma two', gamma.threadId)
    expect(answer.text).toContain('alpha one')
    expect(answer.text).toContain('beta one')
    expect(answer.text).toContain('gamma one')
    expect(answer.text).not.toContain('alpha two')
    expect(answer.text).not.toContain('beta two')
    // The line runs oldest first, all of it under the one heading.
    const block = soFar(answer.text)
    expect(block.indexOf('alpha one')).toBeLessThan(block.indexOf('beta one'))
    expect(block.indexOf('beta one')).toBeLessThan(block.indexOf('gamma one'))
    expect(block.indexOf('gamma one')).toBeLessThan(block.indexOf('gamma two'))
  })
})
