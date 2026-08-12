import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Crews } from '../src/main/crews'
import { AppSession } from '../src/main/session'
import { parseLink } from '../src/shared/link'
import { projectPlace } from '../src/shared/places'
import { crewsAt } from './helpers/crews'
import { initRepo } from './helpers/git'
import { linkOf, TestUi, tmpDir, waitUntil } from './helpers/session'

function statePaths(prefix: string): { agents: string; session: string } {
  const dir = tmpDir(prefix)
  return { agents: path.join(dir, 'agents.json'), session: path.join(dir, 'session.json') }
}

describe('session resume', () => {
  const standing: Crews[] = []

  function crews(paths: { agents?: string; session?: string }): Crews {
    const made = crewsAt(paths)
    standing.push(made)
    return made
  }

  afterEach(async () => {
    await Promise.all(standing.splice(0).map(made => made.shutdownAll()))
  })

  it('resumes nothing on a machine with no saved session', async () => {
    const app = crews(statePaths('resume-none'))
    await app.resume()
    expect(app.places()).toEqual([])
    expect(app.current(1)).toBeNull()
  })

  it('brings a host back after the app closed, with the same code', async () => {
    const repo = tmpDir('resume-host-repo')
    await initRepo(repo)
    const paths = statePaths('resume-host')

    const first = new AppSession(paths)
    const info = await first.startHost(repo, 'sam')
    const code = parseLink(linkOf(info)).code
    expect(first.current()?.link).toBe(info.link)
    expect(first.current()?.code).toBe(code)
    await first.shutdown()

    const second = crews(paths)
    await second.resume()
    const current = second.current(1)
    expect(current).not.toBeNull()
    expect(current!.code).toBe(code)
    expect(current!.name).toBe('sam')
    const ui = await TestUi.connect(current!.wsUrl, 'sam', current!.code)
    ui.close()
    await second.leave(1)

    const third = crews(paths)
    await third.resume()
    expect(third.current(1)).toBeNull()
  }, 40000)

  it('brings someone who joined back into the same session', async () => {
    const hostRepo = tmpDir('resume-join-host-repo')
    const guestRepo = tmpDir('resume-join-guest-repo')
    await initRepo(hostRepo)
    await initRepo(guestRepo)

    const host = new AppSession(statePaths('resume-join-host'))
    const info = await host.startHost(hostRepo, 'sam')
    const target = parseLink(linkOf(info))
    const ui = await TestUi.connect(info.wsUrl, 'sam', target.code)

    const guestPaths = statePaths('resume-join-guest')
    const guest = new AppSession(guestPaths)
    await guest.startJoin(linkOf(info), guestRepo, 'jamel')
    const joined = await ui.waitForEvent(e => e.kind === 'person.joined' && e.name === 'jamel', 15000)
    const jamelId = joined.kind === 'person.joined' ? joined.memberId : ''
    await guest.shutdown()
    await ui.waitForEvent(e => e.kind === 'person.left' && e.memberId === jamelId, 15000)

    const back = crews(guestPaths)
    await back.resume()
    const current = back.current(1)
    expect(current).not.toBeNull()
    expect(current!.code).toBe(target.code)
    expect(current!.name).toBe('jamel')
    await waitUntil(
      () => ui.events.filter(e => e.kind === 'person.joined' && e.memberId === jamelId).length >= 2,
      15000
    )

    ui.close()
    await back.leave(1)
    await host.leave()
  }, 40000)

  // Opening a project is never the one before it being taken down, which is the
  // whole of what a window switching between crews stands on.
  it('opens a second project in one window and leaves the first one standing', async () => {
    const one = tmpDir('crews-first-repo')
    const two = tmpDir('crews-second-repo')
    await initRepo(one)
    await initRepo(two)
    const app = crews(statePaths('crews-both'))

    const first = await app.start(1, one, 'sam')
    const second = await app.start(1, two, 'sam')
    expect(second.wsUrl).not.toBe(first.wsUrl)
    expect(
      app
        .places()
        .map(place => place.key)
        .sort()
    ).toEqual([projectPlace(one), projectPlace(two)].sort())

    const uiOne = await TestUi.connect(first.wsUrl, 'sam', first.code)
    const uiTwo = await TestUi.connect(second.wsUrl, 'sam', second.code)
    uiOne.close()
    uiTwo.close()

    expect(app.current(1)?.folder).toBe(two)
    expect(app.switchTo(1, projectPlace(one))?.wsUrl).toBe(first.wsUrl)
    expect(app.current(1)?.folder).toBe(one)

    await app.close(projectPlace(one))
    expect(app.places().map(place => place.key)).toEqual([projectPlace(two)])
    const still = await TestUi.connect(second.wsUrl, 'sam', second.code)
    still.close()

    await app.shutdownAll()
    expect(app.places()).toEqual([])
    expect(app.current(1)).toBeNull()
  }, 40000)
})
