import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Runner } from '../src/runner'
import { GitSync } from '../src/server/git'
import { agentId } from '../src/shared/llm'
import { makeFakeProvider } from './helpers/fake-provider'
import { clone, git, initBare, initRepo } from './helpers/git'
import { startHost, TestUi, tmpDir, waitUntil, type TestHost } from './helpers/session'
import { testRunner } from './helpers/runner'

async function originWithClones() {
  const base = tmpDir('autosync')
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

async function commitAndPush(repo: string, file: string, contents: string, message: string): Promise<void> {
  fs.writeFileSync(path.join(repo, file), contents)
  await git(repo, ['add', '-A'])
  await git(repo, ['commit', '-m', message])
  await git(repo, ['push'])
}

describe('auto sync', () => {
  let host: TestHost | null = null
  let runners: Runner[] = []
  let syncs: GitSync[] = []
  let uis: TestUi[] = []

  function autoSync(repoPath: string, intervalMs: number): GitSync {
    const sync = new GitSync(repoPath)
    syncs.push(sync)
    sync.start(intervalMs)
    return sync
  }

  function connectRunner(repoPath: string, sync: GitSync): Runner {
    const runner = testRunner({
      name: 'jamel',
      code: host!.code,
      repoPath,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100,
      onBeforeRun: () => sync.syncNow()
    })
    runners.push(runner)
    runner.connect(host!.url)
    return runner
  }

  afterEach(async () => {
    for (const ui of uis) ui.close()
    for (const runner of runners) runner.close()
    for (const sync of syncs) sync.stop()
    uis = []
    runners = []
    syncs = []
    await host?.close()
    host = null
  })

  it('pulls commits pushed to the remote', async () => {
    const { a, b } = await originWithClones()
    host = await startHost(a)
    connectRunner(b, autoSync(b, 300))

    await commitAndPush(a, 'feature.ts', 'export const x = 1\n', 'add feature')

    await waitUntil(() => fs.existsSync(path.join(b, 'feature.ts')))
    expect(fs.readFileSync(path.join(b, 'feature.ts'), 'utf8')).toContain('export const x = 1')
  })

  it('pushes work made on a joined machine', async () => {
    const { a, b } = await originWithClones()
    host = await startHost(a)
    connectRunner(b, autoSync(b, 300))

    fs.writeFileSync(path.join(b, 'joiner.ts'), 'export const fromJoiner = true\n')

    await waitUntil(async () => {
      await git(a, ['pull'])
      return fs.existsSync(path.join(a, 'joiner.ts'))
    })
    expect(fs.readFileSync(path.join(a, 'joiner.ts'), 'utf8')).toContain('fromJoiner = true')
  })

  it('keeps local edits in place while remote work arrives', async () => {
    const { a, b } = await originWithClones()
    host = await startHost(a)
    connectRunner(b, autoSync(b, 300))

    fs.appendFileSync(path.join(b, '.gitattributes'), 'local wip\n')
    await commitAndPush(a, 'other.ts', 'export const y = 2\n', 'add other')

    await waitUntil(() => fs.existsSync(path.join(b, 'other.ts')))
    expect(fs.readFileSync(path.join(b, '.gitattributes'), 'utf8')).toContain('local wip')
    expect(await git(b, ['stash', 'list'])).toBe('')
  })

  it('syncs before running a prompt so the agent sees fresh code', async () => {
    const { a, b } = await originWithClones()
    host = await startHost(a)
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    connectRunner(b, autoSync(b, 60000))
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === agentId('jamel', 'fake'))

    await commitAndPush(a, 'fresh.ts', 'export const z = 3\n', 'add fresh')
    ui.chat('hello @Fake', [agentId('jamel', 'fake')])
    await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === agentId('jamel', 'fake'))

    expect(fs.existsSync(path.join(b, 'fresh.ts'))).toBe(true)
  })

  it('leaves a plain folder alone and still runs prompts', async () => {
    host = await startHost(tmpDir('autosync-host'))
    const ui = await TestUi.connect(host.url, 'sam', host.code)
    uis.push(ui)
    const plain = tmpDir('autosync-plain')
    connectRunner(plain, autoSync(plain, 200))
    await ui.waitForEvent(e => e.kind === 'agent.online' && e.agentId === agentId('jamel', 'fake'))

    ui.chat('hello @Fake', [agentId('jamel', 'fake')])
    const end = await ui.waitForEvent(e => e.kind === 'agent.end' && e.agentId === agentId('jamel', 'fake'))
    expect(end.kind === 'agent.end' && end.ok).toBe(true)
  })
})
