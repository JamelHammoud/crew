import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { FileEntry, RepoFile, RepoPathKind } from '../shared/files'

const MAX_BYTES = 512 * 1024

export function resolveRepoPath(root: string, target: string): string | null {
  const relative = target.replace(/^\.?\//, '').replace(/\/+$/, '')
  const absolute = path.resolve(root, relative)
  const inside = path.relative(root, absolute)
  if (inside.startsWith('..') || path.isAbsolute(inside)) return null
  return absolute
}

function repoRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/')
}

async function listDir(root: string, absolute: string): Promise<RepoFile> {
  const dirents = await fs.readdir(absolute, { withFileTypes: true })
  const entries: FileEntry[] = dirents
    .filter(d => d.name !== '.git')
    .map(d => ({ name: d.name, dir: d.isDirectory() }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
  return { kind: 'dir', path: repoRelative(root, absolute), entries }
}

async function readTextFile(root: string, absolute: string, size: number): Promise<RepoFile> {
  const relative = repoRelative(root, absolute)
  const handle = await fs.open(absolute, 'r')
  try {
    const buffer = Buffer.alloc(Math.min(size, MAX_BYTES))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    const slice = buffer.subarray(0, bytesRead)
    if (slice.subarray(0, 8000).includes(0)) return { kind: 'binary', path: relative, size }
    return { kind: 'file', path: relative, text: slice.toString('utf8'), truncated: size > MAX_BYTES }
  } finally {
    await handle.close()
  }
}

export async function writeRepoFile(root: string, target: string, text: string): Promise<RepoFile | null> {
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return null
  try {
    const stat = await fs.stat(absolute)
    if (!stat.isFile() || stat.size > MAX_BYTES) return null
    await fs.writeFile(absolute, text, 'utf8')
    return await readRepoFile(root, target)
  } catch {
    return null
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
  const relative = target.replace(/^\.?\//, '').replace(/\/+$/, '')
  const absolute = resolveRepoPath(root, target)
  if (!absolute) return { kind: 'missing', path: relative }
  try {
    const stat = await fs.stat(absolute)
    if (stat.isDirectory()) return listDir(root, absolute)
    if (!stat.isFile()) return { kind: 'missing', path: relative }
    return await readTextFile(root, absolute, stat.size)
  } catch {
    return { kind: 'missing', path: relative }
  }
}
