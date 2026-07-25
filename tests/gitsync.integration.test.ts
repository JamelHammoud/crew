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

  it('resolves session.json conflicts by keeping local state', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const storeA = new Store(a)
    const storeB = new Store(b)
    const syncA = new GitSync(a)
    const syncB = new GitSync(b)

    storeA.saveSession({ code: 'c', createdAt: 1, members: [{ id: 'u1', name: 'sam' }], agents: [] })
    await syncA.syncNow()

    storeB.saveSession({ code: 'c', createdAt: 1, members: [{ id: 'u2', name: 'jamel' }], agents: [] })
    await syncB.syncNow()

    const sessionB = new Store(b).loadSession()
    expect(sessionB?.members.map(m => m.id)).toEqual(['u2'])
    const rawB = fs.readFileSync(path.join(b, '.crew', 'session.json'), 'utf8')
    expect(rawB).not.toContain('<<<<<<<')

    const status = await git(b, ['status', '--porcelain'])
    expect(status.trim()).toBe('')
    await git(a, ['pull'])
    expect(new Store(a).loadSession()?.members.map(m => m.id)).toEqual(['u2'])
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

  it('sends project work out with the session on every sync', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const store = new Store(b)
    const sync = new GitSync(b)
    fs.writeFileSync(path.join(b, 'project.ts'), 'export const shared = true\n')
    store.appendEvent({
      id: 'with-project',
      ts: 1,
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'ship the project too',
      mentions: []
    })

    await sync.syncNow()

    const status = await git(b, ['status', '--porcelain'])
    const committed = await git(b, ['show', '--pretty=format:', '--name-only', 'HEAD'])
    expect(status.trim()).toBe('')
    expect(committed).toContain('.crew/chat.jsonl')
    expect(committed).toContain('project.ts')
    expect((await sync.status()).changed).toBe(0)
    await git(a, ['pull'])
    expect(new Store(a).loadEvents().map(event => event.id)).toContain('with-project')
    expect(fs.readFileSync(path.join(a, 'project.ts'), 'utf8')).toContain('shared = true')
  })

  it('carries code both ways so every machine lands on the same version', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const syncA = new GitSync(a)
    const syncB = new GitSync(b)
    fs.writeFileSync(path.join(a, 'from-a.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(b, 'from-b.ts'), 'export const b = 2\n')

    await syncA.syncNow()
    await syncB.syncNow()
    await syncA.syncNow()

    expect(fs.readFileSync(path.join(a, 'from-b.ts'), 'utf8')).toContain('b = 2')
    expect(fs.readFileSync(path.join(b, 'from-a.ts'), 'utf8')).toContain('a = 1')
  })

  it('lets two crew windows share one folder without tripping over each other', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    const windowOne = new GitSync(a)
    const windowTwo = new GitSync(a)
    fs.writeFileSync(path.join(a, 'shared.ts'), 'export const shared = true\n')

    await Promise.all([windowOne.syncNow(), windowTwo.syncNow(), windowOne.syncNow()])
    await windowTwo.syncNow()

    expect(fs.existsSync(path.join(a, '.git', 'rebase-merge'))).toBe(false)
    expect((await git(a, ['status', '--porcelain'])).trim()).toBe('')
    expect((await git(a, ['branch', '--show-current'])).trim()).toBe('main')
    await git(b, ['pull'])
    expect(fs.readFileSync(path.join(b, 'shared.ts'), 'utf8')).toContain('shared = true')
  })

  it('never rewinds a file an agent is writing while the sync runs', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(a, 'agent.ts'), 'export const step = 1\n')
    await new GitSync(a).syncNow()
    await git(b, ['pull'])

    for (let round = 2; round <= 6; round++) {
      await git(b, ['pull', '--no-rebase', '--no-edit'])
      fs.writeFileSync(path.join(b, `from-b-${round}.ts`), `export const b = ${round}\n`)
      await git(b, ['add', '-A'])
      await git(b, ['commit', '-m', `b work ${round}`])
      await git(b, ['push'])
      const sync = new GitSync(a).syncNow()
      fs.writeFileSync(path.join(a, 'agent.ts'), `export const step = ${round}\n`)
      await sync
      expect(fs.readFileSync(path.join(a, 'agent.ts'), 'utf8')).toBe(`export const step = ${round}\n`)
    }

    await new GitSync(a).syncNow()
    expect(fs.readFileSync(path.join(a, 'agent.ts'), 'utf8')).toBe('export const step = 6\n')
    expect(await git(a, ['log', '--oneline'])).toContain('b work 6')
  })

  it('keeps every local commit when remote work lands at the same time', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(a, 'mine.ts'), 'export const mine = 1\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'my first change'])
    fs.writeFileSync(path.join(a, 'mine2.ts'), 'export const mine = 2\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'my second change'])
    fs.writeFileSync(path.join(b, 'theirs.ts'), 'export const theirs = true\n')
    await git(b, ['add', '-A'])
    await git(b, ['commit', '-m', 'their change'])
    await git(b, ['push'])

    await new GitSync(a).syncNow()

    const log = await git(a, ['log', '--oneline'])
    expect(log).toContain('my first change')
    expect(log).toContain('my second change')
    expect(log).toContain('their change')
    expect(fs.readFileSync(path.join(a, 'theirs.ts'), 'utf8')).toContain('theirs = true')
  })

  it('digs itself out of a rebase left half finished', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 1\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'seed'])
    await git(a, ['push'])
    await git(b, ['pull'])

    fs.writeFileSync(path.join(b, 'app.ts'), 'const value = 2\n')
    await git(b, ['add', '-A'])
    await git(b, ['commit', '-m', 'from b'])
    await git(b, ['push'])
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'from a'])
    await git(a, ['fetch'])
    await git(a, ['pull', '--rebase']).catch(() => {})
    expect(fs.existsSync(path.join(a, '.git', 'rebase-merge'))).toBe(true)

    await new GitSync(a).syncNow()

    expect(fs.existsSync(path.join(a, '.git', 'rebase-merge'))).toBe(false)
    expect((await git(a, ['branch', '--show-current'])).trim()).toBe('main')
    expect(await git(a, ['log', '--oneline'])).toContain('from a')
  })

  it('keeps what was written while a rebase was stuck', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 1\n')
    fs.writeFileSync(path.join(a, 'log.jsonl'), '{"id":"first"}\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'seed'])
    await git(a, ['push'])
    await git(b, ['pull'])

    fs.writeFileSync(path.join(b, 'app.ts'), 'const value = 2\n')
    await git(b, ['add', '-A'])
    await git(b, ['commit', '-m', 'from b'])
    await git(b, ['push'])
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'from a'])
    await git(a, ['fetch'])
    await git(a, ['pull', '--rebase']).catch(() => {})

    fs.writeFileSync(path.join(a, 'agent-wrote-this.ts'), 'export const written = true\n')
    fs.appendFileSync(path.join(a, 'log.jsonl'), '{"id":"second"}\n')

    await new GitSync(a).syncNow()

    expect(fs.readFileSync(path.join(a, 'agent-wrote-this.ts'), 'utf8')).toContain('written = true')
    const log = fs.readFileSync(path.join(a, 'log.jsonl'), 'utf8')
    expect(log).toContain('"first"')
    expect(log).toContain('"second"')
    expect(await git(a, ['stash', 'list'])).toBe('')
  })

  it('leaves stale stashes out of automatic syncing', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(b, 'remote.ts'), 'export const remote = true\n')
    await git(b, ['add', '-A'])
    await git(b, ['commit', '-m', 'remote work'])
    await git(b, ['push'])
    fs.writeFileSync(path.join(a, 'local.ts'), 'export const local = true\n')

    await new GitSync(a).syncNow()

    const stashes = await git(a, ['stash', 'list'])
    expect(stashes.trim()).toBe('')
    expect(fs.readFileSync(path.join(a, 'local.ts'), 'utf8')).toContain('local = true')
    expect(fs.readFileSync(path.join(a, 'remote.ts'), 'utf8')).toContain('remote = true')
  })

  it('shows reviewable project diffs without internal session files', async () => {
    const dir = tmpDir('git-changes')
    await initRepo(dir)
    const store = new Store(dir)
    store.appendEvent({
      id: 'internal',
      ts: 1,
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'internal state',
      mentions: []
    })
    fs.appendFileSync(path.join(dir, '.gitattributes'), '# local\n')
    fs.mkdirSync(path.join(dir, 'src'))
    fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const app = true\n')
    const sync = new GitSync(dir)

    const changes = await sync.changes()

    expect(changes.map(change => change.path)).toEqual(['.gitattributes', 'src/app.ts'])
    expect(changes.find(change => change.path === '.gitattributes')).toMatchObject({
      kind: 'modified',
      added: 1,
      removed: 0
    })
    expect(changes.find(change => change.path === 'src/app.ts')).toMatchObject({
      kind: 'added',
      added: 1,
      removed: 0
    })
    expect(changes.find(change => change.path === 'src/app.ts')?.diff).toContain('+export const app = true')
  })

  it('pulls remote changes and keeps local work in place', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(a, 'remote.ts'), 'export const remote = true\n')
    await git(a, ['add', '-A'])
    await git(a, ['commit', '-m', 'remote change'])
    await git(a, ['push'])
    fs.writeFileSync(path.join(b, 'local.ts'), 'export const local = true\n')

    const result = await new GitSync(b).pullNow()

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(true)
    expect(result.status.behind).toBe(0)
    expect(fs.readFileSync(path.join(b, 'remote.ts'), 'utf8')).toContain('remote = true')
    expect(fs.readFileSync(path.join(b, 'local.ts'), 'utf8')).toContain('local = true')
  })

  it('commits and pushes local work from the project control', async () => {
    const { a, b } = await setupOriginWithTwoClones()
    fs.writeFileSync(path.join(b, 'pushed.ts'), 'export const pushed = true\n')

    const result = await new GitSync(b).pushNow()

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(true)
    expect(result.status.changed).toBe(0)
    expect(result.status.ahead).toBe(0)
    await git(a, ['pull'])
    expect(fs.readFileSync(path.join(a, 'pushed.ts'), 'utf8')).toContain('pushed = true')
  })
})
