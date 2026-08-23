import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agentId } from '../src/shared/llm'
import type { SessionEvent } from '../src/shared/events'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
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

  async function connectRunner(name: string, env: NodeJS.ProcessEnv = {}) {
    const runner = testRunner({
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

    const starts: string[] = []
    while (starts.length < 3) {
      const next = (await ui.waitForEvent(
        event =>
          event.kind === 'agent.start' &&
          event.threadId === started.threadId &&
          ['one', 'two', 'three'].includes(event.promptText) &&
          !starts.includes(event.promptText)
      )) as Extract<SessionEvent, { kind: 'agent.start' }>
      starts.push(next.promptText)
    }
    expect(starts).toEqual(['two', 'three', 'one'])
  }, 10000)
})
