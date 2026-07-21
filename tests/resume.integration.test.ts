import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppSession } from '../src/main/session'
import { parseLink } from '../src/shared/link'
import { initRepo } from './helpers/git'
import { TestUi, tmpDir, waitUntil } from './helpers/session'

function statePaths(prefix: string): { agents: string; session: string } {
  const dir = tmpDir(prefix)
  return { agents: path.join(dir, 'agents.json'), session: path.join(dir, 'session.json') }
}

describe('session resume', () => {
  it('resumes nothing on a machine with no saved session', async () => {
    const app = new AppSession(statePaths('resume-none'))
    expect(await app.resume()).toBeNull()
    expect(app.current()).toBeNull()
  })

  it('brings a host back after the app closed, with the same code', async () => {
    const repo = tmpDir('resume-host-repo')
    await initRepo(repo)
    const paths = statePaths('resume-host')

    const first = new AppSession(paths)
    const info = await first.startHost(repo, 'sam')
    const code = parseLink(info.link).code
    expect(first.current()?.link).toBe(info.link)
    expect(first.current()?.code).toBe(code)
    await first.shutdown()

    const second = new AppSession(paths)
    const current = await second.resume()
    expect(current).not.toBeNull()
    expect(current!.code).toBe(code)
    expect(current!.name).toBe('sam')
    const ui = await TestUi.connect(current!.wsUrl, 'sam', current!.code)
    ui.close()
    await second.leave()

    const third = new AppSession(paths)
    expect(await third.resume()).toBeNull()
  }, 40000)

  it('brings someone who joined back into the same session', async () => {
    const hostRepo = tmpDir('resume-join-host-repo')
    const guestRepo = tmpDir('resume-join-guest-repo')
    await initRepo(hostRepo)
    await initRepo(guestRepo)

    const host = new AppSession(statePaths('resume-join-host'))
    const info = await host.startHost(hostRepo, 'sam')
    const target = parseLink(info.link)
    const ui = await TestUi.connect(info.wsUrl, 'sam', target.code)

    const guestPaths = statePaths('resume-join-guest')
    const guest = new AppSession(guestPaths)
    await guest.startJoin(info.link, guestRepo, 'jamel')
    const joined = await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'jamel', 15000)
    const jamelId = joined.kind === 'person.joined' ? joined.memberId : ''
    await guest.shutdown()
    await ui.waitForEvent(e => e.kind === 'person.left' && e.memberId === jamelId, 15000)

    const back = new AppSession(guestPaths)
    const current = await back.resume()
    expect(current).not.toBeNull()
    expect(current!.code).toBe(target.code)
    expect(current!.name).toBe('jamel')
    await waitUntil(
      () => ui.events.filter(e => e.kind === 'person.joined' && e.memberId === jamelId).length >= 2,
      15000
    )

    ui.close()
    await back.leave()
    await host.leave()
  }, 40000)
})
