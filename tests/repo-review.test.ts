import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GitSync } from '../src/server/git'
import { git, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

const made: string[] = []

async function review(name: string): Promise<{ dir: string; sync: GitSync }> {
  const dir = tmpDir(name)
  made.push(dir)
  await initRepo(dir)
  return { dir, sync: new GitSync(dir) }
}

function write(dir: string, file: string, text: string): void {
  fs.writeFileSync(path.join(dir, file), text)
}

function read(dir: string, file: string): string {
  return fs.readFileSync(path.join(dir, file), 'utf8')
}

afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

describe('review panel', () => {
  it('lists a file edited after it was staged as two changes', async () => {
    const { dir, sync } = await review('repo-two-sides')
    write(dir, 'app.ts', 'one\n')
    await git(dir, ['add', '-A'])
    await git(dir, ['commit', '-m', 'seed'])
    write(dir, 'app.ts', 'one\ntwo\n')
    await git(dir, ['add', 'app.ts'])
    write(dir, 'app.ts', 'one\ntwo\nthree\n')

    const changes = await sync.changes()
    const mine = changes.filter(change => change.path === 'app.ts')

    expect(mine.map(change => change.staged)).toEqual([true, false])
    expect(mine[0].diff).toContain('+two')
    expect(mine[0].diff).not.toContain('+three')
    expect(mine[1].diff).toContain('+three')
    expect(mine[1].diff).not.toContain('+two')
    expect(mine[0].added).toBe(1)
    expect(mine[1].added).toBe(1)
  })

  it('reads the whole working tree in one call', async () => {
    const { dir, sync } = await review('repo-work')
    write(dir, 'app.ts', 'const app = true\n')
    await sync.run({ do: 'stage', paths: ['app.ts'] })
    write(dir, 'notes.md', 'later\n')

    const work = await sync.work()

    expect(work.status.available).toBe(true)
    expect(work.status.branch).toBe('main')
    expect(work.status.stashes).toBe(0)
    expect(work.stashes).toEqual([])
    expect(work.changes.map(change => [change.path, change.staged])).toEqual([
      ['app.ts', true],
      ['notes.md', false]
    ])
  })

  it('puts the tree back where it started when a stage is undone', async () => {
    const { dir, sync } = await review('repo-stage')
    write(dir, 'app.ts', 'const app = true\n')
    write(dir, '.gitattributes', '*.jsonl merge=union\n# local\n')
    const before = await git(dir, ['status', '--porcelain'])

    const staged = await sync.run({ do: 'stage', paths: ['app.ts', '.gitattributes'] })
    expect(staged.ok).toBe(true)
    expect((await sync.changes()).every(change => change.staged)).toBe(true)

    const unstaged = await sync.run({ do: 'unstage', paths: ['app.ts', '.gitattributes'] })

    expect(unstaged.ok).toBe(true)
    expect(await git(dir, ['status', '--porcelain'])).toBe(before)
    expect((await sync.changes()).some(change => change.staged)).toBe(false)
    expect(read(dir, 'app.ts')).toBe('const app = true\n')
  })

  it('refuses a commit with nothing staged and takes one with something staged', async () => {
    const { dir, sync } = await review('repo-commit')
    write(dir, 'app.ts', 'const app = true\n')

    const empty = await sync.run({ do: 'commit', message: 'nothing here' })

    expect(empty.ok).toBe(false)
    expect(empty.message).toBe('Stage something to commit first.')
    expect(await git(dir, ['log', '--oneline'])).not.toContain('nothing here')

    await sync.run({ do: 'stage', paths: ['app.ts'] })
    const commit = await sync.run({ do: 'commit', message: 'the first change' })

    expect(commit.ok).toBe(true)
    expect(commit.status.changed).toBe(0)
    expect(await git(dir, ['log', '--oneline'])).toContain('the first change')
  })

  it('takes untracked files into a stash and brings them back', async () => {
    const { dir, sync } = await review('repo-stash')
    write(dir, 'app.ts', 'const app = false\n')
    await git(dir, ['add', '-A'])
    await git(dir, ['commit', '-m', 'seed'])
    write(dir, 'app.ts', 'const app = true\n')
    write(dir, 'brand-new.ts', 'export const fresh = true\n')

    const put = await sync.run({ do: 'stash', message: 'halfway through' })

    expect(put.ok).toBe(true)
    expect(put.status.stashes).toBe(1)
    expect(fs.existsSync(path.join(dir, 'brand-new.ts'))).toBe(false)
    expect(read(dir, 'app.ts')).toBe('const app = false\n')

    const stashes = await sync.stashes()
    expect(stashes).toHaveLength(1)
    expect(stashes[0].message).toBe('halfway through')
    expect(stashes[0].branch).toBe('main')

    const back = await sync.run({ do: 'apply', ref: stashes[0].ref })

    expect(back.ok).toBe(true)
    expect(back.status.stashes).toBe(0)
    expect(read(dir, 'brand-new.ts')).toBe('export const fresh = true\n')
    expect(read(dir, 'app.ts')).toBe('const app = true\n')
  })

  it('drops a stash the panel names and nothing else', async () => {
    const { dir, sync } = await review('repo-drop')
    write(dir, 'app.ts', 'first\n')
    await sync.run({ do: 'stash', message: 'one' })
    write(dir, 'app.ts', 'second\n')
    await sync.run({ do: 'stash', message: 'two' })

    const held = await sync.stashes()
    const dropped = await sync.run({ do: 'drop', ref: held.find(s => s.message === 'one')!.ref })

    expect(dropped.ok).toBe(true)
    expect((await sync.stashes()).map(stash => stash.message)).toEqual(['two'])
  })

  it('discards the paths it was given and leaves every other one alone', async () => {
    const { dir, sync } = await review('repo-discard')
    write(dir, 'kept.ts', 'const kept = 1\n')
    write(dir, 'thrown.ts', 'const thrown = 1\n')
    await git(dir, ['add', '-A'])
    await git(dir, ['commit', '-m', 'seed'])
    write(dir, 'kept.ts', 'const kept = 2\n')
    write(dir, 'thrown.ts', 'const thrown = 2\n')
    write(dir, 'untracked.ts', 'export const loose = true\n')
    write(dir, 'untracked-kept.ts', 'export const stays = true\n')

    const undone = await sync.run({ do: 'discard', paths: ['thrown.ts', 'untracked.ts'] })

    expect(undone.ok).toBe(true)
    expect(read(dir, 'thrown.ts')).toBe('const thrown = 1\n')
    expect(fs.existsSync(path.join(dir, 'untracked.ts'))).toBe(false)
    expect(read(dir, 'kept.ts')).toBe('const kept = 2\n')
    expect(read(dir, 'untracked-kept.ts')).toBe('export const stays = true\n')
  })

  it('refuses a path git never reported as changed', async () => {
    const { dir, sync } = await review('repo-outside')
    const outside = path.join(dir, '..', `crew-outside-${path.basename(dir)}.ts`)
    fs.writeFileSync(outside, 'export const elsewhere = true\n')
    made.push(outside)
    write(dir, 'app.ts', 'const app = true\n')

    const refused = await sync.run({
      do: 'discard',
      paths: ['app.ts', `../${path.basename(outside)}`]
    })

    expect(refused.ok).toBe(false)
    expect(refused.message).toBe('Those changes are not there any more.')
    expect(fs.existsSync(outside)).toBe(true)
    expect(read(dir, 'app.ts')).toBe('const app = true\n')
  })

  it('leaves the session out of what it stages and stashes', async () => {
    const { dir, sync } = await review('repo-session')
    fs.mkdirSync(path.join(dir, '.crew'), { recursive: true })
    write(dir, '.crew/session.json', '{"code":"abc"}\n')
    write(dir, 'app.ts', 'const app = true\n')

    const put = await sync.run({ do: 'stash', message: 'away' })

    expect(put.ok).toBe(true)
    expect(read(dir, '.crew/session.json')).toBe('{"code":"abc"}\n')
    expect(fs.existsSync(path.join(dir, 'app.ts'))).toBe(false)
    expect((await sync.work()).changes.map(change => change.path)).toEqual([])
  })
})
