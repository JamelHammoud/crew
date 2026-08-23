import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Runner } from '../src/runner'
import { agentId } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { testRunner } from './helpers/runner'
import { startHost, TestUi, tmpDir } from './helpers/session'

describe('personal chat history', () => {
  const uis: TestUi[] = []
  const runners: Runner[] = []
  const hosts: Array<Awaited<ReturnType<typeof startHost>>> = []

  afterEach(async () => {
    for (const ui of uis.splice(0)) ui.close()
    for (const runner of runners.splice(0)) runner.close()
    await Promise.all(hosts.splice(0).map(host => host.close()))
  })

  it('starts under the id its window chose and keeps rename and delete across restarts', async () => {
    const folder = tmpDir('personal-history')
    const first = await startHost(folder)
    hosts.push(first)
    const ui = await TestUi.connect(first.url, 'Jamel', first.code)
    uis.push(ui)
    const runner = testRunner({
      name: 'Jamel',
      code: first.code,
      repoPath: folder,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(first.url)
    await ui.waitForEvent(event => event.kind === 'agent.online')

    const threadId = randomUUID()
    ui.send({
      type: 'chat.send',
      text: 'A quick question',
      mentions: [agentId('jamel', 'fake')],
      startId: threadId
    })
    await ui.waitForEvent(event => event.kind === 'thread.started' && event.threadId === threadId)
    await ui.waitForEvent(event => event.kind === 'agent.end' && event.threadId === threadId)

    ui.send({ type: 'thread.rename', threadId, title: 'The useful answer' })
    await ui.waitForEvent(
      event => event.kind === 'thread.renamed' && event.threadId === threadId && event.title === 'The useful answer'
    )

    ui.close()
    runner.close()
    await first.close()
    uis.splice(0)
    runners.splice(0)
    hosts.splice(0)

    const second = await startHost(folder)
    hosts.push(second)
    expect(
      second.session
        .snapshot()
        .threadEvents.some(
          event => event.kind === 'thread.renamed' && event.threadId === threadId && event.title === 'The useful answer'
        )
    ).toBe(true)

    const secondUi = await TestUi.connect(second.url, 'Jamel', second.code)
    uis.push(secondUi)
    secondUi.send({ type: 'thread.delete', threadId })
    await secondUi.waitForEvent(event => event.kind === 'thread.deleted' && event.threadId === threadId)
    secondUi.close()
    await second.close()
    uis.splice(0)
    hosts.splice(0)

    const third = await startHost(folder)
    hosts.push(third)
    const events = third.session.snapshot().threadEvents
    expect(events.some(event => event.kind === 'thread.started' && event.threadId === threadId)).toBe(false)
    expect(events.some(event => event.kind === 'thread.deleted' && event.threadId === threadId)).toBe(true)
  })
})
