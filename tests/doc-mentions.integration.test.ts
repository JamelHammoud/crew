import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pageCodeOf, resolveDocRef, type DocPage } from '../src/shared/docs'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import { Runner } from '../src/runner'
import { makeFakeProvider } from './helpers/fake-provider'
import { startHost, tmpDir, TestUi, type TestHost } from './helpers/session'

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

describe('page code migration', () => {
  it('gives code-less pages an id at startup and leaves main alone', async () => {
    const repoPath = tmpDir('doc-codes')
    const docsDir = path.join(repoPath, '.crew', 'docs')
    fs.mkdirSync(path.join(docsDir, 'guides'), { recursive: true })
    fs.writeFileSync(path.join(docsDir, 'main.md'), 'home')
    fs.writeFileSync(path.join(docsDir, 'guides.md'), 'G')
    fs.writeFileSync(path.join(docsDir, 'guides', 'setup.md'), 'S')
    fs.writeFileSync(path.join(docsDir, 'plan-1abc.md'), 'P')
    fs.writeFileSync(path.join(docsDir, 'report-2024.md'), 'R')

    const host = await startHost(repoPath)
    const pages = Object.keys(host.store.loadDocs()).sort()
    await host.close()

    expect(pages).toContain('main')
    expect(pages).toContain('plan-1abc')
    const guides = pages.find(p => /^guides-\d[a-z0-9]{3}$/.test(p))
    expect(guides).toBeDefined()
    const setup = pages.find(p => p.startsWith(`${guides}/`))
    expect(setup).toMatch(new RegExp(`^${guides}/setup-\\d[a-z0-9]{3}$`))
    expect(pageCodeOf(setup!)).not.toBe(pageCodeOf(guides!))
    expect(pageCodeOf('report-2024')).toBeNull()
    const report = pages.find(p => /^report-2024-\d[a-z0-9]{3}$/.test(p))
    expect(report).toBeDefined()
    expect(pageCodeOf(report!)).toMatch(/[a-z]/)
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
