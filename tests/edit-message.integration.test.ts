import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { CrewSession } from '../src/server/session'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Message = Extract<SessionEvent, { kind: 'message' }>

describe('editing messages', () => {
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
    const runner = testRunner({
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

  const messageText = (events: SessionEvent[], id: string) =>
    (events.find(e => e.kind === 'message' && e.id === id) as Message | undefined)?.text

  it('rewrites the author\'s message for everyone and keeps it after a restart', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('meating at 3')
    const msg = await bob.waitForEvent(e => e.kind === 'message' && e.text === 'meating at 3')

    alice.send({ type: 'chat.edit', messageId: msg.id, text: 'meeting at 3' })
    const edit = await bob.waitForEvent(e => e.kind === 'message.edited')
    expect(edit.kind === 'message.edited' ? edit.text : '').toBe('meeting at 3')
    expect(messageText(host.session.snapshot().events, msg.id)).toBe('meeting at 3')

    const revived = new CrewSession(host.store)
    const events = revived.snapshot().events
    expect(messageText(events, msg.id)).toBe('meeting at 3')
    expect(events.some(e => e.kind === 'message.edited')).toBe(false)
  })

  it('ignores an edit from someone who is not the author', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('mine to word')
    const msg = await bob.waitForEvent(e => e.kind === 'message' && e.text === 'mine to word')

    bob.send({ type: 'chat.edit', messageId: msg.id, text: 'not yours to word' })
    await new Promise(r => setTimeout(r, 200))
    expect(messageText(host.session.snapshot().events, msg.id)).toBe('mine to word')
  })

  it('leaves a thread message alone', async () => {
    const sam = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(sam)
    await connectRunner('jamel')
    await sam.waitForEvent(e => e.kind === 'agent.online')

    sam.chat('look at the readme', [agentId('jamel', 'fake')])
    const started = await sam.waitForEvent(e => e.kind === 'thread.started')
    const threadId = started.kind === 'thread.started' ? started.threadId : ''
    const msg = (await sam.waitForEvent(
      e => e.kind === 'message' && e.threadId === threadId && e.text === 'look at the readme'
    )) as Message

    sam.send({ type: 'chat.edit', messageId: msg.id, text: 'look at the changelog' })
    await new Promise(r => setTimeout(r, 200))
    expect(messageText(host.session.snapshot().events, msg.id)).toBe('look at the readme')
    expect(sam.events.some(e => e.kind === 'message.edited')).toBe(false)
  })

  it('drops an empty edit', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    alice.chat('still here')
    const msg = await alice.waitForEvent(e => e.kind === 'message' && e.text === 'still here')

    alice.send({ type: 'chat.edit', messageId: msg.id, text: '   ' })
    await new Promise(r => setTimeout(r, 200))
    expect(messageText(host.session.snapshot().events, msg.id)).toBe('still here')
  })
})
