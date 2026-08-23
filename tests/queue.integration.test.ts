import fs from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { Runner } from '../src/runner'
import { makeFakeProvider, makeSteerableProvider } from './helpers/fake-provider'
import { startHost, TestUi, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>

describe('queued messages', () => {
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

  async function connectRunner(name: string, env: NodeJS.ProcessEnv = {}, steerable = false) {
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

  function queueOf(threadId: string) {
    return host.session.snapshot().queues[threadId] ?? []
  }

  async function queuedFollowUp(ui: TestUi, text: string) {
    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.chat(text, [], started.threadId)
    await waitUntil(() => queueOf(started.threadId).some(item => item.text === text))
    const item = queueOf(started.threadId).find(q => q.text === text)!
    return { started, item }
  }

  it('does not show an idle message in the queue on its way into a run', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '300' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const from = ui.messages.length
    ui.chat('start now @Fake', [agentId('jamel', 'fake')])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)

    const queueStates = ui.messages
      .slice(from)
      .filter(
        (message): message is Extract<(typeof ui.messages)[number], { type: 'queue.state' }> =>
          message.type === 'queue.state' && message.threadId === started.threadId
      )
    expect(queueStates.some(message => message.items.length > 0)).toBe(false)
  })

  it('keeps a queued message out of the thread until it runs, and applies edits', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { item } = await queuedFollowUp(ui, 'first draft')
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'first draft')).toBe(false)

    ui.send({ type: 'queue.edit', promptId: item.promptId, text: 'final version' })
    const start = (await ui.waitForEvent(e => e.kind === 'agent.start' && e.promptId === item.promptId)) as Extract<
      SessionEvent,
      { kind: 'agent.start' }
    >
    expect(start.promptText).toBe('final version')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'final version')
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'first draft')).toBe(false)
  })

  it('removes a queued message so it never runs or appears', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '600' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const { started, item } = await queuedFollowUp(ui, 'never mind')
    ui.send({ type: 'queue.remove', promptId: item.promptId })
    await waitUntil(() => queueOf(started.threadId).length === 0)

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)
    await new Promise(r => setTimeout(r, 300))
    expect(ui.events.some(e => e.kind === 'agent.start' && e.promptId === item.promptId)).toBe(false)
    expect(ui.events.some(e => e.kind === 'message' && e.text === 'never mind')).toBe(false)
  })

  it('sends a queued message into the active turn now', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '900' }, true)
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const steery = agentId('jamel', 'steery')
    ui.chat('start @Steery', [steery])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const active = await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    if (active.kind !== 'agent.start') throw new Error('expected agent.start')
    await ui.waitFor(message => message.type === 'agent.step' && message.promptId === active.promptId)

    ui.chat('send this now', [], started.threadId, ['queue'])
    await waitUntil(() => queueOf(started.threadId).some(item => item.text === 'send this now'))
    const item = queueOf(started.threadId).find(queued => queued.text === 'send this now')!
    ui.send({ type: 'queue.send', promptId: item.promptId })

    await waitUntil(() => queueOf(started.threadId).every(queued => queued.promptId !== item.promptId))
    const route = await ui.waitForEvent(
      event => event.kind === 'message.route' && event.messageId === item.promptId && event.mode === 'steered'
    )
    expect(route.kind === 'message.route' && route.promptId).toBe(active.promptId)
    const ended = await ui.waitForEvent(event => event.kind === 'agent.end' && event.promptId === active.promptId)
    expect(ended.kind === 'agent.end' && ended.text).toContain('steered:New message from sam: send this now')
    expect(ui.events.filter(event => event.kind === 'agent.start')).toHaveLength(1)
  })

  it('returns the whole queued message to its author for editing', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '900' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.send({
      type: 'chat.send',
      text: 'look at this\nthen fix it',
      mentions: [],
      threadId: started.threadId,
      attachments: [{ name: 'note.txt', mime: 'text/plain', data: Buffer.from('the note').toString('base64') }]
    })
    await waitUntil(() => queueOf(started.threadId).length === 1)
    const item = queueOf(started.threadId)[0]
    expect(item.attachments?.map(attachment => attachment.name)).toEqual(['note.txt'])

    ui.send({ type: 'queue.take', promptId: item.promptId })
    const taken = await ui.waitFor(message => message.type === 'queue.taken')
    expect(taken).toMatchObject({
      type: 'queue.taken',
      threadId: started.threadId,
      item: { promptId: item.promptId, text: 'look at this\nthen fix it' },
      attachments: [{ name: 'note.txt', mime: 'text/plain', data: Buffer.from('the note').toString('base64') }]
    })
    await waitUntil(() => queueOf(started.threadId).length === 0)

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(ui.events.some(e => e.kind === 'agent.start' && e.promptId === item.promptId)).toBe(false)
  })

  it('keeps a queued message when one of its files cannot be restored', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '900' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.send({
      type: 'chat.send',
      text: 'keep this safe',
      mentions: [],
      threadId: started.threadId,
      attachments: [{ name: 'note.txt', mime: 'text/plain', data: Buffer.from('the note').toString('base64') }]
    })
    await waitUntil(() => queueOf(started.threadId).length === 1)
    const item = queueOf(started.threadId)[0]
    const file = host.store.attachmentPath(item.attachments![0].file)!
    fs.rmSync(file)

    ui.send({ type: 'queue.take', promptId: item.promptId })
    const failed = await ui.waitFor(
      message => message.type === 'queue.take.failed' && message.promptId === item.promptId
    )
    expect(failed).toMatchObject({ type: 'queue.take.failed', message: 'One of the files could not be opened.' })
    expect(queueOf(started.threadId).map(queued => queued.promptId)).toContain(item.promptId)
  })

  it('runs queued messages in the order their author chose', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel', { FAKE_CLI_DELAY_MS: '1200' })
    await ui.waitForEvent(e => e.kind === 'agent.online')

    const fake = agentId('jamel', 'fake')
    ui.chat('start @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    await ui.waitForEvent(e => e.kind === 'agent.start' && e.threadId === started.threadId)
    ui.chat('one', [], started.threadId)
    ui.chat('two', [], started.threadId)
    ui.chat('three', [], started.threadId)
    await waitUntil(() => queueOf(started.threadId).length === 3)

    const one = queueOf(started.threadId).find(item => item.text === 'one')!
    ui.send({ type: 'queue.move', promptId: one.promptId, to: 2 })
    await waitUntil(() => queueOf(started.threadId).map(item => item.text).join(',') === 'two,three,one')

    await waitUntil(
      () =>
        host.session
          .snapshot()
          .events.filter(
            event =>
              event.kind === 'agent.start' &&
              event.threadId === started.threadId &&
              ['one', 'two', 'three'].includes(event.promptText)
          ).length === 3
    )
    const starts = host.session
      .snapshot()
      .events.filter(
        (event): event is Extract<SessionEvent, { kind: 'agent.start' }> =>
          event.kind === 'agent.start' &&
          event.threadId === started.threadId &&
          ['one', 'two', 'three'].includes(event.promptText)
      )
      .map(event => event.promptText)
    expect(starts).toEqual(['two', 'three', 'one'])
  }, 20000)
})
