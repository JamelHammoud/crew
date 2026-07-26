import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRepoFile, resolveRepoPath, statRepoFile, writeRepoFile } from '../src/main/files'
import { locatePath } from '../src/main/locate'
import { stripRoot, stripRootFromText } from '../src/shared/files'
import { tmpDir } from './helpers/session'

function makeRepo(): string {
  const root = tmpDir('files')
  mkdirSync(path.join(root, '.git'))
  mkdirSync(path.join(root, 'src', 'app'), { recursive: true })
  writeFileSync(path.join(root, 'readme.md'), 'hello\nworld\n')
  writeFileSync(path.join(root, 'src', 'app', 'main.ts'), 'export const x = 1\n')
  writeFileSync(path.join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]))
  return root
}

describe('readRepoFile', () => {
  it('reads a text file with a normalized path', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, './readme.md')
    expect(result).toEqual({ kind: 'file', path: 'readme.md', text: 'hello\nworld\n', truncated: false })
  })

  it('lists the root with folders first and hides .git', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, '')
    expect(result.kind).toBe('dir')
    if (result.kind !== 'dir') return
    expect(result.path).toBe('')
    expect(result.entries).toEqual([
      { name: 'src', dir: true },
      { name: 'logo.png', dir: false },
      { name: 'readme.md', dir: false }
    ])
  })

  it('lists a nested folder', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, 'src/app/')
    expect(result.kind).toBe('dir')
    if (result.kind !== 'dir') return
    expect(result.path).toBe('src/app')
    expect(result.entries).toEqual([{ name: 'main.ts', dir: false }])
  })

  it('reports a missing file', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, 'src/gone.ts')
    expect(result).toEqual({ kind: 'missing', path: 'src/gone.ts' })
  })

  it('refuses paths that escape the folder', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, '../outside.txt')
    expect(result.kind).toBe('missing')
    expect(resolveRepoPath(root, '../outside.txt')).toBeNull()
    expect(resolveRepoPath(root, 'src/../../outside.txt')).toBeNull()
  })

  it('returns a picture ready to show', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, 'logo.png')
    expect(result).toEqual({
      kind: 'image',
      path: 'logo.png',
      url: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]).toString('base64')}`,
      size: 6
    })
  })

  it('marks other binary files instead of returning garbage', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'app.bin'), Buffer.from([0x00, 0x01, 0x02]))
    const result = await readRepoFile(root, 'app.bin')
    expect(result).toEqual({ kind: 'binary', path: 'app.bin', size: 3 })
  })

  it('truncates very large files', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'big.txt'), 'a'.repeat(600 * 1024))
    const result = await readRepoFile(root, 'big.txt')
    expect(result.kind).toBe('file')
    if (result.kind !== 'file') return
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(512 * 1024)
  })
})

describe('statRepoFile', () => {
  it('tells files, folders, and missing paths apart', async () => {
    const root = makeRepo()
    expect(await statRepoFile(root, './readme.md')).toBe('file')
    expect(await statRepoFile(root, 'src/app/')).toBe('dir')
    expect(await statRepoFile(root, 'Undo/redo')).toBe('missing')
    expect(await statRepoFile(root, '../outside.txt')).toBe('missing')
  })
})

describe('locatePath', () => {
  it('places project paths relative to the project', async () => {
    const root = makeRepo()
    expect(await locatePath(root, path.join(root, 'src/app/main.ts'))).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true
    })
    expect(await locatePath(root, 'src/app/main.ts')).toEqual({ kind: 'repo', path: 'src/app/main.ts', exists: true })
    expect(await locatePath(root, path.join(root, 'src/gone.ts'))).toEqual({
      kind: 'repo',
      path: 'src/gone.ts',
      exists: false
    })
    expect(await locatePath(root, 'Undo/redo')).toEqual({ kind: 'repo', path: 'Undo/redo', exists: false })
  })

  it('matches the same file kept elsewhere on another computer', async () => {
    const root = makeRepo()
    expect(await locatePath(root, '/Users/someone/code/crew/src/app/main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true
    })
  })

  it('keeps back home paths that belong to someone else', async () => {
    const root = makeRepo()
    expect(await locatePath(root, '/Users/someone/Desktop/notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(root, '/home/someone/notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(null, '/Users/someone/notes.md')).toEqual({ kind: 'private' })
  })

  it('shows paths that are on this computer', async () => {
    const root = makeRepo()
    expect(await locatePath(root, os.homedir())).toEqual({ kind: 'local' })
    expect(await locatePath(root, '~/')).toEqual({ kind: 'local' })
    expect(await locatePath(root, '/usr/bin')).toEqual({ kind: 'local' })
  })

  it('matches a windows path onto the same file here', async () => {
    const root = makeRepo()
    expect(await locatePath(root, 'C:\\Users\\Ali Hammoud\\crew\\src\\app\\main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true
    })
    expect(await locatePath(root, 'src\\app\\main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true
    })
  })

  it('keeps back windows paths that belong to someone else', async () => {
    const root = makeRepo()
    expect(await locatePath(root, 'C:\\Users\\Ali Hammoud\\Desktop\\notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(root, 'D:\\shared\\build.log')).toEqual({ kind: 'local' })
  })
})

describe('stripRoot', () => {
  it('drops the working folder from paths written on either system', () => {
    expect(stripRoot('/Users/me/crew', '/Users/me/crew/src/app.ts')).toBe('src/app.ts')
    expect(stripRoot('C:\\Users\\Ali\\crew', 'C:\\Users\\Ali\\crew\\src\\app.ts')).toBe('src/app.ts')
    expect(stripRoot('/Users/me/crew', '/etc/hosts')).toBe('/etc/hosts')
  })

  it('drops the working folder from step details', () => {
    expect(stripRootFromText('C:\\Users\\Ali\\crew', 'Read C:\\Users\\Ali\\crew\\src\\app.ts (40 lines)')).toBe(
      'Read src/app.ts (40 lines)'
    )
    expect(stripRootFromText('/Users/me/crew', 'Edit /Users/me/crew/src/app.ts')).toBe('Edit src/app.ts')
    expect(stripRootFromText('/Users/me/crew', 'Nothing to strip here')).toBe('Nothing to strip here')
  })
})

describe('writeRepoFile', () => {
  it('writes a text file and returns the fresh contents', async () => {
    const root = makeRepo()
    const result = await writeRepoFile(root, 'readme.md', 'updated\n')
    expect(result).toEqual({ kind: 'file', path: 'readme.md', text: 'updated\n', truncated: false })
    expect(readFileSync(path.join(root, 'readme.md'), 'utf8')).toBe('updated\n')
  })

  it('does not create files that are not already in the folder', async () => {
    const root = makeRepo()
    expect(await writeRepoFile(root, 'brand-new.txt', 'x')).toBeNull()
    expect(existsSync(path.join(root, 'brand-new.txt'))).toBe(false)
  })

  it('refuses folders and paths that escape the folder', async () => {
    const root = makeRepo()
    expect(await writeRepoFile(root, 'src', 'x')).toBeNull()
    expect(await writeRepoFile(root, '../outside.txt', 'x')).toBeNull()
    expect(existsSync(path.join(root, '..', 'outside.txt'))).toBe(false)
  })

  it('refuses files too large to have been fully loaded', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'big.txt'), 'a'.repeat(600 * 1024))
    expect(await writeRepoFile(root, 'big.txt', 'tiny')).toBeNull()
    expect(readFileSync(path.join(root, 'big.txt'), 'utf8').length).toBe(600 * 1024)
  })
})
