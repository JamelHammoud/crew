import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveBoardRef, type DesignBoardMeta } from '../src/shared/design'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { crewRefs, refsIn } from '../src/shared/refs'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

type Message = Extract<SessionEvent, { kind: 'message' }>
type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

const boards: DesignBoardMeta[] = [
  { id: 'landing-1abc', name: 'Landing' },
  { id: 'plan-2xyz', name: 'Plan' }
]

describe('one # for docs and boards', () => {
  const docs = { 'plan-1abc': { title: 'Plan', text: '' } }

  it('lists docs and boards together and lets the doc keep a shared title', () => {
    expect(crewRefs(docs, boards)).toEqual([
      { kind: 'doc', key: 'plan-1abc', title: 'Plan' },
      { kind: 'board', key: 'landing-1abc', title: 'Landing' }
    ])
  })

  it('reads each title as the one thing it names', () => {
    const found = refsIn('see #Plan and #Landing', crewRefs(docs, boards))
    expect(found.map(ref => [ref.kind, ref.key]).sort()).toEqual([
      ['board', 'landing-1abc'],
      ['doc', 'plan-1abc']
    ])
  })
})

describe('resolveBoardRef', () => {
  it('finds a board still under its id, whatever it is called now', () => {
    expect(resolveBoardRef(boards, { id: 'landing-1abc', name: 'Hero' })).toBe('landing-1abc')
  })

  it('falls back to the name for a board that came back with a new id', () => {
    expect(resolveBoardRef(boards, { id: 'gone-9zzz', name: 'landing' })).toBe('landing-1abc')
  })

  it('returns null for a board nobody has', () => {
    expect(resolveBoardRef(boards, { id: 'gone-9zzz', name: 'Gone' })).toBeNull()
  })
})

describe('board mentions in messages', () => {
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

  async function makeBoard(ui: TestUi, boardId: string, name: string) {
    ui.send({ type: 'design.create', boardId, name })
    await ui.waitFor(m => m.type === 'design.boards' && m.boards.some(board => board.id === boardId))
  }

  const fake = agentId('jamel', 'fake')

  it('stores the referenced board and name on the message', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await makeBoard(ui, 'landing-1abc', 'Landing')

    ui.chat('start on #Landing')
    const message = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    expect(message.boardMentions).toEqual([{ id: 'landing-1abc', name: 'Landing' }])
    expect(message.docMentions).toEqual([])

    ui.chat('nothing here')
    const plain = (await ui.waitForEvent(e => e.kind === 'message' && e.text === 'nothing here')) as Message
    expect(plain.boardMentions).toEqual([])
  })

  it('hands a mentioned board to the agent, and keeps it after a rename', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await makeBoard(ui, 'flow-1abc', 'Flow')

    ui.chat('take a look at #Flow @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect(first.text).toContain('design board "Flow"')
    expect(first.text).toContain('/design/flow-1abc')
    expect(first.text).toContain(`"${fake}"`)

    ui.send({ type: 'design.rename', boardId: 'flow-1abc', name: 'Checkout' })
    await ui.waitFor(m => m.type === 'design.boards' && m.boards.some(board => board.name === 'Checkout'))

    ui.chat('carry on', [fake], started.threadId)
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.id !== first.id
    )) as Ended
    expect(second.text).toContain('design board "Checkout"')
    expect(second.text).toContain('/design/flow-1abc')
  })

  it('names the board the thread sits on first, and lists the rest under it', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    await makeBoard(ui, 'shop-1abc', 'Shop')
    await makeBoard(ui, 'icons-1abc', 'Icons')

    ui.send({ type: 'chat.send', text: 'borrow from #Icons @Fake', mentions: [fake], boardId: 'shop-1abc' })
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const end = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    const reply = end.text ?? ''
    expect(reply).toContain('attached to the design board "Shop"')
    expect(reply).toContain('"Icons" is icons-1abc')
    expect(reply).toContain('/design/shop-1abc')
  })
})
