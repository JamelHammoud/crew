import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitSync } from '../src/server/git'
import { Store } from '../src/server/store'
import { clone, git, initBare, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

async function twoClones(seedFiles: Record<string, string>) {
  const base = tmpDir('syncguard')
  const origin = path.join(base, 'origin.git')
  const seed = path.join(base, 'seed')
  const a = path.join(base, 'a')
  const b = path.join(base, 'b')
  await initBare(origin)
  await initRepo(seed)
  for (const [file, contents] of Object.entries(seedFiles)) {
    fs.writeFileSync(path.join(seed, file), contents)
  }
  await git(seed, ['add', '-A'])
  await git(seed, ['commit', '-m', 'seed files'])
  await git(seed, ['remote', 'add', 'origin', origin])
  await git(seed, ['push', '-u', 'origin', 'main'])
  await clone(origin, a)
  await clone(origin, b)
  return { a, b }
}

async function pushEdit(repo: string, file: string, contents: string): Promise<void> {
  fs.writeFileSync(path.join(repo, file), contents)
  await git(repo, ['add', '-A'])
  await git(repo, ['commit', '-m', 'remote edit'])
  await git(repo, ['push'])
}

function appendEvent(repo: string, id: string): void {
  new Store(repo).appendEvent({
    id,
    ts: Date.now(),
    kind: 'message',
    authorId: 'u1',
    authorName: 'sam',
    text: `event ${id}`,
    mentions: []
  })
}

async function stashes(repo: string): Promise<number> {
  const list = await git(repo, ['stash', 'list'])
  return list.trim() ? list.trim().split('\n').length : 0
}

describe('sync guard', () => {
  it('leaves local edits alone when the remote changed the same file', async () => {
    const { a, b } = await twoClones({ 'app.ts': 'const value = 1\n' })
    await pushEdit(b, 'app.ts', 'const value = 2\n')
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')
    appendEvent(a, 'e1')

    await new GitSync(a).syncNow()

    expect(fs.readFileSync(path.join(a, 'app.ts'), 'utf8')).toBe('const value = 3\n')
    expect(await stashes(a)).toBe(0)
  })

  it('keeps session data flowing while unrelated files are being edited', async () => {
    const { a, b } = await twoClones({ 'app.ts': 'const value = 1\n', 'other.ts': 'const other = 1\n' })
    await pushEdit(b, 'other.ts', 'const other = 2\n')
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')
    appendEvent(a, 'e2')

    await new GitSync(a).syncNow()

    expect(fs.readFileSync(path.join(a, 'app.ts'), 'utf8')).toBe('const value = 3\n')
    await git(b, ['pull'])
    expect(new Store(b).loadEvents().map(e => e.id)).toContain('e2')
  })

  it('asks for a push before a manual pull would replace local work', async () => {
    const { a, b } = await twoClones({ 'app.ts': 'const value = 1\n' })
    await pushEdit(b, 'app.ts', 'const value = 2\n')
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')

    const result = await new GitSync(a).pullNow()

    expect(result.ok).toBe(false)
    expect(result.message).toContain('app.ts')
    expect(fs.readFileSync(path.join(a, 'app.ts'), 'utf8')).toBe('const value = 3\n')
  })

  it('pulls normally once the local work is pushed', async () => {
    const { a, b } = await twoClones({ 'app.ts': 'const value = 1\n', 'other.ts': 'const other = 1\n' })
    await pushEdit(b, 'other.ts', 'const other = 2\n')
    fs.writeFileSync(path.join(a, 'app.ts'), 'const value = 3\n')

    const push = await new GitSync(a).pushNow()
    expect(push.ok).toBe(true)

    const pull = await new GitSync(a).pullNow()
    expect(pull.ok).toBe(true)
    expect(fs.readFileSync(path.join(a, 'other.ts'), 'utf8')).toBe('const other = 2\n')
    expect(fs.readFileSync(path.join(a, 'app.ts'), 'utf8')).toBe('const value = 3\n')
  })
})
