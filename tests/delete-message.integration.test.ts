import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CrewSession } from '../src/server/session'
import { startHost, TestUi, type TestHost } from './helpers/session'

describe('deleting messages', () => {
  let host: TestHost
  let uis: TestUi[] = []

  beforeEach(async () => {
    host = await startHost()
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('removes the author\'s message for everyone and stays gone after a restart', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('oops wrong channel')
    const msg = await bob.waitForEvent(e => e.kind === 'message' && e.text === 'oops wrong channel')

    alice.send({ type: 'chat.delete', messageId: msg.id })
    const tombstone = await bob.waitForEvent(e => e.kind === 'message.deleted')
    expect(tombstone.kind === 'message.deleted' ? tombstone.messageId : '').toBe(msg.id)
    expect(host.session.snapshot().events.some(e => e.id === msg.id)).toBe(false)

    const revived = new CrewSession(host.store)
    const events = revived.snapshot().events
    expect(events.some(e => e.id === msg.id)).toBe(false)
    expect(events.some(e => e.kind === 'message.deleted')).toBe(false)
  })

  it('ignores a delete from someone who is not the author', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)

    alice.chat('mine to keep')
    const msg = await bob.waitForEvent(e => e.kind === 'message' && e.text === 'mine to keep')

    bob.send({ type: 'chat.delete', messageId: msg.id })
    await new Promise(r => setTimeout(r, 200))
    expect(host.session.snapshot().events.some(e => e.id === msg.id)).toBe(true)
  })
})
