import { afterEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { startHost, TestUi, type TestHost } from './helpers/session'

describe('member mentions', () => {
  let host: TestHost | undefined
  const clients: TestUi[] = []

  afterEach(async () => {
    for (const client of clients) client.close()
    await host?.close()
  })

  it('records the member named in a chat message', async () => {
    host = await startHost()
    const jamel = await TestUi.connect(host.url, 'Jamel', host.code)
    const ali = await TestUi.connect(host.url, 'ALI', host.code)
    clients.push(jamel, ali)

    ali.chat('Can you look at this @Jamel?')

    const event = (await jamel.waitForEvent(
      candidate => candidate.kind === 'message' && candidate.text === 'Can you look at this @Jamel?'
    )) as Extract<SessionEvent, { kind: 'message' }>
    expect(event.memberMentionRefs).toEqual([{ id: jamel.selfId, name: 'Jamel' }])
    expect(event.mentions).toEqual([])
  })
})
