import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { parseLink } from '../src/shared/link'
import { initRepo } from './helpers/git'
import { TestUi, tmpDir } from './helpers/session'

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
    await ui.waitForEvent(e => e.kind === 'agent.online', 15000)
    const agents = ui.events.filter(e => e.kind === 'agent.online')
    expect(agents.length).toBeGreaterThan(0)

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
    await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'sam', 15000)

    const jamelUi = await TestUi.connect(joinInfo.wsUrl, 'jamel', target.code)
    await jamelUi.waitForEvent(e => e.kind === 'person.joined' && e.name === 'sam', 15000)

    ui.close()
    jamelUi.close()
    await guest.leave()
    await host.leave()
  }, 20000)
})
