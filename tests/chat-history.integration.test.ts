import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { ServerMessage } from '../src/shared/protocol'
import { startHost, tmpDir, TestUi, type TestHost } from './helpers/session'

const said = (n: number): SessionEvent => ({
  id: `m${String(n).padStart(5, '0')}`,
  ts: 1_700_000_000_000 + n * 1000,
  kind: 'message',
  authorId: 'alice',
  authorName: 'alice',
  text: `message ${n}`,
  mentions: []
})

const seed = (repoPath: string, count: number): SessionEvent[] => {
  const events = Array.from({ length: count }, (_, i) => said(i))
  const dir = path.join(repoPath, '.crew', 'chat')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '0001.jsonl'), events.map(e => JSON.stringify(e) + '\n').join(''))
  return events
}

const history = (msg: ServerMessage): { events: SessionEvent[]; more: boolean } => {
  if (msg.type !== 'history') throw new Error('not a page of history')
  return { events: msg.events, more: msg.more }
}

describe('reading back into the chat history', () => {
  let host: TestHost
  let uis: TestUi[] = []
  let written: SessionEvent[] = []

  beforeEach(async () => {
    const repoPath = tmpDir('history')
    written = seed(repoPath, 1200)
    host = await startHost(repoPath)
  })

  afterEach(async () => {
    for (const ui of uis) ui.close()
    uis = []
    await host.close()
  })

  it('hands over the newest messages first and says there are older ones', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    const snapshot = host.session.snapshot()
    expect(snapshot.moreEvents).toBe(true)
    expect(snapshot.events.filter(e => e.kind === 'message')).toHaveLength(500)
    expect(snapshot.events[0].id).toBe(written[700].id)
  })

  it('walks back a page at a time and stops at the beginning', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    let oldest = host.session.snapshot().events[0]
    const read: SessionEvent[] = []
    let more = true
    let pages = 0
    while (more) {
      alice.send({ type: 'history', before: oldest.id })
      const page = history(await alice.waitFor(m => m.type === 'history' && m.events[0]?.id !== read[0]?.id))
      expect(page.events.length).toBeGreaterThan(0)
      expect(page.events.at(-1)!.ts).toBeLessThan(oldest.ts)
      read.unshift(...page.events)
      oldest = page.events[0]
      more = page.more
      pages++
      expect(pages).toBeLessThan(20)
    }

    expect(read).toHaveLength(700)
    expect(read[0].id).toBe(written[0].id)
    expect(new Set(read.map(e => e.id)).size).toBe(read.length)
  })

  it('says there is nothing older once the first message is held', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    alice.send({ type: 'history', before: written[0].id })
    const page = history(await alice.waitFor(m => m.type === 'history'))
    expect(page.events).toEqual([])
    expect(page.more).toBe(false)
  })

  it('keeps a ghost thread out of what is read back', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    alice.chat('nobody else sees this', [], undefined, ['ghost'])
    const started = await alice.waitForEvent(e => e.kind === 'thread.started')
    const threadId = started.kind === 'thread.started' ? started.threadId : ''
    expect(threadId).not.toBe('')

    const oldest = host.session.snapshot().events[0]
    alice.send({ type: 'history', before: oldest.id })
    const page = history(await alice.waitFor(m => m.type === 'history'))
    expect(page.events.some(e => 'threadId' in e && e.threadId === threadId)).toBe(false)
  })

  it('serves nobody but the app', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)
    const oldest = host.session.snapshot().events[0]

    alice.send({ type: 'history', before: oldest.id })
    await alice.waitFor(m => m.type === 'history')
    expect(alice.messages.filter(m => m.type === 'history')).toHaveLength(1)
  })
})
