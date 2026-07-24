import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveDocRef, type DocPage } from '../src/shared/docs'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, TestUi, type TestHost } from './helpers/session'

type Message = Extract<SessionEvent, { kind: 'message' }>
type Started = Extract<SessionEvent, { kind: 'thread.started' }>
type Ended = Extract<SessionEvent, { kind: 'agent.end' }>

describe('resolveDocRef', () => {
  const docs: Record<string, DocPage> = {
    main: { title: 'Main', text: '' },
    'plan-1abc': { title: 'Plan', text: '' },
    'handbook/journal-1xyz': { title: 'Journal', text: '' }
  }

  it('finds a page still at its stored slug', () => {
    expect(resolveDocRef(docs, { page: 'plan-1abc', title: 'Plan' })).toBe('plan-1abc')
  })

  it('follows a page moved or renamed by its code', () => {
    expect(resolveDocRef(docs, { page: 'notes-1xyz', title: 'Notes' })).toBe('handbook/journal-1xyz')
  })

  it('returns null for a deleted page', () => {
    expect(resolveDocRef(docs, { page: 'gone-1zzz', title: 'Gone' })).toBeNull()
  })

  it('resolves main by its slug alone', () => {
    expect(resolveDocRef(docs, { page: 'main', title: 'Main' })).toBe('main')
    expect(resolveDocRef({}, { page: 'main', title: 'Main' })).toBeNull()
  })
})

describe('doc mentions in messages', () => {
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
    const runner = new Runner({
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

  const fake = agentId('jamel', 'fake')

  it('stores the referenced page and title on the message', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    ui.send({ type: 'doc.update', page: 'plan-1abc', text: 'ship it', title: 'Plan' })
    await ui.waitForEvent(e => e.kind === 'doc' && e.page === 'plan-1abc')

    ui.chat('see #Plan for details')
    const message = (await ui.waitForEvent(e => e.kind === 'message')) as Message
    expect(message.docMentions).toEqual([{ page: 'plan-1abc', title: 'Plan' }])

    ui.chat('nothing here')
    const plain = (await ui.waitForEvent(e => e.kind === 'message' && e.text === 'nothing here')) as Message
    expect(plain.docMentions).toEqual([])
  })

  it('keeps feeding a doc to the agent after a rename and a move', async () => {
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    await connectRunner('jamel')
    ui.send({ type: 'doc.update', page: 'notes-1aaa', text: 'Remember the apples.', title: 'Notes' })
    await ui.waitForEvent(e => e.kind === 'doc' && e.page === 'notes-1aaa')

    ui.chat('read #Notes @Fake', [fake])
    const started = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Started
    const first = (await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === started.threadId)) as Ended
    expect(first.text).toContain('Remember the apples.')

    ui.send({ type: 'doc.rename', from: 'notes-1aaa', to: 'handbook/journal-1aaa', title: 'Journal' })
    await ui.waitForEvent(e => e.kind === 'doc.renamed' && e.to === 'handbook/journal-1aaa')

    ui.chat('summarize it', [fake], started.threadId)
    const second = (await ui.waitForEvent(
      e => e.kind === 'agent.end' && e.threadId === started.threadId && e.id !== first.id
    )) as Ended
    expect(second.text).toContain('Doc page "Journal"')
    expect(second.text).toContain('Remember the apples.')
  })
})
