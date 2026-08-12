import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Crews } from '../src/main/crews'
import type { Runner } from '../src/runner'
import type { SessionEvent } from '../src/shared/events'
import { agentId } from '../src/shared/llm'
import type { LivePlace } from '../src/shared/places'
import { projectPlace } from '../src/shared/places'
import { popOutTarget } from '../src/shared/popOut'
import { crewsAt } from './helpers/crews'
import { makeFakeProvider } from './helpers/fake-provider'
import { initRepo } from './helpers/git'
import { testRunner } from './helpers/runner'
import { linkOf, TestUi, tmpDir, waitUntil } from './helpers/session'

function statePaths(prefix: string): { agents: string; session: string; projects: string } {
  const dir = tmpDir(prefix)
  return {
    agents: path.join(dir, 'agents.json'),
    session: path.join(dir, 'session.json'),
    projects: path.join(dir, 'projects')
  }
}

describe('several crews in one app', () => {
  const standing: Crews[] = []
  const uis: TestUi[] = []
  const runners: Runner[] = []

  function crews(prefix: string): Crews {
    const made = crewsAt(statePaths(prefix))
    standing.push(made)
    return made
  }

  async function repo(prefix: string): Promise<string> {
    const at = tmpDir(prefix)
    await initRepo(at)
    return at
  }

  afterEach(async () => {
    for (const ui of uis.splice(0)) ui.close()
    for (const runner of runners.splice(0)) runner.close()
    await Promise.all(standing.splice(0).map(made => made.shutdownAll()))
  })

  async function agentIn(started: { wsUrl: string; code: string }, folder: string): Promise<void> {
    const runner = testRunner({
      name: 'jamel',
      code: started.code,
      repoPath: folder,
      providers: [makeFakeProvider()],
      reconnectDelayMs: 100
    })
    runners.push(runner)
    runner.connect(started.wsUrl)
    await new Promise<void>(resolve => {
      runner.onStatus = status => {
        if (status === 'online') resolve()
      }
    })
  }

  it('lets two windows look at two different projects at once', async () => {
    const app = crews('crews-two-windows')
    const one = await repo('crews-window-one')
    const two = await repo('crews-window-two')
    const first = await app.start(1, one, 'Jamel')
    const second = await app.start(2, two, 'Jamel')

    expect(first.wsUrl).not.toBe(second.wsUrl)
    expect(app.current(1)?.folder).toBe(one)
    expect(app.current(2)?.folder).toBe(two)
    expect(app.folderInView(1)).toBe(one)
    expect(app.folderInView(2)).toBe(two)
    expect(app.keyInView(1)).toBe(projectPlace(one))
    expect(app.keyInView(2)).toBe(projectPlace(two))
  })

  it('gives a shared Crew and a private Crew different renderer ports', async () => {
    const app = crews('crews-distinct-host-ports')
    const one = await repo('crews-distinct-host-ports-one')
    const two = await repo('crews-distinct-host-ports-two')
    const shared = await app.start(1, one, 'Jamel', { home: 'folder', share: true })
    const privateCrew = await app.start(1, two, 'Jamel', { home: 'private', share: false })

    expect(privateCrew.wsUrl).not.toBe(shared.wsUrl)
    const sharedUi = await TestUi.connect(shared.wsUrl, 'Jamel', shared.code)
    const privateUi = await TestUi.connect(privateCrew.wsUrl, 'Jamel', privateCrew.code)
    uis.push(sharedUi, privateUi)
  })

  it('reads a file out of the project the window asking is looking at', async () => {
    const app = crews('crews-files')
    const one = await repo('crews-files-one')
    const two = await repo('crews-files-two')
    await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    writeFileSync(path.join(one, 'who.txt'), 'the first')
    writeFileSync(path.join(two, 'who.txt'), 'the second')

    const read = async (window: number): Promise<string> => {
      const file = await app.inView(window).readFile('who.txt')
      return file?.kind === 'file' ? file.text : ''
    }
    expect(await read(1)).toBe('the first')
    expect(await read(2)).toBe('the second')
  })

  it('leaves the other window where it was when one of them switches', async () => {
    const app = crews('crews-switch')
    const one = await repo('crews-switch-one')
    const two = await repo('crews-switch-two')
    const first = await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    const back = app.switchTo(2, projectPlace(one))
    expect(back?.wsUrl).toBe(first.wsUrl)
    expect(app.keyInView(1)).toBe(projectPlace(one))
    expect(app.keyInView(2)).toBe(projectPlace(one))
    expect(app.places()).toHaveLength(2)
  })

  it('says nothing is there rather than switching to a crew that is not running', async () => {
    const app = crews('crews-switch-dead')
    const one = await repo('crews-switch-dead-one')
    await app.start(1, one, 'Jamel')

    expect(app.switchTo(1, projectPlace('/nowhere'))).toBeNull()
    expect(app.keyInView(1)).toBe(projectPlace(one))
  })

  it('opens a project already running rather than a second copy of it', async () => {
    const app = crews('crews-same')
    const one = await repo('crews-same-one')
    const first = await app.start(1, one, 'Jamel')
    const again = await app.start(2, one, 'Jamel')

    expect(again.wsUrl).toBe(first.wsUrl)
    expect(app.places()).toHaveLength(1)
  })

  it('keeps the crew a window left running for everyone else', async () => {
    const app = crews('crews-leave')
    const one = await repo('crews-leave-one')
    const two = await repo('crews-leave-two')
    await app.start(1, one, 'Jamel')
    const second = await app.start(2, two, 'Jamel')

    await app.leave(1)

    expect(app.places().map(place => place.key)).toEqual([projectPlace(two)])
    expect(app.keyInView(1)).toBeNull()
    expect(app.current(2)?.wsUrl).toBe(second.wsUrl)
    uis.push(await TestUi.connect(second.wsUrl, 'Ali', second.code))
  })

  it('goes on running for the window that opened it once that window has gone', async () => {
    const app = crews('crews-window-gone')
    const one = await repo('crews-window-gone-one')
    const started = await app.start(1, one, 'Jamel')

    app.forget(1)

    expect(app.places()).toHaveLength(1)
    expect(app.any()).toBe(true)
    uis.push(await TestUi.connect(started.wsUrl, 'Ali', started.code))
  })

  it('hands a window with no project of its own whatever is running', async () => {
    const app = crews('crews-second-window')
    const one = await repo('crews-second-window-one')
    const started = await app.start(1, one, 'Jamel')

    expect(app.current(9)?.wsUrl).toBe(started.wsUrl)
    expect(app.keyInView(9)).toBe(projectPlace(one))
  })

  it('carries the threads a crew is really running out to the rail', async () => {
    const app = crews('crews-threads')
    const one = await repo('crews-threads-one')
    const started = await app.start(1, one, 'Jamel')
    const pushed: LivePlace[][] = []
    app.onLive = places => pushed.push(places)

    const ui = await TestUi.connect(started.wsUrl, 'Jamel', started.code)
    uis.push(ui)
    await agentIn(started, one)
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('draw the rail @Fake', [agentId('jamel', 'fake')])
    const opened = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Extract<
      SessionEvent,
      { kind: 'thread.started' }
    >

    const here = app.places().find(place => place.key === projectPlace(one))
    expect(here?.threads.map(thread => thread.id)).toContain(opened.threadId)
    expect(here?.threads.find(thread => thread.id === opened.threadId)?.title).toBe('Draw the rail')

    const said = pushed.at(-1)?.find(place => place.key === projectPlace(one))
    expect(said?.threads.map(thread => thread.id)).toContain(opened.threadId)
  })

  it('carries the host threads out to a joiner rail', async () => {
    const host = crews('crews-join-threads-host')
    const guest = crews('crews-join-threads-guest')
    const hostRepo = await repo('crews-join-threads-host-repo')
    const guestRepo = await repo('crews-join-threads-guest-repo')
    const started = await host.start(1, hostRepo, 'Jamel')
    const ui = await TestUi.connect(started.wsUrl, 'Jamel', started.code)
    uis.push(ui)
    await agentIn(started, hostRepo)
    await ui.waitForEvent(e => e.kind === 'agent.online')

    ui.chat('check the joiner rail @Fake', [agentId('jamel', 'fake')])
    const existing = (await ui.waitForEvent(e => e.kind === 'thread.started')) as Extract<
      SessionEvent,
      { kind: 'thread.started' }
    >

    const pushed: LivePlace[][] = []
    guest.onLive = places => pushed.push(places)
    await guest.join(2, linkOf(started), guestRepo, 'Ali')
    await waitUntil(
      () => guest.places().some(place => place.threads.some(thread => thread.id === existing.threadId)),
      2000
    )

    ui.chat('keep the joiner rail current @Fake', [agentId('jamel', 'fake')])
    const added = (await ui.waitForEvent(
      e => e.kind === 'thread.started' && e.threadId !== existing.threadId
    )) as Extract<SessionEvent, { kind: 'thread.started' }>
    await waitUntil(
      () => guest.places().some(place => place.threads.some(thread => thread.id === added.threadId)),
      2000
    )

    await ui.waitForEvent(e => e.kind === 'agent.end' && e.threadId === added.threadId)
    ui.send({ type: 'thread.archive', threadId: added.threadId })
    await waitUntil(
      () => guest.places().every(place => place.threads.every(thread => thread.id !== added.threadId)),
      2000
    )

    const joined = guest.places()[0]
    expect(joined.hosting).toBe(false)
    expect(joined.threads.map(thread => thread.id)).toContain(existing.threadId)
    expect(joined.threads.map(thread => thread.id)).not.toContain(added.threadId)
    expect(pushed.some(places => places[0]?.threads.some(thread => thread.id === added.threadId))).toBe(true)
    expect(pushed.at(-1)?.[0]?.threads.map(thread => thread.id)).not.toContain(added.threadId)
  })

  it('shows no threads for a crew this app is not running', async () => {
    const app = crews('crews-threads-elsewhere')
    const one = await repo('crews-threads-elsewhere-one')
    await app.start(1, one, 'Jamel')

    expect(app.places().find(place => place.key === projectPlace('/elsewhere'))).toBeUndefined()
  })

  it('pops a thread out on a crew the window asking is not looking at', async () => {
    const app = crews('crews-pop-other')
    const one = await repo('crews-pop-other-one')
    const two = await repo('crews-pop-other-two')
    await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    const target = popOutTarget(app.keyInView(1), projectPlace(two), app.openKeys())

    expect(target).toBe(projectPlace(two))
    expect(app.switchTo(3, target ?? '')?.folder).toBe(two)
    expect(app.keyInView(1)).toBe(projectPlace(one))
  })

  it('pops nothing out on a crew that is not running', async () => {
    const app = crews('crews-pop-dead')
    const one = await repo('crews-pop-dead-one')
    await app.start(1, one, 'Jamel')

    expect(popOutTarget(app.keyInView(1), projectPlace('/nowhere'), app.openKeys())).toBeNull()
  })

  it('pops out on the crew the window asking is in when it was told none', async () => {
    const app = crews('crews-pop-here')
    const one = await repo('crews-pop-here-one')
    const two = await repo('crews-pop-here-two')
    await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    expect(popOutTarget(app.keyInView(2), undefined, app.openKeys())).toBe(projectPlace(two))
  })

  it('leaves a crew it is no longer running out of the ones a thread may pop out on', async () => {
    const app = crews('crews-pop-left')
    const one = await repo('crews-pop-left-one')
    const two = await repo('crews-pop-left-two')
    await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    await app.close(projectPlace(two))

    expect(app.openKeys()).toEqual([projectPlace(one)])
    expect(popOutTarget(app.keyInView(1), projectPlace(two), app.openKeys())).toBeNull()
  })

  it('remembers every project it has opened rather than only the one in view', async () => {
    const app = crews('crews-recent')
    const one = await repo('crews-recent-one')
    const two = await repo('crews-recent-two')
    await app.start(1, one, 'Jamel')
    await app.start(1, two, 'Jamel')

    expect(
      app
        .recentProjects()
        .map(project => project.folder)
        .sort()
    ).toEqual([one, two].sort())
  })
})
