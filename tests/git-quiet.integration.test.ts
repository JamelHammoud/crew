import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { GitSync } from '../src/server/git'
import { clone, git, initBare, initRepo } from './helpers/git'
import { tmpDir } from './helpers/session'

async function originWithClone() {
  const base = tmpDir('git-quiet')
  const origin = path.join(base, 'origin.git')
  const seed = path.join(base, 'seed')
  const work = path.join(base, 'work')
  await initBare(origin)
  await initRepo(seed)
  await git(seed, ['remote', 'add', 'origin', origin])
  await git(seed, ['push', '-u', 'origin', 'main'])
  await clone(origin, work)
  return { origin, work }
}

describe('git quiet', () => {
  let syncs: GitSync[] = []

  function gitSync(repoPath: string): GitSync {
    const sync = new GitSync(repoPath)
    syncs.push(sync)
    return sync
  }

  afterEach(async () => {
    for (const sync of syncs) sync.stop()
    for (const sync of syncs) await sync.quiet()
    syncs = []
  })

  it('resolves at once on a sync that has done nothing', async () => {
    const dir = tmpDir('git-quiet-idle')
    await initRepo(dir)
    const sync = gitSync(dir)

    const started = Date.now()
    await expect(sync.quiet()).resolves.toBeUndefined()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('waits out a pass that is already committing and pushing', async () => {
    const { origin, work } = await originWithClone()
    const sync = gitSync(work)
    fs.writeFileSync(path.join(work, 'in-flight.ts'), 'export const inFlight = true\n')

    // Nothing awaits the pass itself, so the only thing that can have let it
    // finish is the wait below.
    let passSettled = false
    void sync.syncNow().then(() => {
      passSettled = true
    })
    sync.stop()
    expect(passSettled).toBe(false)

    await sync.quiet()

    const head = await git(work, ['show', '--pretty=format:', '--name-only', 'HEAD'])
    expect(head).toContain('in-flight.ts')
    expect((await git(work, ['log', '--oneline'])).split('\n')[0]).toContain('crew sync')
    expect((await git(work, ['status', '--porcelain'])).trim()).toBe('')
    expect(await git(origin, ['log', '--oneline', 'main'])).toContain('crew sync')
  })

  it('resolves rather than rejecting when the pass it waited on failed', async () => {
    const dir = tmpDir('git-quiet-broken')
    await initRepo(dir)
    await git(dir, ['remote', 'add', 'origin', path.join(dir, 'nowhere.git')])
    const sync = gitSync(dir)
    const logged: string[] = []
    sync.onLog = line => logged.push(line)
    fs.writeFileSync(path.join(dir, 'work.ts'), 'export const work = true\n')

    void sync.syncNow()
    sync.stop()

    await expect(sync.quiet()).resolves.toBeUndefined()
    expect(logged.some(line => line.startsWith('push failed'))).toBe(true)
  })

  it('has nothing to wait for in a folder that is not a git repository', async () => {
    const plain = tmpDir('git-quiet-plain')
    const sync = gitSync(plain)
    fs.writeFileSync(path.join(plain, 'note.txt'), 'nothing here is tracked\n')

    void sync.syncNow()
    sync.stop()

    await expect(sync.quiet()).resolves.toBeUndefined()
    expect(fs.existsSync(path.join(plain, '.git'))).toBe(false)
  })

  it('leaves nothing to await on stop, which is what quiet is for', async () => {
    const dir = tmpDir('git-quiet-stop')
    await initRepo(dir)
    const sync = gitSync(dir)
    sync.start(60000)

    expect(sync.stop()).toBeUndefined()
    expect(sync.quiet()).toBeInstanceOf(Promise)
    await sync.quiet()
  })
})
