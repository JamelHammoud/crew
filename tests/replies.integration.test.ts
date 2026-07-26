import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { CrewSession } from '../src/server/session'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { agentStepReactionTarget, messageReactionTarget } from '../src/shared/reactions'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Message = Extract<SessionEvent, { kind: 'message' }>
type Started = Extract<SessionEvent, { kind: 'thread.started' }>

describe('message replies', () => {
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

  it('stores a reply to a person and replays its quoted context', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('The launch is Tuesday')
    const original = (await bob.waitForEvent(
      event => event.kind === 'message' && event.text === 'The launch is Tuesday'
    )) as Message

    bob.send({
      type: 'chat.send',
      text: 'That works for me',
      mentions: [],
      replyTo: messageReactionTarget(original.id)
    })
    const reply = (await alice.waitForEvent(
      event => event.kind === 'message' && event.text === 'That works for me'
    )) as Message

    expect(reply.replyTo).toEqual({
      targetId: messageReactionTarget(original.id),
      authorId: original.authorId,
      authorName: 'alice',
      text: 'The launch is Tuesday'
    })
    expect(new CrewSession(host.store).snapshot().events).toContainEqual(reply)
  })

  it('replies to an agent response inside its thread', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'fake', provider: 'fake', name: 'Fake', settings: {} }]
    })
    runners.push(runner)
    runner.connect(host.url)

    const fake = agentId('jamel', 'fake')
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === fake)
    ui.chat('start here @Fake', [fake])
    const thread = (await ui.waitForEvent(event => event.kind === 'thread.started')) as Started
    const end = await ui.waitForEvent(
      event => event.kind === 'agent.end' && event.threadId === thread.threadId
    )
    const step = host.store
      .loadEvents()
      .find(
        event =>
          event.kind === 'agent.step' &&
          event.promptId === ('promptId' in end ? end.promptId : '') &&
          event.step.kind === 'text'
      )
    expect(step?.kind).toBe('agent.step')
    if (!step || step.kind !== 'agent.step') return

    const targetId = agentStepReactionTarget(step.promptId, step.step.id)
    ui.send({
      type: 'chat.send',
      text: 'Tell me more',
      mentions: [],
      threadId: thread.threadId,
      replyTo: targetId
    })
    const reply = (await ui.waitForEvent(
      event => event.kind === 'message' && event.text === 'Tell me more'
    )) as Message

    expect(reply.replyTo).toEqual({
      targetId,
      authorId: fake,
      authorName: 'Fake',
      text: step.step.text
    })
  })

  it('quotes your own earlier message when you reply to yourself in a thread', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'fake', provider: 'fake', name: 'Fake', settings: {} }]
    })
    runners.push(runner)
    runner.connect(host.url)

    const fake = agentId('jamel', 'fake')
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === fake)
    ui.chat('look at the composer @Fake', [fake])
    const thread = (await ui.waitForEvent(event => event.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(
      event => event.kind === 'message' && event.threadId === thread.threadId
    )) as Message
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.threadId === thread.threadId)

    const targetId = messageReactionTarget(first.id)
    ui.send({
      type: 'chat.send',
      text: 'this one',
      mentions: [],
      threadId: thread.threadId,
      replyTo: targetId
    })
    const reply = (await ui.waitForEvent(
      event => event.kind === 'message' && event.text === 'this one'
    )) as Message

    expect(reply.replyTo).toEqual({
      targetId,
      authorId: first.authorId,
      authorName: 'sam',
      text: 'look at the composer @Fake'
    })
  })

  it('quotes a message said in a thread when the reply goes to the main chat', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'jamel',
      code: host.code,
      repoPath: host.repoPath,
      providers: [makeFakeProvider()],
      agents: [{ instanceId: 'fake', provider: 'fake', name: 'Fake', settings: {} }]
    })
    runners.push(runner)
    runner.connect(host.url)

    const fake = agentId('jamel', 'fake')
    await ui.waitForEvent(event => event.kind === 'agent.online' && event.agentId === fake)
    ui.chat('inside a thread @Fake', [fake])
    const thread = (await ui.waitForEvent(event => event.kind === 'thread.started')) as Started
    const inThread = (await ui.waitForEvent(
      event => event.kind === 'message' && event.threadId === thread.threadId
    )) as Message

    const targetId = messageReactionTarget(inThread.id)
    ui.send({ type: 'chat.send', text: 'out here', mentions: [], replyTo: targetId })
    const reply = (await ui.waitForEvent(
      event => event.kind === 'message' && event.text === 'out here'
    )) as Message

    expect(reply.replyTo?.targetId).toBe(targetId)
    expect(reply.replyTo?.text).toBe('inside a thread @Fake')
  })
})
