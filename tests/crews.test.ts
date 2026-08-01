import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Crews } from '../src/main/crews'
import { projectPlace } from '../src/shared/places'
import { crewsAt } from './helpers/crews'
import { initRepo } from './helpers/git'
import { TestUi, tmpDir, waitUntil } from './helpers/session'

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
    await Promise.all(uis.splice(0).map(ui => ui.close()))
    await Promise.all(standing.splice(0).map(made => made.shutdownAll()))
  })

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

  it('reads a file out of the project the window asking is looking at', async () => {
    const app = crews('crews-files')
    const one = await repo('crews-files-one')
    const two = await repo('crews-files-two')
    await app.start(1, one, 'Jamel')
    await app.start(2, two, 'Jamel')

    await app.inView(1).writeFile('who.txt', 'the first')
    await app.inView(2).writeFile('who.txt', 'the second')

    expect((await app.inView(1).readFile('who.txt'))?.text).toBe('the first')
    expect((await app.inView(2).readFile('who.txt'))?.text).toBe('the second')
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
    const ui = new TestUi(second.wsUrl, 'Ali')
    uis.push(ui)
    await ui.connect()
    await waitUntil(() => ui.snapshot !== null)
  })

  it('goes on running for the window that opened it once that window has gone', async () => {
    const app = crews('crews-window-gone')
    const one = await repo('crews-window-gone-one')
    const started = await app.start(1, one, 'Jamel')

    app.forget(1)

    expect(app.places()).toHaveLength(1)
    expect(app.any()).toBe(true)
    const ui = new TestUi(started.wsUrl, 'Ali')
    uis.push(ui)
    await ui.connect()
    await waitUntil(() => ui.snapshot !== null)
  })

  it('hands a window with no project of its own whatever is running', async () => {
    const app = crews('crews-second-window')
    const one = await repo('crews-second-window-one')
    const started = await app.start(1, one, 'Jamel')

    expect(app.current(9)?.wsUrl).toBe(started.wsUrl)
    expect(app.keyInView(9)).toBe(projectPlace(one))
  })

  it('remembers every project it has opened rather than only the one in view', async () => {
    const app = crews('crews-recent')
    const one = await repo('crews-recent-one')
    const two = await repo('crews-recent-two')
    await app.start(1, one, 'Jamel')
    await app.start(1, two, 'Jamel')

    expect(app.recentProjects().map(project => project.folder).sort()).toEqual([one, two].sort())
  })
})
