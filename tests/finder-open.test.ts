import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { finderOpenRequest, FinderOpens } from '../src/main/finder-open'

const made: string[] = []

async function temp(): Promise<string> {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'crew-finder-'))
  made.push(folder)
  return folder
}

afterEach(async () => {
  await Promise.all(made.splice(0).map(folder => rm(folder, { recursive: true, force: true })))
})

describe('opening from Finder', () => {
  it('opens a selected folder as the project', async () => {
    const folder = await temp()
    expect(await finderOpenRequest(folder)).toEqual({ folder })
  })

  it('opens a file inside its Git project', async () => {
    const root = await temp()
    execFileSync('git', ['init', '-q'], { cwd: root })
    await mkdir(path.join(root, 'src', 'views'), { recursive: true })
    const file = path.join(root, 'src', 'views', 'Home.tsx')
    await writeFile(file, '')
    expect(await finderOpenRequest(file)).toEqual({ folder: root, file: 'src/views/Home.tsx' })
  })

  it('opens a file outside Git from its containing folder', async () => {
    const folder = await temp()
    const file = path.join(folder, 'notes.txt')
    await writeFile(file, '')
    expect(await finderOpenRequest(file)).toEqual({ folder, file: 'notes.txt' })
  })

  it('ignores a target that is gone', async () => {
    const folder = await temp()
    expect(await finderOpenRequest(path.join(folder, 'gone.ts'))).toBeNull()
  })

  it('holds launch events until the app is ready and accepts later events', async () => {
    const folder = await temp()
    const first = path.join(folder, 'first.ts')
    const second = path.join(folder, 'second.ts')
    await writeFile(first, '')
    await writeFile(second, '')
    const opened: string[] = []
    const finder = new FinderOpens(request => opened.push(request.file ?? request.folder))
    finder.add(first)
    expect(opened).toEqual([])
    expect(await finder.start()).toBe(1)
    expect(opened).toEqual(['first.ts'])
    finder.add(second)
    await vi.waitFor(() => expect(opened).toEqual(['first.ts', 'second.ts']))
  })
})
