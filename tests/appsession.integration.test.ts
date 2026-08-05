import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { publishCrew } from '../src/server/crewRepo'
import { Store } from '../src/server/store'
import { CODE_BYTES, parseLink } from '../src/shared/link'
import { writeCrewRemote } from '../src/shared/project'
import type { ServerMessage } from '../src/shared/protocol'
import { SavedSessionStore } from '../src/main/saved-session'
import { crewsAt } from './helpers/crews'
import { initBare, initRepo } from './helpers/git'
import { linkOf, TestUi, tmpDir, waitUntil } from './helpers/session'

function welcomeOf(ui: TestUi): Extract<ServerMessage, { type: 'welcome' }> {
  const welcome = ui.messages.find(m => m.type === 'welcome')
  if (!welcome) throw new Error('no welcome message')
  return welcome as Extract<ServerMessage, { type: 'welcome' }>
}

describe('app session', () => {
  it('keeps a new name for the open and saved session', async () => {
    const sessionFile = path.join(tmpDir('rename-session-state'), 'session.json')
    const app = new AppSession({ session: sessionFile, projects: tmpDir('rename-project-state') })
    const project = tmpDir('rename-project')
    await app.startHost(project, 'Jamel (dev)')

    expect(app.rename('  Jamel   High  ')?.name).toBe('Jamel High')
    expect(app.current()?.name).toBe('Jamel High')
    expect(new SavedSessionStore(sessionFile).load()?.name).toBe('Jamel High')

    await app.shutdown()
  })

  // A folder with no git in it is somewhere to work, so it opens on this
  // machine with nothing to sync rather than being turned away at the door.
  it('opens a folder that is not a git repository, kept on this machine', async () => {
    const app = new AppSession({ projects: tmpDir('not-git-state') })
    const plain = tmpDir('not-git')
    const info = await app.startHost(plain, 'sam')
    expect(info.home).toBe('private')
    expect(info.synced).toBe(false)
    expect(info.shared).toBe(false)
    await app.leave()
  })

  it('picks up the crew a project names', async () => {
    const base = tmpDir('named-crew')
    const origin = path.join(base, 'origin.git')
    const seed = path.join(base, 'seed')
    const project = tmpDir('named-crew-project')
    await initBare(origin)
    fs.mkdirSync(seed, { recursive: true })
    new Store(seed).appendEvent({
      id: 'e1',
      ts: Date.now(),
      kind: 'message',
      authorId: 'u1',
      authorName: 'sam',
      text: 'said before anybody cloned',
      mentions: []
    })
    expect((await publishCrew(seed, `file://${origin}`)).ok).toBe(true)
    await initRepo(project)
    await writeCrewRemote(project, `file://${origin}`)

    const state = tmpDir('named-crew-state')
    const app = new AppSession({ projects: state })
    const plan = await crewsAt({ projects: state }).projectPlan(project)
    expect(plan.home).toBe('private')
    expect(plan.known).toBe(true)
    expect(plan.crewHere).toBe(false)

    const info = await app.startHost(project, 'sam')
    expect(info.home).toBe('private')
    expect(info.crewRemote).toBe(`file://${origin}`)
    expect(info.synced).toBe(true)
    await app.leave()
  })

  it('will not open on a crew it cannot reach unless that is what was asked for', async () => {
    const project = tmpDir('away-crew-project')
    await initRepo(project)
    await writeCrewRemote(project, 'file:///nowhere/at/all.git')
    const app = new AppSession({ projects: tmpDir('away-crew-state') })

    await expect(app.startHost(project, 'sam')).rejects.toThrow()

    const info = await app.startHost(project, 'sam', { home: 'private', own: true })
    expect(info.home).toBe('private')
    expect(info.crewRemote).toBe(null)
    await app.leave()
  })

  it('hosts a session, shares a join link, and pools nobody until an agent is made', async () => {
    const repo = tmpDir('app-host')
    await initRepo(repo)
    const host = new AppSession()
    const info = await host.startHost(repo, 'sam')

    const target = parseLink(linkOf(info))
    expect(target.port).toBeGreaterThan(0)
    expect(target.code).toMatch(new RegExp(`^[a-f0-9]{${CODE_BYTES * 2}}$`))

    const ui = await TestUi.connect(info.wsUrl, 'sam', target.code)
    // An installed CLI is not an agent. Nothing joins the pool on its own.
    await new Promise(r => setTimeout(r, 1000))
    expect(welcomeOf(ui).snapshot.agents).toEqual([])
    expect(ui.events.some(e => e.kind === 'agent.online')).toBe(false)

    ui.close()
    await host.leave()
  }, 25000)

  it('lets a second person join through the link', async () => {
    const repoHost = tmpDir('app-join-host')
    const repoGuest = tmpDir('app-join-guest')
    const guestData = tmpDir('app-join-data')
    await initRepo(repoHost)
    await initRepo(repoGuest)
    const host = new AppSession()
    const guestState = path.join(guestData, 'session.json')
    const guest = new AppSession({ session: guestState })
    const crews = crewsAt({ session: guestState })
    const info = await host.startHost(repoHost, 'sam')

    const joinInfo = await guest.startJoin(linkOf(info), repoGuest, 'jamel')
    expect(crews.recentJoins()).toEqual([
      expect.objectContaining({ folder: repoGuest, name: 'jamel', link: linkOf(info) })
    ])
    const target = parseLink(linkOf(info))
    const ui = await TestUi.connect(joinInfo.wsUrl, 'jamel', target.code)
    await waitUntil(
      () => {
        const names = welcomeOf(ui).snapshot.members.map(m => m.name)
        const joined = ui.events.filter(e => e.kind === 'person.joined').map(e => (e as { name: string }).name)
        const seen = new Set([...names, ...joined])
        return seen.has('sam') && seen.has('jamel')
      },
      15000
    )

    ui.close()
    await guest.leave()
    expect(guest.current()).toBeNull()
    expect(crews.recentJoins()).toHaveLength(1)
    await host.leave()
  }, 25000)
})
