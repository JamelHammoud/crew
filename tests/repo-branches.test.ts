import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitSync } from '../src/server/git'
import { clone, git, initBare, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

async function commitAt(dir: string, message: string, when: string): Promise<void> {
  process.env.GIT_COMMITTER_DATE = when
  try {
    await git(dir, ['commit', '--allow-empty', '--date', when, '-m', message])
  } finally {
    delete process.env.GIT_COMMITTER_DATE
  }
}

async function setupOriginWithRemoteBranch() {
  const base = tmpDir('branches')
  const origin = path.join(base, 'origin.git')
  const seed = path.join(base, 'seed')
  const here = path.join(base, 'here')
  await initBare(origin)
  await initRepo(seed)
  await git(seed, ['remote', 'add', 'origin', origin])
  await git(seed, ['push', '-u', 'origin', 'main'])
  await git(seed, ['switch', '-c', 'remote-work'])
  fs.writeFileSync(path.join(seed, 'remote-work.ts'), 'export const remote = true\n')
  await git(seed, ['add', '-A'])
  await git(seed, ['commit', '-m', 'work only on the remote'])
  await git(seed, ['push', '-u', 'origin', 'remote-work'])
  await clone(origin, here)
  return { origin, here }
}

describe('repo branches', () => {
  it('lists every local branch newest first with the checked out one marked', async () => {
    const dir = tmpDir('branch-list')
    await initRepo(dir)
    await commitAt(dir, 'main work', '2026-01-01T10:00:00Z')
    await git(dir, ['switch', '-c', 'older'])
    await commitAt(dir, 'older work', '2026-01-02T10:00:00Z')
    await git(dir, ['switch', '-c', 'newer'])
    await commitAt(dir, 'newer work', '2026-01-03T10:00:00Z')
    await git(dir, ['switch', 'main'])

    const work = await new GitSync(dir).work()

    expect(work.branches.map(one => one.name)).toEqual(['newer', 'older', 'main'])
    expect(work.branches.filter(one => one.current).map(one => one.name)).toEqual(['main'])
    expect(work.branches.find(one => one.name === 'main')).toEqual({
      name: 'main',
      current: true,
      remote: false
    })
    expect(work.branches.every(one => one.remote === false)).toBe(true)
  })

  it('switches to another branch and reports the new one as current', async () => {
    const dir = tmpDir('branch-switch')
    await initRepo(dir)
    await git(dir, ['switch', '-c', 'feature'])
    await git(dir, ['switch', 'main'])
    const sync = new GitSync(dir)

    const result = await sync.run({ do: 'switch', branch: 'feature' })

    expect(result.ok).toBe(true)
    expect(result.status.branch).toBe('feature')
    expect((await git(dir, ['branch', '--show-current'])).trim()).toBe('feature')
    const work = await sync.work()
    expect(work.branches.find(one => one.name === 'feature')?.current).toBe(true)
    expect(work.branches.find(one => one.name === 'main')?.current).toBe(false)
  })

  it('refuses a branch that is not there and stays where it is', async () => {
    const dir = tmpDir('branch-missing')
    await initRepo(dir)
    const sync = new GitSync(dir)

    const result = await sync.run({ do: 'switch', branch: 'nowhere' })

    expect(result.ok).toBe(false)
    expect(result.status.branch).toBe('main')
    expect((await git(dir, ['branch', '--show-current'])).trim()).toBe('main')
    expect((await sync.work()).branches.map(one => one.name)).toEqual(['main'])
  })

  it('creates a branch and leaves you standing on it', async () => {
    const dir = tmpDir('branch-new')
    await initRepo(dir)
    const sync = new GitSync(dir)

    const result = await sync.run({ do: 'branch', name: 'feature' })

    expect(result.ok).toBe(true)
    expect((await git(dir, ['branch', '--show-current'])).trim()).toBe('feature')
    expect((await sync.work()).branches.find(one => one.name === 'feature')).toEqual({
      name: 'feature',
      current: true,
      remote: false
    })
  })

  it('creates a name with spaces and characters git will not take under a cleaned one', async () => {
    const dir = tmpDir('branch-clean')
    await initRepo(dir)
    const sync = new GitSync(dir)

    const result = await sync.run({ do: 'branch', name: 'my new thing?' })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('my-new-thing')
    expect((await git(dir, ['branch', '--show-current'])).trim()).toBe('my-new-thing')
    expect((await sync.work()).branches.map(one => one.name)).toContain('my-new-thing')
  })

  it('makes nothing when the name is empty', async () => {
    const dir = tmpDir('branch-empty')
    await initRepo(dir)
    const sync = new GitSync(dir)

    const result = await sync.run({ do: 'branch', name: '   ' })

    expect(result.ok).toBe(false)
    expect((await git(dir, ['branch', '--show-current'])).trim()).toBe('main')
    expect((await sync.work()).branches.map(one => one.name)).toEqual(['main'])
  })

  it('lists a branch that only exists on the remote under its plain name', async () => {
    const { here } = await setupOriginWithRemoteBranch()

    const work = await new GitSync(here).work()

    const names = work.branches.map(one => one.name)
    expect(await git(here, ['for-each-ref', '--format=%(refname)', 'refs/remotes'])).toContain(
      'refs/remotes/origin/HEAD'
    )
    expect(work.branches.find(one => one.name === 'remote-work')).toEqual({
      name: 'remote-work',
      current: false,
      remote: true
    })
    expect(work.branches.find(one => one.name === 'main')).toEqual({
      name: 'main',
      current: true,
      remote: false
    })
    expect(names).not.toContain('origin/remote-work')
    expect(names).not.toContain('origin/main')
    expect(names).not.toContain('origin/HEAD')
    expect(names).not.toContain('origin')
    expect(names).not.toContain('HEAD')
  })

  it('checks out a local branch that follows the remote one', async () => {
    const { here } = await setupOriginWithRemoteBranch()
    const sync = new GitSync(here)

    const result = await sync.run({ do: 'switch', branch: 'remote-work' })

    expect(result.ok).toBe(true)
    expect((await git(here, ['branch', '--show-current'])).trim()).toBe('remote-work')
    expect((await git(here, ['rev-parse', '--abbrev-ref', 'remote-work@{upstream}'])).trim()).toBe('origin/remote-work')
    expect(fs.readFileSync(path.join(here, 'remote-work.ts'), 'utf8')).toContain('remote = true')
    expect((await sync.work()).branches.find(one => one.name === 'remote-work')).toEqual({
      name: 'remote-work',
      current: true,
      remote: false
    })
  })

  it('pushes a branch made here that has no upstream yet', async () => {
    const { origin, here } = await setupOriginWithRemoteBranch()
    const sync = new GitSync(here)
    await sync.run({ do: 'branch', name: 'fresh' })
    fs.writeFileSync(path.join(here, 'fresh.ts'), 'export const fresh = true\n')
    expect((await git(here, ['branch', '--show-current'])).trim()).toBe('fresh')

    const result = await sync.run({ do: 'push' })

    expect(result.ok).toBe(true)
    expect(result.updated).toBe(true)
    expect(result.status.branch).toBe('fresh')
    expect(result.status.ahead).toBe(0)
    expect((await git(here, ['rev-parse', '--abbrev-ref', 'fresh@{upstream}'])).trim()).toBe('origin/fresh')
    expect(await git(origin, ['branch', '--list'])).toContain('fresh')
    expect(await git(origin, ['show', 'fresh:fresh.ts'])).toContain('fresh = true')
  })
})
