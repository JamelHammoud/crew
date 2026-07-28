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

const drafted = (n: number): SessionEvent => ({
  id: `d${String(n).padStart(5, '0')}`,
  ts: 1_700_000_000_000 + n * 1000 + 500,
  kind: 'doc',
  page: 'main',
  text: `draft ${n}`,
  byName: 'alice'
})

// A doc is written where it stands rather than scrolled past, so the log holds
// far more than the chat ever draws. Seeding both is what keeps a page of
// history honest about which of the two comes back.
const seed = (repoPath: string, count: number): SessionEvent[] => {
  const messages = Array.from({ length: count }, (_, i) => said(i))
  const written: SessionEvent[] = []
  for (const message of messages) {
    written.push(message)
    if (written.length % 4 === 0) written.push(drafted(written.length))
  }
  const dir = path.join(repoPath, '.crew', 'chat')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '0001.jsonl'), written.map(e => JSON.stringify(e) + '\n').join(''))
  return messages
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

    const pages = () => alice.messages.filter(m => m.type === 'history')
    let oldest = host.session.snapshot().events[0]
    const read: SessionEvent[] = []
    let more = true
    while (more) {
      const seen = pages().length
      expect(seen).toBeLessThan(20)
      alice.send({ type: 'history', before: oldest.id })
      await waitUntil(() => pages().length > seen)
      const page = history(pages().at(-1)!)
      expect(page.events.length).toBeGreaterThan(0)
      expect(page.events.at(-1)!.ts).toBeLessThan(oldest.ts)
      read.unshift(...page.events)
      oldest = page.events[0]
      more = page.more
    }

    expect(read).toHaveLength(700)
    expect(read[0].id).toBe(written[0].id)
    expect(new Set(read.map(e => e.id)).size).toBe(read.length)
    expect(read.every(e => e.kind === 'message')).toBe(true)
  })

  it('says there is nothing older once the first message is held', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    alice.send({ type: 'history', before: written[0].id })
    const page = history(await alice.waitFor(m => m.type === 'history'))
    expect(page.events).toEqual([])
    expect(page.more).toBe(false)
  })

  it('leaves out what a doc wrote, which is not a moment to scroll past', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    uis.push(alice)

    const oldest = host.session.snapshot().events[0]
    alice.send({ type: 'history', before: oldest.id })
    const page = history(await alice.waitFor(m => m.type === 'history'))
    expect(page.events.some(e => e.kind === 'doc')).toBe(false)
  })

  it('goes to the one who asked for it', async () => {
    const alice = await TestUi.connect(host.url, 'alice', host.code)
    const bob = await TestUi.connect(host.url, 'bob', host.code)
    uis.push(alice, bob)
    const oldest = host.session.snapshot().events[0]

    alice.send({ type: 'history', before: oldest.id })
    await alice.waitFor(m => m.type === 'history')
    bob.chat('still here')
    await alice.waitForEvent(e => e.kind === 'message' && e.text === 'still here')
    expect(bob.messages.some(m => m.type === 'history')).toBe(false)
  })
})
