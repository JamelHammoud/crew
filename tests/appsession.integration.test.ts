import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { parseLink } from '../src/shared/link'
import type { ServerMessage } from '../src/shared/protocol'
import { initRepo } from './helpers/git'
import { linkOf, TestUi, tmpDir, waitUntil } from './helpers/session'

function welcomeOf(ui: TestUi): Extract<ServerMessage, { type: 'welcome' }> {
  const welcome = ui.messages.find(m => m.type === 'welcome')
  if (!welcome) throw new Error('no welcome message')
  return welcome as Extract<ServerMessage, { type: 'welcome' }>
}

describe('app session', () => {
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

  it('hosts a session, shares a join link, and pools nobody until an agent is made', async () => {
    const repo = tmpDir('app-host')
    await initRepo(repo)
    const host = new AppSession()
    const info = await host.startHost(repo, 'sam')

    const target = parseLink(linkOf(info))
    expect(target.port).toBeGreaterThan(0)
    expect(target.code).toMatch(/^[a-f0-9]{6}$/)

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
    const guest = new AppSession({ session: path.join(guestData, 'session.json') })
    const info = await host.startHost(repoHost, 'sam')

    const joinInfo = await guest.startJoin(linkOf(info), repoGuest, 'jamel')
    expect(guest.recentJoins()).toEqual([
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
    expect(guest.recentJoins()).toHaveLength(1)
    await host.leave()
  }, 25000)
})
