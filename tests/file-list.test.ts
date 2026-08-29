import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRepoEntry, listRepoFiles, moveRepoEntry } from '../src/main/files'
import { markRuns, matchFiles } from '../src/shared/files'
import { runGit } from '../src/shared/git'
import { tmpDir } from './helpers/session'

function write(root: string, file: string, text: string): void {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, text)
}

async function makeRepo(): Promise<string> {
  const root = tmpDir('list')
  write(root, '.gitignore', 'node_modules\nout\n')
  write(root, 'readme.md', 'hello\n')
  write(root, 'src/app.ts', 'export const x = 1\n')
  write(root, 'src/renderer/panel.tsx', 'export const y = 2\n')
  write(root, 'node_modules/left/index.js', 'module.exports = 1\n')
  write(root, 'out/build.js', 'built\n')
  await runGit(['init'], root)
  await runGit(['add', '-A'], root)
  return root
}

describe('listRepoFiles', () => {
  it('lists what the project is made of and leaves out what git ignores', async () => {
    const root = await makeRepo()
    expect(await listRepoFiles(root)).toEqual(['.gitignore', 'readme.md', 'src/app.ts', 'src/renderer/panel.tsx'])
  })

  it('lists a file that has never been committed', async () => {
    const root = await makeRepo()
    write(root, 'src/fresh.ts', 'export const z = 3\n')
    expect(await listRepoFiles(root)).toContain('src/fresh.ts')
  })

  it('walks a folder that is not a repository, skipping the heavy ones', async () => {
    const root = tmpDir('plain')
    write(root, 'notes.md', 'hi\n')
    write(root, 'src/app.ts', 'x\n')
    write(root, 'node_modules/left/index.js', 'y\n')
    expect(await listRepoFiles(root)).toEqual(['notes.md', 'src/app.ts'])
  })
})

describe('createRepoEntry', () => {
  it('creates empty files and folders inside the project', async () => {
    const root = tmpDir('create-entry')
    mkdirSync(path.join(root, 'src'))

    expect(await createRepoEntry(root, 'src/new.ts', 'file')).toEqual({ ok: true, path: 'src/new.ts' })
    expect(readFileSync(path.join(root, 'src/new.ts'), 'utf8')).toBe('')
    expect(await createRepoEntry(root, 'src/components', 'folder')).toEqual({ ok: true, path: 'src/components' })
    expect(existsSync(path.join(root, 'src/components'))).toBe(true)
  })

  it('never replaces an entry that is already there', async () => {
    const root = tmpDir('create-existing')
    write(root, 'notes.md', 'keep me')

    expect(await createRepoEntry(root, 'notes.md', 'file')).toEqual({
      ok: false,
      message: 'That name is already in use'
    })
    expect(readFileSync(path.join(root, 'notes.md'), 'utf8')).toBe('keep me')
  })

  it('refuses paths outside the project, including folders reached through a symlink', async () => {
    const root = tmpDir('create-root')
    const outside = tmpDir('create-outside')
    symlinkSync(outside, path.join(root, 'outside'))

    expect(await createRepoEntry(root, '../escaped.txt', 'file')).toEqual({
      ok: false,
      message: 'Choose a name inside this project'
    })
    expect(await createRepoEntry(root, 'outside/escaped.txt', 'file')).toEqual({
      ok: false,
      message: 'Choose a name inside this project'
    })
    expect(existsSync(path.join(outside, 'escaped.txt'))).toBe(false)
  })
})

describe('moveRepoEntry', () => {
  it('moves files and whole folders without changing their names', async () => {
    const root = tmpDir('move-entry')
    write(root, 'src/app.ts', 'keep me')
    write(root, 'src/components/button.tsx', 'button')
    mkdirSync(path.join(root, 'tests'))

    expect(await moveRepoEntry(root, 'src/app.ts', 'tests')).toEqual({ ok: true, path: 'tests/app.ts' })
    expect(readFileSync(path.join(root, 'tests/app.ts'), 'utf8')).toBe('keep me')
    expect(existsSync(path.join(root, 'src/app.ts'))).toBe(false)

    expect(await moveRepoEntry(root, 'src/components', 'tests')).toEqual({ ok: true, path: 'tests/components' })
    expect(readFileSync(path.join(root, 'tests/components/button.tsx'), 'utf8')).toBe('button')
    expect(existsSync(path.join(root, 'src/components'))).toBe(false)
  })

  it('never replaces an item already in the destination', async () => {
    const root = tmpDir('move-existing')
    write(root, 'src/notes.md', 'source')
    write(root, 'archive/notes.md', 'destination')

    expect(await moveRepoEntry(root, 'src/notes.md', 'archive')).toEqual({
      ok: false,
      message: 'That name is already in use there'
    })
    expect(readFileSync(path.join(root, 'src/notes.md'), 'utf8')).toBe('source')
    expect(readFileSync(path.join(root, 'archive/notes.md'), 'utf8')).toBe('destination')
  })

  it('refuses traversal, symlink escapes, and a folder moved into itself', async () => {
    const root = tmpDir('move-root')
    const outside = tmpDir('move-outside')
    write(root, 'src/nested/app.ts', 'inside')
    write(outside, 'outside.md', 'outside')
    symlinkSync(outside, path.join(root, 'outside'))

    expect(await moveRepoEntry(root, '../outside.md', 'src')).toEqual({
      ok: false,
      message: 'Choose a place inside this project'
    })
    expect(await moveRepoEntry(root, 'src/nested/app.ts', 'outside')).toEqual({
      ok: false,
      message: 'Choose a place inside this project'
    })
    expect(await moveRepoEntry(root, 'src', 'src/nested')).toEqual({
      ok: false,
      message: 'A folder cannot contain itself'
    })
    expect(readFileSync(path.join(root, 'src/nested/app.ts'), 'utf8')).toBe('inside')
    expect(readFileSync(path.join(outside, 'outside.md'), 'utf8')).toBe('outside')
  })
})

describe('matchFiles', () => {
  const paths = [
    'src/renderer/src/components/FileTree.tsx',
    'src/renderer/src/components/FileView.tsx',
    'src/main/files.ts',
    'tests/file-read.test.ts',
    'readme.md'
  ]

  it('finds files by the letters of their name, in order', () => {
    const found = matchFiles(paths, 'filetree', 10)
    expect(found.map(match => match.path)).toEqual(['src/renderer/src/components/FileTree.tsx'])
  })

  it('puts a match in the file name above one spread across the folders', () => {
    const found = matchFiles(paths, 'files', 10)
    expect(found[0].path).toBe('src/main/files.ts')
  })

  it('prefers the tighter run when two names both match', () => {
    const found = matchFiles(paths, 'filev', 10)
    expect(found[0].path).toBe('src/renderer/src/components/FileView.tsx')
  })

  it('matches across folders when nothing in a name lines up', () => {
    const found = matchFiles(paths, 'testsfile', 10)
    expect(found.map(match => match.path)).toEqual(['tests/file-read.test.ts'])
  })

  it('says nothing matched rather than guessing', () => {
    expect(matchFiles(paths, 'zzz', 10)).toEqual([])
    expect(matchFiles(paths, '   ', 10)).toEqual([])
  })

  it('keeps only as many as it was asked for', () => {
    expect(matchFiles(paths, 'e', 2).length).toBe(2)
  })

  it('hands back where each letter landed, so they can be picked out', () => {
    const found = matchFiles(['src/app.ts'], 'app', 10)
    expect(found[0].hits).toEqual([4, 5, 6])
  })
})

describe('markRuns', () => {
  it('gathers the letters that matched into runs', () => {
    expect(markRuns('FileTree.tsx', [0, 1, 2, 3])).toEqual([
      { text: 'File', hit: true },
      { text: 'Tree.tsx', hit: false }
    ])
    expect(markRuns('app.ts', [])).toEqual([{ text: 'app.ts', hit: false }])
    expect(markRuns('', [])).toEqual([])
  })
})
