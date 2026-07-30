import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { cloneCrew, crewHere, crewRepoUrl, publishCrew } from '../src/server/crewRepo'
import { Store } from '../src/server/store'
import { cleanCrewRemote, readCrewRemote, writeCrewRemote } from '../src/shared/project'
import { clone, git, initBare } from './helpers/git'
import { tmpDir } from './helpers/session'

beforeAll(() => {
  process.env.GIT_AUTHOR_NAME = 'crew test'
  process.env.GIT_AUTHOR_EMAIL = 'crew@test.local'
  process.env.GIT_COMMITTER_NAME = 'crew test'
  process.env.GIT_COMMITTER_EMAIL = 'crew@test.local'
})

function said(id: string, text: string) {
  return { id, ts: Date.now(), kind: 'message' as const, authorId: 'u1', authorName: 'sam', text, mentions: [] }
}

describe('a crew with a repo of its own', () => {
  it('writes an address down in the form everybody else can use', () => {
    expect(cleanCrewRemote('git@github.com:you/crew.git')).toBe('https://github.com/you/crew.git')
    expect(cleanCrewRemote('ssh://git@github.com/you/crew.git')).toBe('https://github.com/you/crew.git')
    expect(cleanCrewRemote('  https://github.com/you/crew.git  ')).toBe('https://github.com/you/crew.git')
    expect(cleanCrewRemote('not an address')).toBe(null)
    expect(cleanCrewRemote('')).toBe(null)
    expect(cleanCrewRemote(null)).toBe(null)
  })

  it('rides in the project, so cloning it is the whole of being handed the crew', async () => {
    const base = tmpDir('crew-pointer')
    const project = path.join(base, 'project')
    fs.mkdirSync(project, { recursive: true })
    expect(await readCrewRemote(project)).toBe(null)
    await writeCrewRemote(project, 'https://github.com/you/crew.git')
    expect(await readCrewRemote(project)).toBe('https://github.com/you/crew.git')
    expect(fs.readFileSync(path.join(project, '.crew.json'), 'utf8')).toContain('crew')
  })

  it('carries the union merge rule inside the crew rather than at the top of a repo', () => {
    const base = tmpDir('crew-attrs')
    new Store(base)
    expect(fs.readFileSync(path.join(base, '.crew', '.gitattributes'), 'utf8')).toContain('merge=union')
  })

  it('goes into an empty repo and comes back on somebody else machine', async () => {
    const base = tmpDir('crew-publish')
    const origin = path.join(base, 'origin.git')
    const mine = path.join(base, 'mine')
    const theirs = path.join(base, 'theirs')
    await initBare(origin)
    fs.mkdirSync(mine, { recursive: true })
    new Store(mine).appendEvent(said('e1', 'hello from mine'))

    const done = await publishCrew(mine, `file://${origin}`)
    expect(done.ok).toBe(true)
    expect(await crewRepoUrl(mine)).toBe(`file://${origin}`)

    const got = await cloneCrew(`file://${origin}`, theirs)
    expect(got.ok).toBe(true)
    expect(crewHere(theirs)).toBe(true)
    expect(new Store(theirs).loadEvents().map(event => event.id)).toContain('e1')
  })

  it('is refused a repo that already holds a crew, and leaves nothing behind', async () => {
    const base = tmpDir('crew-taken')
    const origin = path.join(base, 'origin.git')
    const already = path.join(base, 'already')
    const mine = path.join(base, 'mine')
    await initBare(origin)
    fs.mkdirSync(already, { recursive: true })
    new Store(already).appendEvent(said('theirs', 'a crew that got there first'))
    expect((await publishCrew(already, `file://${origin}`)).ok).toBe(true)

    fs.mkdirSync(mine, { recursive: true })
    new Store(mine).appendEvent(said('mine', 'a second crew'))
    const done = await publishCrew(mine, `file://${origin}`)
    expect(done.ok).toBe(false)
    expect(await crewRepoUrl(mine)).toBe(null)
  })

  it('says so rather than standing up an empty crew it cannot reach', async () => {
    const base = tmpDir('crew-away')
    const nowhere = path.join(base, 'nowhere.git')
    const dest = path.join(base, 'dest')
    const got = await cloneCrew(`file://${nowhere}`, dest)
    expect(got.ok).toBe(false)
    expect(fs.existsSync(dest)).toBe(false)
    expect(crewHere(dest)).toBe(false)
  })

  it('keeps both machines writing to one crew', async () => {
    const base = tmpDir('crew-both')
    const origin = path.join(base, 'origin.git')
    const mine = path.join(base, 'mine')
    const theirs = path.join(base, 'theirs')
    await initBare(origin)
    fs.mkdirSync(mine, { recursive: true })
    new Store(mine).appendEvent(said('e1', 'first'))
    await publishCrew(mine, `file://${origin}`)
    await clone(`file://${origin}`, theirs)

    new Store(theirs).appendEvent(said('e2', 'from the other machine'))
    await git(theirs, ['add', '-A'])
    await git(theirs, ['commit', '-m', 'crew'])
    await git(theirs, ['push'])
    await git(mine, ['pull', '--no-rebase', '--no-edit'])

    expect(new Store(mine).loadEvents().map(event => event.id)).toEqual(['e1', 'e2'])
  })
})
