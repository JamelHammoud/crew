import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { parseLink } from '../src/shared/link'
import type { ServerMessage } from '../src/shared/protocol'
import { initRepo } from './helpers/git'
import { TestUi, tmpDir } from './helpers/session'

function welcomeOf(ui: TestUi): Extract<ServerMessage, { type: 'welcome' }> {
  const welcome = ui.messages.find(m => m.type === 'welcome')
  if (!welcome) throw new Error('no welcome message')
  return welcome as Extract<ServerMessage, { type: 'welcome' }>
}

describe('app session', () => {
  it('refuses a folder that is not a git repository', async () => {
    const app = new AppSession()
    await expect(app.startHost(tmpDir('not-git'), 'sam')).rejects.toThrow('not a git repository')
  })

  it('hosts a session, shares a join link, and pools detected agents', async () => {
    const repo = tmpDir('app-host')
    await initRepo(repo)
    const host = new AppSession()
    const info = await host.startHost(repo, 'sam')

    const target = parseLink(info.link)
    expect(target.port).toBeGreaterThan(0)
    expect(target.code).toMatch(/^[a-f0-9]{6}$/)

    const ui = await TestUi.connect(info.wsUrl, 'sam', target.code)
    await new Promise(r => setTimeout(r, 1500))
    const snapshot = welcomeOf(ui).snapshot
    expect(snapshot.agents.length).toBeGreaterThan(0)
    expect(snapshot.agents.every(a => a.ownerName === 'sam')).toBe(true)

    ui.close()
    await host.leave()
  }, 20000)

  it('lets a second person join through the link', async () => {
    const repoHost = tmpDir('app-join-host')
    const repoGuest = tmpDir('app-join-guest')
    await initRepo(repoHost)
    await initRepo(repoGuest)
    const host = new AppSession()
    const guest = new AppSession()
    const info = await host.startHost(repoHost, 'sam')

    const joinInfo = await guest.startJoin(info.link, repoGuest, 'jamel')
    const target = parseLink(info.link)
    const ui = await TestUi.connect(joinInfo.wsUrl, 'jamel', target.code)
    await new Promise(r => setTimeout(r, 1500))

    const snapshot = welcomeOf(ui).snapshot
    const names = snapshot.members.map(m => m.name)
    expect(names).toContain('sam')
    expect(names).toContain('jamel')
    expect(snapshot.agents.some(a => a.ownerName === 'sam')).toBe(true)

    ui.close()
    await guest.leave()
    await host.leave()
  }, 20000)
})
