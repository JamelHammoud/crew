import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { FileEntry, RepoFile, RepoPathKind } from '../shared/files'

const MAX_BYTES = 512 * 1024
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const CASELESS = process.platform === 'darwin' || process.platform === 'win32'

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml'
}

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

// A path an agent wrote is followed only where it points: inside the project it
// is read relative to the project, anywhere else it is read from this machine.
export function resolveAnyPath(root: string | null, target: string): string | null {
  const expanded = expandHome(target)
  if (path.isAbsolute(expanded)) {
    if (!root) return path.resolve(expanded)
    const absolute = path.resolve(expanded)
    return insideRoot(path.resolve(root), absolute) === null ? absolute : absolute
  }
  return root ? resolveRepoPath(root, expanded) : null
}

function repoRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/')
}

const trimPath = (target: string): string => target.replace(/^\.?\//, '').replace(/\/+$/, '')

const imageType = (absolute: string): string | null =>
  IMAGE_TYPES[path.extname(absolute).slice(1).toLowerCase()] ?? null

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

async function readAt(label: string, absolute: string): Promise<RepoFile> {
  const stat = await fs.stat(absolute)
  if (stat.isDirectory()) return listDir(label, absolute)
  if (!stat.isFile()) return { kind: 'missing', path: label }
  const type = imageType(absolute)
  if (type) return readImage(label, absolute, stat.size, type)
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

export async function readRepoFile(root: string, target: string): Promise<RepoFile> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return { kind: 'missing', path: trimPath(target) }
  try {
    return await readAt(repoRelative(root, absolute), absolute)
  } catch {
    return { kind: 'missing', path: trimPath(target) }
  }
}

// Somewhere else on this computer: a screenshot in /tmp, a log in a home
// folder. It keeps the path it was written with, since there is nothing to
// shorten it against.
export async function readLocalFile(target: string): Promise<RepoFile> {
  const absolute = expandHome(target)
  if (!path.isAbsolute(absolute)) return { kind: 'missing', path: target }
  try {
    return await readAt(target.replace(/\/+$/, '') || target, path.resolve(absolute))
  } catch {
    return { kind: 'missing', path: target }
  }
}

export async function writeRepoFile(root: string, target: string, text: string): Promise<RepoFile | null> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return null
  return (await writeAt(absolute, text)) ? readRepoFile(root, target) : null
}

export async function writeLocalFile(target: string, text: string): Promise<RepoFile | null> {
  const absolute = expandHome(target)
  if (!path.isAbsolute(absolute)) return null
  return (await writeAt(path.resolve(absolute), text)) ? readLocalFile(target) : null
}
