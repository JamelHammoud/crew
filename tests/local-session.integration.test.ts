import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { projectKey } from '../src/shared/project'
import { runGit } from '../src/shared/git'
import type { ServerMessage } from '../src/shared/protocol'
import { initRepo } from './helpers/git'
import { linkOf, TestUi, tmpDir } from './helpers/session'

// What somebody walking in is handed. History arrives in the welcome rather
// than as events, so this is what says the crew was really there before them.
function historyOf(ui: TestUi): string[] {
  const welcome = ui.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
  return welcome.snapshot.events.flatMap(event => (event.kind === 'message' ? [event.text] : []))
}

function statePaths(prefix: string): { agents: string; session: string; projects: string } {
  const dir = tmpDir(prefix)
  return {
    agents: path.join(dir, 'agents.json'),
    session: path.join(dir, 'session.json'),
    projects: path.join(dir, 'projects')
  }
}

async function commitCount(repo: string): Promise<number> {
  const result = await runGit(['rev-list', '--count', 'HEAD'], repo)
  return result.code === 0 ? Number(result.stdout.trim()) : 0
}

describe('a crew kept on this machine', () => {
  it('writes nothing into the project and never commits', async () => {
    const repo = tmpDir('local-quiet-repo')
    await initRepo(repo)
    const before = await commitCount(repo)

    const app = new AppSession(statePaths('local-quiet'))
    const info = await app.startHost(repo, 'sam', { home: 'private' })

    expect(info.home).toBe('private')
    expect(info.synced).toBe(false)
    expect(info.shared).toBe(false)
    expect(info.link).toBeNull()
    expect(info.wsUrl).toContain('127.0.0.1')

    const ui = await TestUi.connect(info.wsUrl, 'sam', info.code)
    ui.chat('only me here')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'only me here', 10000)
    ui.close()

    await new Promise(resolve => setTimeout(resolve, 1500))
    expect(fs.existsSync(path.join(repo, '.crew'))).toBe(false)
    expect(await commitCount(repo)).toBe(before)
    await app.leave()
  }, 30000)

  it('keeps its history beside the app, keyed so a moved project still finds it', async () => {
    const repo = tmpDir('local-key-repo')
    await initRepo(repo)
    const paths = statePaths('local-key')

    const app = new AppSession(paths)
    const info = await app.startHost(repo, 'sam', { home: 'private' })
    const ui = await TestUi.connect(info.wsUrl, 'sam', info.code)
    ui.chat('kept')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'kept', 10000)
    ui.close()
    await app.shutdown()

    const key = await projectKey(repo)
    const root = path.join(paths.projects, key, '.crew')
    expect(fs.existsSync(root)).toBe(true)

    // The same project reached by another path is the same crew, because the
    // key is the repo's first commit rather than where the folder is sitting.
    const moved = tmpDir('local-key-moved')
    fs.cpSync(repo, moved, { recursive: true })
    expect(await projectKey(moved)).toBe(key)

    const back = new AppSession(paths)
    const second = await back.startHost(moved, 'sam', { home: 'private' })
    const ui2 = await TestUi.connect(second.wsUrl, 'sam', second.code)
    expect(historyOf(ui2)).toContain('kept')
    ui2.close()
    await back.leave()
  }, 40000)

  it('remembers where a project put its crew, so it is only ever asked once', async () => {
    const repo = tmpDir('local-plan-repo')
    await initRepo(repo)
    const paths = statePaths('local-plan')

    const app = new AppSession(paths)
    expect(await app.projectPlan(repo)).toEqual({ home: 'folder', tracked: true, known: false })

    await app.startHost(repo, 'sam', { home: 'private' })
    await app.shutdown()

    const back = new AppSession(paths)
    expect(await back.projectPlan(repo)).toEqual({ home: 'private', tracked: true, known: true })
    const again = await back.startHost(repo, 'sam')
    expect(again.home).toBe('private')
    expect(fs.existsSync(path.join(repo, '.crew'))).toBe(false)
    await back.leave()
  }, 30000)

  it('opens a folder that is not tracked with git at all', async () => {
    const plain = tmpDir('local-plain')
    const app = new AppSession(statePaths('local-plain-state'))
    expect(await app.projectPlan(plain)).toEqual({ home: 'private', tracked: false, known: false })

    const info = await app.startHost(plain, 'sam', { home: 'private' })
    expect(info.synced).toBe(false)
    const ui = await TestUi.connect(info.wsUrl, 'sam', info.code)
    ui.chat('no git anywhere')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'no git anywhere', 10000)
    ui.close()
    await app.leave()
  }, 30000)

  it('lets somebody in without the session being remade, and puts it away again', async () => {
    const repo = tmpDir('local-share-repo')
    await initRepo(repo)
    const guestRepo = tmpDir('local-share-guest')
    await initRepo(guestRepo)

    const app = new AppSession(statePaths('local-share'))
    const info = await app.startHost(repo, 'sam', { home: 'private' })
    const ui = await TestUi.connect(info.wsUrl, 'sam', info.code)
    ui.chat('said before anyone arrived')
    await ui.waitForEvent(e => e.kind === 'message' && e.text === 'said before anyone arrived', 10000)

    const open = await app.setShared(true)
    expect(open?.shared).toBe(true)
    expect(open?.code).toBe(info.code)
    expect(open?.home).toBe('private')

    const guest = await TestUi.connect(open!.wsUrl, 'jamel', open!.code)
    await waitUntil(() => guest.events.some(e => e.kind === 'message' && e.text === 'said before anyone arrived'), 10000)
    expect(linkOf(open!)).toContain(String(new URL(open!.wsUrl.replace('ws:', 'http:')).port))
    guest.close()

    const shut = await app.setShared(false)
    expect(shut?.shared).toBe(false)
    expect(shut?.link).toBeNull()
    expect(shut?.code).toBe(info.code)

    ui.close()
    expect(fs.existsSync(path.join(repo, '.crew'))).toBe(false)
    await app.leave()
  }, 40000)
})
