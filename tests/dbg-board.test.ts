import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

describe('debug', () => {
  let host: TestHost
  beforeEach(async () => { host = await startHost() })
  afterEach(async () => { await host.close() })

  it('rename then follow up', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    const runner = testRunner({ name: 'jamel', code: host.code, repoPath: host.repoPath, providers: [makeFakeProvider()], reconnectDelayMs: 100 })
    runner.connect(host.url)
    await new Promise<void>(resolve => { runner.onStatus = s => { if (s === 'online') resolve() } })
    ui.send({ type: 'design.create', boardId: 'flow-1abc', name: 'Flow' })
    await ui.waitFor(m => m.type === 'design.boards' && m.boards.some(b => b.id === 'flow-1abc'))
    const fake = agentId('jamel', 'fake')
    ui.chat('take a look at #Flow @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    console.log('FIRST OK', first.ok, (first.text ?? '').slice(0, 200))
    ui.send({ type: 'design.rename', boardId: 'flow-1abc', name: 'Checkout' })
    await ui.waitFor(m => m.type === 'design.boards' && m.boards.some(b => b.name === 'Checkout'))
    ui.chat('carry on', [fake], started.threadId)
    await new Promise(r => setTimeout(r, 4000))
    console.log('EVENTS', ui.events.map(e => `${e.kind}:${(e as any).text?.slice(0,60) ?? ''}`).join('\n'))
    runner.close()
    ui.close()
    expect(true).toBe(true)
  })
})
