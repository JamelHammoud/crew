import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

describe('asking an agent from a board', () => {
  let host: TestHost
  let runners: Runner[] = []
  let uis: TestUi[] = []
  const fake = agentId('jamel', 'fake')

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

  async function board(ui: TestUi, boardId: string, name: string) {
    ui.send({ type: 'design.create', boardId, name })
    await ui.waitFor(m => m.type === 'design.boards' && m.boards.some(b => b.id === boardId))
  }

  it('starts a run on the board from an ask that names nobody in its text', async () => {
    const ui = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await board(ui, 'hero-1abc', 'Hero')

    ui.send({ type: 'chat.send', text: 'make this bolder', mentions: [fake], boardId: 'hero-1abc' })

    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    expect(started.agentId).toBe(fake)
    expect(started.boardId).toBe('hero-1abc')
    const ended = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect(ended.text).toContain('make this bolder')
  })

  it('carries on in the thread the ask is aimed at', async () => {
    const ui = await TestUi.connect(host.url, 'ali', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await board(ui, 'hero-1abc', 'Hero')

    ui.send({ type: 'chat.send', text: 'first ask', mentions: [fake], boardId: 'hero-1abc' })
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended

    ui.chat('second ask', [fake], started.threadId)
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.id !== first.id
    )) as Ended
    expect(second.text).toContain('second ask')
    expect(ui.events.filter(e => e.kind === 'thread.started')).toHaveLength(1)
  })
})
