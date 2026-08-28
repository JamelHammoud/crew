import { mkdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FileSearch } from '../src/main/fileSearch'
import type { FileSearchOptions } from '../src/shared/fileSearch'
import { runGit } from '../src/shared/git'
import { tmpDir } from './helpers/session'

function write(root: string, file: string, text: string | Buffer): void {
  const target = path.join(root, file)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, text)
}

function options(query: string, patch: Partial<FileSearchOptions> = {}): FileSearchOptions {
  return {
    query,
    matchCase: false,
    wholeWord: false,
    regex: false,
    include: '',
    exclude: '',
    ...patch
  }
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
  it('finds project text with exact positions and leaves out binary and ignored files', async () => {
    const root = await makeRepo()
    const result = await new FileSearch().search(root, options('search needle'))

    expect(result).toEqual({
      matches: [
        {
          path: 'readme.md',
          line: 2,
          column: 5,
          endColumn: 18,
          text: 'The Search Needle is here',
          start: 4,
          end: 17
        }
      ],
      limited: false,
      error: null
    })
  })

  it('returns every match on a line and honors case, whole words, and Unicode boundaries', async () => {
    const root = await makeRepo()
    write(root, 'words.txt', 'Needle needle needle_case préneedle needle après\n')
    const search = new FileSearch()

    const insensitive = await search.search(root, options('needle'))
    expect(insensitive.matches.filter(match => match.path === 'words.txt').map(match => match.column)).toEqual([
      1, 8, 15, 30, 37
    ])

    const exact = await search.search(root, options('Needle', { matchCase: true }))
    expect(exact.matches.filter(match => match.path === 'words.txt').map(match => match.column)).toEqual([1])

    const whole = await search.search(root, options('needle', { wholeWord: true }))
    expect(whole.matches.filter(match => match.path === 'words.txt').map(match => match.column)).toEqual([1, 8, 37])
  })

  it('supports expressions, file globs, and exclude precedence', async () => {
    const root = await makeRepo()
    write(root, 'src/one.test.ts', 'value12 value34\n')
    write(root, 'tests/two.test.ts', 'value56\n')

    const result = await new FileSearch().search(
      root,
      options('value(\\d+)', {
        regex: true,
        include: '{src,tests}/**/*.test.ts',
        exclude: 'tests/**'
      })
    )

    expect(result.matches.map(match => `${match.path}:${match.column}`)).toEqual([
      'src/one.test.ts:1',
      'src/one.test.ts:9'
    ])
  })

  it('reports invalid expressions without searching', async () => {
    const root = await makeRepo()
    const result = await new FileSearch().search(root, options('(', { regex: true }))

    expect(result.matches).toEqual([])
    expect(result.error).toBeTruthy()
  })

  it('caps broad and zero-width expressions before they can grow without bound', async () => {
    const root = await makeRepo()
    write(root, 'many.txt', 'abcdefghij\n')

    const result = await new FileSearch().search(root, options('(?=.)', { regex: true }), 3)

    expect(result.matches).toHaveLength(3)
    expect(result.limited).toBe(true)
  })

  it('keeps a match visible when a line is shortened for display', async () => {
    const root = await makeRepo()
    write(root, 'long.txt', `${'a'.repeat(400)}needle${'b'.repeat(400)}\n`)

    const result = await new FileSearch().search(root, options('needle'))
    const match = result.matches.find(one => one.path === 'long.txt')!

    expect(match.text.length).toBeLessThanOrEqual(240)
    expect(match.text.slice(match.start, match.end)).toBe('needle')
    expect(match.column).toBe(401)
    expect(match.text.startsWith('…')).toBe(true)
    expect(match.text.endsWith('…')).toBe(true)
  })

  it('forces a fresh read even when size and modified time did not change', async () => {
    const root = await makeRepo()
    const search = new FileSearch()
    const target = path.join(root, 'src/app.ts')
    const before = new Date(1700000000000)
    writeFileSync(target, 'export const value = "needle"\n')
    utimesSync(target, before, before)
    expect((await search.search(root, options('needle'))).matches.some(match => match.path === 'src/app.ts')).toBe(true)

    writeFileSync(target, 'export const value = "change"\n')
    utimesSync(target, before, before)
    expect((await search.search(root, options('change'))).matches.some(match => match.path === 'src/app.ts')).toBe(false)
    expect((await search.search(root, options('change', { refresh: true }))).matches.some(match => match.path === 'src/app.ts')).toBe(true)
  })

  it('replaces one exact result and expands regex captures', async () => {
    const root = await makeRepo()
    write(root, 'src/replace.ts', 'item-12 item-34\n')
    const search = new FileSearch()
    const request = {
      ...options('item-(\\d+)', { regex: true }),
      replacement: 'value-$1',
      preserveCase: false,
      target: { path: 'src/replace.ts', line: 1, column: 9, endColumn: 16 }
    }

    const result = await search.replace(root, request)

    expect(result).toEqual({ files: 1, replacements: 1, failed: [], error: null })
    expect(readFileSync(path.join(root, 'src/replace.ts'), 'utf8')).toBe('item-12 value-34\n')
  })

  it('replaces all filtered matches and preserves their case', async () => {
    const root = await makeRepo()
    write(root, 'src/replace.ts', 'NEEDLE Needle needle\n')
    write(root, 'tests/kept.ts', 'needle\n')
    const search = new FileSearch()

    const result = await search.replace(root, {
      ...options('needle', { include: 'src/**' }),
      replacement: 'thread',
      preserveCase: true
    })

    expect(result).toEqual({ files: 2, replacements: 4, failed: [], error: null })
    expect(readFileSync(path.join(root, 'src/replace.ts'), 'utf8')).toBe('THREAD Thread thread\n')
    expect(readFileSync(path.join(root, 'tests/kept.ts'), 'utf8')).toBe('needle\n')
  })

  it('does not read or replace invalid UTF-8 or a symlink outside the project', async () => {
    const root = await makeRepo()
    const outside = tmpDir('search-outside')
    write(root, 'invalid.txt', Buffer.from([0xc3, 0x28, 0x6e, 0x65, 0x65, 0x64, 0x6c, 0x65]))
    write(outside, 'private.txt', 'needle\n')
    symlinkSync(path.join(outside, 'private.txt'), path.join(root, 'outside.txt'))
    await runGit(['add', 'invalid.txt', 'outside.txt'], root)
    const search = new FileSearch()

    const found = await search.search(root, options('needle'))
    const replaced = await search.replace(root, {
      ...options('needle'),
      replacement: 'changed',
      preserveCase: false
    })

    expect(found.matches.map(match => match.path)).not.toContain('invalid.txt')
    expect(found.matches.map(match => match.path)).not.toContain('outside.txt')
    expect(replaced.files).toBe(2)
    expect(readFileSync(path.join(outside, 'private.txt'), 'utf8')).toBe('needle\n')
    expect(readFileSync(path.join(root, 'invalid.txt'))).toEqual(Buffer.from([0xc3, 0x28, 0x6e, 0x65, 0x65, 0x64, 0x6c, 0x65]))
  })
})
