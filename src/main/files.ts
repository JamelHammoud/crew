import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  imageType,
  mediaType,
  type FileCopyPaths,
  type FileEntry,
  type RepoFile,
  type RepoEntryCreateResult,
  type RepoEntryImportResult,
  type RepoEntryKind,
  type RepoEntryMoveResult,
  type RepoEntryTransferMode,
  type RepoEntryTransferResult,
  type RepoPathKind
} from '../shared/files'
import type { MachineDir } from '../shared/machinePath'

export { listRepoFiles } from '../shared/repoFiles'

export interface MediaHost {
  url(absolute: string): string
}

const MAX_BYTES = 512 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const DIR_LIMIT = 4000
const CASELESS = process.platform === 'darwin' || process.platform === 'win32'

export function expandHome(target: string): string {
  if (!target.startsWith('~')) return target
  return path.join(os.homedir(), target.slice(1))
}

export function insideRoot(root: string, absolute: string): string | null {
  const from = CASELESS ? root.toLowerCase() : root
  const to = CASELESS ? absolute.toLowerCase() : absolute
  const relative = path.relative(from, to)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return absolute
    .slice(root.length)
    .replace(/^[/\\]+/, '')
    .split(path.sep)
    .join('/')
}

export function resolveRepoPath(root: string, target: string): string | null {
  const relative = target.replace(/^\.?\//, '').replace(/\/+$/, '')
  const absolute = path.resolve(root, relative)
  const inside = path.relative(root, absolute)
  if (inside.startsWith('..') || path.isAbsolute(inside)) return null
  return absolute
}

// A path an agent wrote is followed where it points: inside the project it is
// read relative to the project, anywhere else it is read off this machine.
export function repoPathOf(root: string, target: string): string | null {
  const expanded = expandHome(target)
  if (path.isAbsolute(expanded)) return insideRoot(path.resolve(root), path.resolve(expanded))
  return resolveRepoPath(root, expanded) === null ? null : trimPath(expanded)
}

export function absolutePathOf(root: string | null, target: string): string | null {
  const expanded = expandHome(target)
  if (path.isAbsolute(expanded)) return path.resolve(expanded)
  return root ? resolveRepoPath(root, expanded) : null
}

export async function isThere(absolute: string): Promise<boolean> {
  try {
    await fs.lstat(absolute)
    return true
  } catch {
    return false
  }
}

export function copyPaths(root: string | null, target: string): FileCopyPaths {
  const absolute = absolutePathOf(root, target)
  if (!absolute) return { absolute: target, relative: target }
  const relative = root ? path.relative(path.resolve(root), absolute).split(path.sep).join('/') || '.' : target
  return { absolute, relative }
}

function repoRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/')
}

const trimPath = (target: string): string => target.replace(/^\.?\//, '').replace(/\/+$/, '')

async function listDir(label: string, absolute: string): Promise<RepoFile> {
  const dirents = await fs.readdir(absolute, { withFileTypes: true })
  const entries: FileEntry[] = dirents
    .filter(d => d.name !== '.git')
    .map(d => ({ name: d.name, dir: d.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return { kind: 'dir', path: label, entries }
}

async function readImage(label: string, absolute: string, size: number, type: string): Promise<RepoFile> {
  if (size > MAX_IMAGE_BYTES) return { kind: 'binary', path: label, size }
  const bytes = await fs.readFile(absolute)
  return { kind: 'image', path: label, url: `data:${type};base64,${bytes.toString('base64')}`, size }
}

async function readTextFile(label: string, absolute: string, size: number): Promise<RepoFile> {
  const handle = await fs.open(absolute, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(size, MAX_BYTES))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const slice = buffer.subarray(0, bytesRead)
    if (slice.subarray(0, 8000).includes(0)) return { kind: 'binary', path: label, size }
    return { kind: 'file', path: label, text: slice.toString('utf8'), truncated: size > MAX_BYTES }
  } finally {
    await handle.close()
  }
}

async function readSvg(label: string, absolute: string, size: number): Promise<RepoFile> {
  if (size <= MAX_BYTES) return readTextFile(label, absolute, size)
  if (size > MAX_IMAGE_BYTES) return { kind: 'binary', path: label, size }
  const bytes = await fs.readFile(absolute)
  const text = bytes.subarray(0, MAX_BYTES)
  if (text.subarray(0, 8000).includes(0)) return { kind: 'binary', path: label, size }
  return {
    kind: 'file',
    path: label,
    text: text.toString('utf8'),
    truncated: true,
    preview: `data:image/svg+xml;base64,${bytes.toString('base64')}`
  }
}

async function readAt(label: string, absolute: string, media?: MediaHost): Promise<RepoFile> {
  const stat = await fs.stat(absolute)
  if (stat.isDirectory()) return listDir(label, absolute)
  if (!stat.isFile()) return { kind: 'missing', path: label }
  const type = imageType(absolute)
  if (type === 'image/svg+xml') return readSvg(label, absolute, stat.size)
  if (type) return readImage(label, absolute, stat.size, type)
  if (media) {
    const playable = mediaType(absolute)
    if (playable)
      return {
        kind: 'media',
        path: label,
        url: media.url(absolute),
        size: stat.size,
        type: playable.type,
        video: playable.video
      }
  }
  return readTextFile(label, absolute, stat.size)
}

async function writeAt(absolute: string, text: string): Promise<boolean> {
  try {
    const stat = await fs.stat(absolute)
    if (!stat.isFile() || stat.size > MAX_BYTES) return false
    await fs.writeFile(absolute, text, 'utf8')
    return true
  } catch {
    return false
  }
}

async function dirEntries(absolute: string): Promise<FileEntry[] | null> {
  const dirents = await fs.readdir(absolute, { withFileTypes: true }).catch(() => null)
  if (!dirents) return null
  const entries = await Promise.all(
    dirents.slice(0, DIR_LIMIT).map(async dirent => ({
      name: dirent.name,
      dir: dirent.isSymbolicLink()
        ? await fs
            .stat(path.join(absolute, dirent.name))
            .then(stat => stat.isDirectory())
            .catch(() => false)
        : dirent.isDirectory()
    }))
  )
  return entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
}

export async function readMachineDirs(root: string | null, query: string): Promise<MachineDir[]> {
  const base = root ? path.resolve(root) : null
  const tries = query.startsWith('~')
    ? [expandHome(query)]
    : [query, path.join(os.homedir(), query.replace(/^\/+/, ''))]
  const dirs: MachineDir[] = []
  const seen = new Set<string>()
  for (const candidate of tries) {
    const absolute = path.resolve(candidate)
    if (seen.has(absolute)) continue
    seen.add(absolute)
    const entries = await dirEntries(absolute)
    if (entries) dirs.push({ dir: absolute, repoDir: base ? insideRoot(base, absolute) : null, entries })
  }
  return dirs
}

export async function statRepoFile(root: string, target: string): Promise<RepoPathKind> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return 'missing'
  try {
    const stat = await fs.stat(absolute)
    if (stat.isDirectory()) return 'dir'
    return stat.isFile() ? 'file' : 'missing'
  } catch {
    return 'missing'
  }
}

export async function readRepoFile(root: string, target: string, media?: MediaHost): Promise<RepoFile> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return { kind: 'missing', path: trimPath(target) }
  try {
    return await readAt(repoRelative(root, absolute), absolute, media)
  } catch {
    return { kind: 'missing', path: trimPath(target) }
  }
}

// Somewhere else on this computer: a screenshot in /tmp, a log in a home
// folder. It keeps the path it was written with, since there is nothing to
// shorten it against.
export async function readLocalFile(target: string, media?: MediaHost): Promise<RepoFile> {
  const absolute = expandHome(target)
  if (!path.isAbsolute(absolute)) return { kind: 'missing', path: target }
  const label = target.replace(/\/+$/, '') || '/'
  try {
    return await readAt(label, path.resolve(absolute), media)
  } catch {
    return { kind: 'missing', path: label }
  }
}

export async function writeRepoFile(root: string, target: string, text: string): Promise<RepoFile | null> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return null
  return (await writeAt(absolute, text)) ? readRepoFile(root, target) : null
}

export async function createRepoEntry(
  root: string,
  target: string,
  kind: RepoEntryKind
): Promise<RepoEntryCreateResult> {
  const relative = trimPath(target)
  const absolute = resolveRepoPath(root, relative)
  if (!relative || !absolute || (kind !== 'file' && kind !== 'folder')) {
    return { ok: false, message: 'Choose a name inside this project' }
  }
  try {
    const realRoot = await fs.realpath(root)
    const realParent = await fs.realpath(path.dirname(absolute))
    if (insideRoot(realRoot, realParent) === null) return { ok: false, message: 'Choose a name inside this project' }
    const destination = path.join(realParent, path.basename(absolute))
    if (kind === 'folder') await fs.mkdir(destination)
    else {
      const handle = await fs.open(destination, 'wx')
      await handle.close()
    }
    return { ok: true, path: relative }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EEXIST') return { ok: false, message: 'That name is already in use' }
    if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, message: 'That folder is no longer there' }
    return { ok: false, message: `Could not create that ${kind}` }
  }
}

export async function moveRepoEntry(root: string, source: string, parent: string): Promise<RepoEntryMoveResult> {
  const sourceRelative = trimPath(source)
  const parentRelative = trimPath(parent)
  const sourceAbsolute = resolveRepoPath(root, sourceRelative)
  const parentAbsolute = resolveRepoPath(root, parentRelative)
  if (!sourceRelative || !sourceAbsolute || !parentAbsolute) {
    return { ok: false, message: 'Choose a place inside this project' }
  }
  try {
    const realRoot = await fs.realpath(root)
    const realSourceParent = await fs.realpath(path.dirname(sourceAbsolute))
    const realParent = await fs.realpath(parentAbsolute)
    if (insideRoot(realRoot, realSourceParent) === null || insideRoot(realRoot, realParent) === null) {
      return { ok: false, message: 'Choose a place inside this project' }
    }
    const parentStat = await fs.stat(realParent)
    if (!parentStat.isDirectory()) return { ok: false, message: 'Drop it onto a folder' }
    const from = path.join(realSourceParent, path.basename(sourceAbsolute))
    const sourceStat = await fs.lstat(from)
    if (sourceStat.isDirectory()) {
      const realSource = await fs.realpath(from)
      if (insideRoot(realSource, realParent) !== null) {
        return { ok: false, message: 'A folder cannot contain itself' }
      }
    }
    const destination = path.join(realParent, path.basename(from))
    const same = CASELESS ? from.toLowerCase() === destination.toLowerCase() : from === destination
    if (same) return { ok: false, message: 'That item is already there' }
    const occupied = await fs
      .lstat(destination)
      .then(() => true)
      .catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
        throw error
      })
    if (occupied) return { ok: false, message: 'That name is already in use there' }
    await fs.rename(from, destination)
    return { ok: true, path: repoRelative(realRoot, destination) }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EEXIST' || code === 'ENOTEMPTY') return { ok: false, message: 'That name is already in use there' }
    if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, message: 'That item is no longer there' }
    if (code === 'EINVAL') return { ok: false, message: 'A folder cannot contain itself' }
    return { ok: false, message: 'Could not move that item' }
  }
}

export async function importRepoEntries(
  root: string,
  sources: string[],
  parent: string
): Promise<RepoEntryImportResult> {
  const parentAbsolute = resolveRepoPath(root, trimPath(parent))
  if (!parentAbsolute || sources.length === 0) return { ok: false, message: 'Choose a folder in this project' }
  let stage = ''
  try {
    const realRoot = await fs.realpath(root)
    const realParent = await fs.realpath(parentAbsolute)
    if (insideRoot(realRoot, realParent) === null || !(await fs.stat(realParent)).isDirectory()) {
      return { ok: false, message: 'Choose a folder in this project' }
    }

    const entries: Array<{ source: string; name: string; destination: string; dir: boolean }> = []
    const destinations = new Set<string>()
    for (const source of sources) {
      if (!path.isAbsolute(source)) return { ok: false, message: 'That item is no longer there' }
      const absolute = path.resolve(source)
      const name = path.basename(absolute)
      if (!name) return { ok: false, message: 'That item cannot be copied here' }
      const destination = path.join(realParent, name)
      const key = CASELESS ? destination.toLowerCase() : destination
      if (destinations.has(key) || (await isThere(destination))) {
        return { ok: false, message: 'That name is already in use there' }
      }
      const stat = await fs.lstat(absolute)
      if (stat.isDirectory()) {
        const realSource = await fs.realpath(absolute)
        if (insideRoot(realSource, destination) !== null) {
          return { ok: false, message: 'A folder cannot be copied into itself' }
        }
      }
      destinations.add(key)
      entries.push({ source: absolute, name, destination, dir: stat.isDirectory() })
    }

    stage = await fs.mkdtemp(path.join(realParent, '.crew-import-'))
    for (const entry of entries) {
      await fs.cp(entry.source, path.join(stage, entry.name), {
        recursive: entry.dir,
        errorOnExist: true,
        force: false,
        preserveTimestamps: true,
        verbatimSymlinks: true
      })
    }
    for (const entry of entries) {
      if (await isThere(entry.destination)) throw Object.assign(new Error('destination exists'), { code: 'EEXIST' })
    }
    const committed: typeof entries = []
    try {
      for (const entry of entries) {
        await fs.rename(path.join(stage, entry.name), entry.destination)
        committed.push(entry)
      }
    } catch (error) {
      for (const entry of committed.reverse()) {
        await fs.rename(entry.destination, path.join(stage, entry.name)).catch(() => undefined)
      }
      throw error
    }
    await fs.rm(stage, { recursive: true, force: true })
    stage = ''
    return { ok: true, paths: entries.map(entry => repoRelative(realRoot, entry.destination)) }
  } catch (error) {
    if (stage) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'EEXIST' || code === 'ENOTEMPTY') return { ok: false, message: 'That name is already in use there' }
    if (code === 'ENOENT' || code === 'ENOTDIR') return { ok: false, message: 'That item is no longer there' }
    if (code === 'EACCES' || code === 'EPERM') return { ok: false, message: 'That item could not be copied' }
    return { ok: false, message: 'Could not copy that item' }
  }
}

export async function writeLocalFile(target: string, text: string): Promise<RepoFile | null> {
  const absolute = expandHome(target)
  if (!path.isAbsolute(absolute)) return null
  return (await writeAt(path.resolve(absolute), text)) ? readLocalFile(target) : null
}
