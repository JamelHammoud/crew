import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  copyPaths,
  readLocalFile,
  readRepoFile,
  repoPathOf,
  resolveRepoPath,
  statRepoFile,
  writeLocalFile,
  writeRepoFile
} from '../src/main/files'
import { locatePath } from '../src/main/locate'
import { Media } from '../src/main/media-file'
import { mediaType, stripRoot, stripRootFromText } from '../src/shared/files'
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

  it('returns an SVG as editable text', async () => {
    const root = makeRepo()
    const markup = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    writeFileSync(path.join(root, 'logo.svg'), markup)

    const result = await readRepoFile(root, 'logo.svg')

    expect(result).toEqual({ kind: 'file', path: 'logo.svg', text: markup, truncated: false })
  })

  it('keeps a complete preview for an SVG larger than the editor limit', async () => {
    const root = makeRepo()
    const markup = `<svg viewBox="0 0 10 10">${' '.repeat(600 * 1024)}<circle cx="5" cy="5" r="4"/></svg>`
    writeFileSync(path.join(root, 'large.svg'), markup)

    const result = await readRepoFile(root, 'large.svg')

    expect(result.kind).toBe('file')
    if (result.kind !== 'file') return
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(512 * 1024)
    expect(Buffer.from(result.preview!.split(',')[1]!, 'base64').toString('utf8')).toBe(markup)
  })

  it('marks other binary files instead of returning garbage', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'app.bin'), Buffer.from([0x00, 0x01, 0x02]))
    const result = await readRepoFile(root, 'app.bin')
    expect(result).toEqual({ kind: 'binary', path: 'app.bin', size: 3 })
  })

  it('hands back a track to play rather than reading it as text', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'theme.mp3'), Buffer.from([0x49, 0x44, 0x33, 0x00]))
    const media = new Media()

    const result = await readRepoFile(root, 'theme.mp3', media)

    expect(result).toEqual({
      kind: 'media',
      path: 'theme.mp3',
      url: media.url(path.join(root, 'theme.mp3')),
      size: 4,
      type: 'audio/mpeg',
      video: false
    })
  })

  it('says a film is a film', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'demo.mp4'), Buffer.from([0x00, 0x00, 0x00, 0x18]))

    const result = await readRepoFile(root, 'demo.mp4', new Media())

    expect(result.kind).toBe('media')
    if (result.kind !== 'media') return
    expect(result.type).toBe('video/mp4')
    expect(result.video).toBe(true)
  })

  it('reads a track as it always did where there is nowhere to play it from', async () => {
    const root = makeRepo()
    writeFileSync(path.join(root, 'theme.mp3'), Buffer.from([0x49, 0x44, 0x33, 0x00]))

    expect(await readRepoFile(root, 'theme.mp3')).toEqual({ kind: 'binary', path: 'theme.mp3', size: 4 })
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

describe('mediaType', () => {
  it('names what this machine can really play', () => {
    expect(mediaType('theme.mp3')).toEqual({ type: 'audio/mpeg', video: false })
    expect(mediaType('src/clips/demo.mp4')).toEqual({ type: 'video/mp4', video: true })
  })

  it('reads an extension however it was written', () => {
    expect(mediaType('THEME.MP3')).toEqual({ type: 'audio/mpeg', video: false })
    expect(mediaType('Demo.Mp4')).toEqual({ type: 'video/mp4', video: true })
  })

  it('says nothing about a file there is no player for', () => {
    expect(mediaType('notes.txt')).toBeNull()
    expect(mediaType('archive.zip')).toBeNull()
    expect(mediaType('Makefile')).toBeNull()
    expect(mediaType('')).toBeNull()
  })
})

describe('repoPathOf', () => {
  it('tells a path in the project from one that only starts like it', () => {
    const root = makeRepo()
    expect(repoPathOf(root, 'src/app/main.ts')).toBe('src/app/main.ts')
    expect(repoPathOf(root, './readme.md')).toBe('readme.md')
    expect(repoPathOf(root, path.join(root, 'src/app/main.ts'))).toBe('src/app/main.ts')
    expect(repoPathOf(root, '/tmp/preview.mjs')).toBeNull()
    expect(repoPathOf(root, '~/preview.mjs')).toBeNull()
  })
})

describe('copyPaths', () => {
  it('returns absolute and project-relative paths for a project file', () => {
    const root = makeRepo()
    expect(copyPaths(root, 'src/app/main.ts')).toEqual({
      absolute: path.join(root, 'src', 'app', 'main.ts'),
      relative: 'src/app/main.ts'
    })
  })

  it('returns a relative path from the project for an outside file', () => {
    const root = makeRepo()
    const outside = path.join(path.dirname(root), 'elsewhere', 'notes.md')
    expect(copyPaths(root, outside)).toEqual({
      absolute: outside,
      relative: '../elsewhere/notes.md'
    })
  })
})

describe('readLocalFile', () => {
  it('reads a file from this computer that is nowhere near the project', async () => {
    const outside = tmpDir('outside')
    writeFileSync(path.join(outside, 'preview.mjs'), 'export const x = 1\n')
    const result = await readLocalFile(path.join(outside, 'preview.mjs'))
    expect(result).toEqual({
      kind: 'file',
      path: path.join(outside, 'preview.mjs'),
      text: 'export const x = 1\n',
      truncated: false
    })
  })

  it('shows a picture taken outside the project', async () => {
    const outside = tmpDir('outside')
    writeFileSync(path.join(outside, 'shot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const result = await readLocalFile(path.join(outside, 'shot.png'))
    expect(result.kind).toBe('image')
    if (result.kind !== 'image') return
    expect(result.url.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('lists a folder outside the project and keeps the full path', async () => {
    const outside = tmpDir('outside')
    mkdirSync(path.join(outside, 'logs'))
    writeFileSync(path.join(outside, 'logs', 'run.log'), 'started\n')
    const result = await readLocalFile(path.join(outside, 'logs') + '/')
    expect(result).toEqual({
      kind: 'dir',
      path: path.join(outside, 'logs'),
      entries: [{ name: 'run.log', dir: false }]
    })
  })

  it('reports a path that is not on this computer', async () => {
    const result = await readLocalFile('/nowhere/at/all.txt')
    expect(result).toEqual({ kind: 'missing', path: '/nowhere/at/all.txt' })
  })

  it('writes back a file it read from outside the project', async () => {
    const outside = tmpDir('outside')
    const file = path.join(outside, 'preview.mjs')
    writeFileSync(file, 'old\n')
    const result = await writeLocalFile(file, 'new\n')
    expect(result).toEqual({ kind: 'file', path: file, text: 'new\n', truncated: false })
    expect(readFileSync(file, 'utf8')).toBe('new\n')
    expect(await writeLocalFile(path.join(outside, 'brand-new.txt'), 'x')).toBeNull()
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
      exists: true,
      dir: false
    })
    expect(await locatePath(root, 'src/app/main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true,
      dir: false
    })
    expect(await locatePath(root, path.join(root, 'src/gone.ts'))).toEqual({
      kind: 'repo',
      path: 'src/gone.ts',
      exists: false,
      dir: false
    })
    expect(await locatePath(root, 'Undo/redo')).toEqual({
      kind: 'repo',
      path: 'Undo/redo',
      exists: false,
      dir: false
    })
  })

  it('matches the same file kept elsewhere on another computer', async () => {
    const root = makeRepo()
    expect(await locatePath(root, '/Users/someone/code/crew/src/app/main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true,
      dir: false
    })
  })

  it('keeps back home paths that belong to someone else', async () => {
    const root = makeRepo()
    expect(await locatePath(root, '/Users/someone/Desktop/notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(root, '/home/someone/notes.md')).toEqual({ kind: 'private' })
    expect(await locatePath(null, '/Users/someone/notes.md')).toEqual({ kind: 'private' })
  })

  it('opens paths that are on this computer', async () => {
    const root = makeRepo()
    const outside = tmpDir('outside')
    writeFileSync(path.join(outside, 'preview.mjs'), 'export const x = 1\n')
    expect(await locatePath(root, os.homedir())).toEqual({ kind: 'local', exists: true, dir: true })
    expect(await locatePath(root, '~/')).toEqual({ kind: 'local', exists: true, dir: true })
    expect(await locatePath(root, '/usr/bin')).toEqual({ kind: 'local', exists: true, dir: true })
    expect(await locatePath(root, path.join(outside, 'preview.mjs'))).toEqual({
      kind: 'local',
      exists: true,
      dir: false
    })
    expect(await locatePath(null, path.join(outside, 'preview.mjs'))).toEqual({
      kind: 'local',
      exists: true,
      dir: false
    })
  })

  it('shows a full path that is nobody’s own file as it was written', async () => {
    const root = makeRepo()
    expect(await locatePath(root, '/tmp/somebody-elses/preview.mjs')).toEqual({
      kind: 'local',
      exists: false,
      dir: false
    })
    expect(await locatePath(root, 'D:\\shared\\build.log')).toEqual({ kind: 'local', exists: false, dir: false })
  })

  it('matches a windows path onto the same file here', async () => {
    const root = makeRepo()
    expect(await locatePath(root, 'C:\\Users\\Ali Hammoud\\crew\\src\\app\\main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true,
      dir: false
    })
    expect(await locatePath(root, 'src\\app\\main.ts')).toEqual({
      kind: 'repo',
      path: 'src/app/main.ts',
      exists: true,
      dir: false
    })
  })

  it('keeps back windows paths that belong to someone else', async () => {
    const root = makeRepo()
    expect(await locatePath(root, 'C:\\Users\\Ali Hammoud\\Desktop\\notes.md')).toEqual({ kind: 'private' })
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
