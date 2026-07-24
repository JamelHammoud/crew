import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { CrewSession } from '../src/server/session'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { agentStepReactionTarget, messageReactionTarget } from '../src/shared/reactions'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type AgentStart = Extract<SessionEvent, { kind: 'agent.start' }>
type AgentEnd = Extract<SessionEvent, { kind: 'agent.end' }>
type Reaction = Extract<SessionEvent, { kind: 'message.reaction' }>

describe('message reactions', () => {
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

  it('shows a person reaction to everyone, toggles it, and replays it after restart', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('hello there')
    const message = await bob.waitForEvent(event => event.kind === 'message' && event.text === 'hello there')
    const targetId = messageReactionTarget(message.id)

    bob.send({ type: 'chat.react', targetId, emoji: '❤️' })
    const added = (await alice.waitForEvent(
      event => event.kind === 'message.reaction' && event.targetId === targetId && event.active
    )) as Reaction

    expect(added.memberName).toBe('bob')
    expect(added.targetAuthorName).toBe('alice')
    expect(host.session.snapshot().events).toContainEqual(added)

    bob.send({ type: 'chat.react', targetId, emoji: '❤️' })
    const removed = (await alice.waitForEvent(
      event =>
        event.kind === 'message.reaction' &&
        event.targetId === targetId &&
        event.id !== added.id &&
        !event.active
    )) as Reaction

    expect(removed.memberId).toBe(added.memberId)
    expect(new CrewSession(host.store).snapshot().events).toContainEqual(removed)
  })

  it('delivers feedback on an agent reply only to that agent on its next start', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = new Runner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider({ FAKE_CLI_DELAY_MS: '150' })],
      agents: [
        { instanceId: 'a', provider: 'fake', name: 'Fake A', settings: {} },
        { instanceId: 'b', provider: 'fake', name: 'Fake B', settings: {} }
      ],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(host.url)

    const idA = agentId('jamel', 'a')
    const idB = agentId('jamel', 'b')
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === idA)
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === idB)

    ui.chat('first task @Fake A', [idA])
    const thread = (await ui.waitForEvent(
      event => event.kind === 'thread.started' && event.agentId === idA
    )) as Started
    const firstEnd = (await ui.waitForEvent(
      event => event.kind === 'agent.end' && event.threadId === thread.threadId
    )) as AgentEnd
    const reply = host.store
      .loadEvents()
      .find(
        (event): event is Extract<SessionEvent, { kind: 'agent.step' }> =>
          event.kind === 'agent.step' && event.promptId === firstEnd.promptId && event.step.kind === 'text'
      )
    expect(reply).toBeTruthy()

    ui.chat('second task', [], thread.threadId)
    const current = (await ui.waitForEvent(
      event =>
        event.kind === 'agent.start' &&
        event.threadId === thread.threadId &&
        event.promptId !== firstEnd.promptId
    )) as AgentStart

    const targetId = agentStepReactionTarget(firstEnd.promptId, reply!.step.id)
    ui.send({ type: 'chat.react', targetId, emoji: '👍' })
    const reaction = (await ui.waitForEvent(
      event => event.kind === 'message.reaction' && event.targetId === targetId
    )) as Reaction
    expect(current.reactionIds).toBeUndefined()
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === current.promptId)

    ui.chat('other agent @Fake B', [idB])
    const otherStart = (await ui.waitForEvent(
      event => event.kind === 'agent.start' && event.agentId === idB
    )) as AgentStart
    expect(otherStart.reactionIds).toBeUndefined()
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === otherStart.promptId)

    ui.chat('third task', [], thread.threadId)
    const delivered = (await ui.waitForEvent(
      event =>
        event.kind === 'agent.start' &&
        event.threadId === thread.threadId &&
        event.promptId !== current.promptId &&
        event.reactionIds?.includes(reaction.id) === true
    )) as AgentStart
    const deliveredEnd = (await ui.waitForEvent(
      event => event.kind === 'agent.end' && event.promptId === delivered.promptId
    )) as AgentEnd
    expect(deliveredEnd.text).toContain('sam reacted 👍 to your message')

    ui.chat('fourth task', [], thread.threadId)
    const next = (await ui.waitForEvent(
      event =>
        event.kind === 'agent.start' &&
        event.threadId === thread.threadId &&
        event.promptId !== delivered.promptId &&
        event.promptText === 'fourth task'
    )) as AgentStart
    expect(next.reactionIds).toBeUndefined()
  })
})
