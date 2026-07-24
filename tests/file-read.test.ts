import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRepoFile, resolveRepoPath, writeRepoFile } from '../src/main/files'
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

  it('marks binary files instead of returning garbage', async () => {
    const root = makeRepo()
    const result = await readRepoFile(root, 'logo.png')
    expect(result).toEqual({ kind: 'binary', path: 'logo.png', size: 6 })
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
