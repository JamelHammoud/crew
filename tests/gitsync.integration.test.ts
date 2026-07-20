import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitSync } from '../src/server/git'
import { Store } from '../src/server/store'
import { clone, git, initBare, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

async function setupOriginWithTwoClones() {
  const base = tmpDir('gitsync')
  const origin = path.join(base, 'origin.git')
  const seed = path.join(base, 'seed')
  const a = path.join(base, 'a')
  const b = path.join(base, 'b')
  await initBare(origin)
  await initRepo(seed)
  await git(seed, ['remote', 'add', 'origin', origin])
  await git(seed, ['push', '-u', 'origin', 'main'])
  await clone(origin, a)
  await clone(origin, b)
  return { a, b }
}

describe('git sync', () => {
  it('syncs session events from one clone to another', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const storeA = new Store(a)
    const syncA = new GitSync(a)

    storeA.appendEvent({
      id: 'e1',
      ts: Date.now(),
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'hello from a',
      mentions: []
    })
    await syncA.syncNow()

    await git(b, ['pull'])
    const eventsB = new Store(b).loadEvents()
    expect(eventsB.map(e => e.id)).toContain('e1')
  })

  it('concurrent appends converge without conflicts', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const storeA = new Store(a)
    const storeB = new Store(b)
    const syncA = new GitSync(a)
    const syncB = new GitSync(b)

    storeA.appendEvent({
      id: 'from-a',
      ts: 1,
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'a says hi',
      mentions: []
    })
    await syncA.syncNow()

    storeB.appendEvent({
      id: 'from-b',
      ts: 2,
      kind: 'message',
      authorId: 'u2',
      authorName: 'jamel',
      text: 'b says hi',
      mentions: []
    })
    await syncB.syncNow()
    await syncA.syncNow()

    const idsA = storeA.loadEvents().map(e => e.id)
    const idsB = new Store(b).loadEvents().map(e => e.id)
    expect(idsA).toContain('from-a')
    expect(idsA).toContain('from-b')
    expect(idsB).toContain('from-a')
    expect(idsB).toContain('from-b')

    const rawA = fs.readFileSync(path.join(a, '.crew', 'chat.jsonl'), 'utf8')
    expect(rawA).not.toContain('<<<<<<<')
  })

  it('keeps working with no remote configured', async () => {
    const dir = tmpDir('git-local')
    await initRepo(dir)
    const store = new Store(dir)
    const sync = new GitSync(dir)
    store.appendEvent({
      id: 'local-only',
      ts: 1,
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'offline',
      mentions: []
    })
    await sync.syncNow()
    const log = await git(dir, ['log', '--oneline'])
    expect(log).toContain('crew sync')
  })
})
