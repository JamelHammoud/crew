import { mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileSearch } from '../src/main/fileSearch'
import { runGit } from '../src/shared/git'
import { tmpDir } from './helpers/session'

function write(root: string, file: string, text: string | Buffer): void {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, text)
}

async function makeRepo(): Promise<string> {
  const root = tmpDir('search')
  write(root, '.gitignore', 'ignored\n')
  write(root, 'readme.md', 'A quiet first line\nThe Search Needle is here\n')
  write(root, 'src/app.ts', 'export const value = "needle"\n')
  write(root, 'ignored/result.txt', 'needle\n')
  write(root, 'binary.dat', Buffer.from([0x00, 0x6e, 0x65, 0x65, 0x64, 0x6c, 0x65]))
  await runGit(['init'], root)
  await runGit(['add', '-A'], root)
  return root
}

describe('FileSearch', () => {
  it('finds project text by line and ignores casing, binary files, and ignored files', async () => {
    const root = await makeRepo()
    const result = await new FileSearch().search(root, 'search needle')

    expect(result).toEqual({
      matches: [{ path: 'readme.md', line: 2, text: 'The Search Needle is here', start: 4, end: 17 }],
      limited: false
    })
  })

  it('returns one result for each matching line', async () => {
    const root = await makeRepo()
    write(root, 'src/many.ts', 'needle one\nnone\nneedle two\n')

    const result = await new FileSearch().search(root, 'needle')

    expect(result.matches.map(match => `${match.path}:${match.line}`)).toEqual([
      'readme.md:2',
      'src/app.ts:1',
      'src/many.ts:1',
      'src/many.ts:3'
    ])
  })

  it('marks a capped result set as limited', async () => {
    const root = await makeRepo()

    const result = await new FileSearch().search(root, 'needle', 1)

    expect(result.matches).toHaveLength(1)
    expect(result.limited).toBe(true)
  })

  it('keeps the match visible when a line is shortened for display', async () => {
    const root = await makeRepo()
    write(root, 'long.txt', `${'a'.repeat(400)}needle${'b'.repeat(400)}\n`)

    const result = await new FileSearch().search(root, 'needle')
    const match = result.matches.find(one => one.path === 'long.txt')!

    expect(match.text.length).toBeLessThanOrEqual(240)
    expect(match.text.slice(match.start, match.end)).toBe('needle')
    expect(match.text.startsWith('…')).toBe(true)
    expect(match.text.endsWith('…')).toBe(true)
  })

  it('refreshes a cached file when it changes', async () => {
    const root = await makeRepo()
    const search = new FileSearch()
    expect((await search.search(root, 'needle')).matches.some(match => match.path === 'src/app.ts')).toBe(true)

    const target = path.join(root, 'src/app.ts')
    writeFileSync(target, 'export const value = "change"\n')
    const future = new Date(Date.now() + 5000)
    utimesSync(target, future, future)

    expect((await search.search(root, 'needle')).matches.some(match => match.path === 'src/app.ts')).toBe(false)
    expect((await search.search(root, 'change')).matches.some(match => match.path === 'src/app.ts')).toBe(true)
  })
})
