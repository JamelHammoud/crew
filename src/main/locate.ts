import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PathLocation } from '../shared/files'
import { statRepoFile } from './files'

const HOME_PATH = /^(?:~|\/Users\/[^/]+|\/home\/[^/]+)(?:\/|$)/
const MIRROR_SEGMENTS = 8
const CASELESS = process.platform === 'darwin' || process.platform === 'win32'

function insideOf(root: string, absolute: string): string | null {
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

// Agents on other computers keep the project somewhere else, so the same file
// arrives with a different prefix. The tail of the path still matches.
async function mirroredInRepo(root: string, absolute: string): Promise<string | null> {
  const parts = absolute.split('/').filter(Boolean)
  for (let start = Math.max(0, parts.length - MIRROR_SEGMENTS); start <= parts.length - 2; start++) {
    const relative = parts.slice(start).join('/')
    if ((await statRepoFile(root, relative)) !== 'missing') return relative
  }
  return null
}

async function onThisMachine(absolute: string): Promise<boolean> {
  try {
    await fs.stat(absolute)
    return true
  } catch {
    return false
  }
}

async function repoLocation(root: string, relative: string): Promise<PathLocation> {
  return { kind: 'repo', path: relative || '.', exists: (await statRepoFile(root, relative)) !== 'missing' }
}

export async function locatePath(root: string | null, target: string): Promise<PathLocation> {
  const home = os.homedir()
  const raw = target.startsWith('~') ? path.join(home, target.slice(1)) : target
  const base = root ? path.resolve(root) : null
  if (!path.isAbsolute(raw)) {
    if (!base) return { kind: 'local' }
    const inside = insideOf(base, path.resolve(base, raw.replace(/^\.\//, '').replace(/\/+$/, '')))
    return inside === null ? { kind: 'local' } : repoLocation(base, inside)
  }
  const absolute = path.resolve(raw)
  if (base) {
    const inside = insideOf(base, absolute)
    if (inside !== null) return repoLocation(base, inside)
    const mirrored = await mirroredInRepo(base, absolute)
    if (mirrored) return { kind: 'repo', path: mirrored, exists: true }
  }
  if (!HOME_PATH.test(target)) return { kind: 'local' }
  if (insideOf(path.resolve(home), absolute) !== null) return { kind: 'local' }
  return (await onThisMachine(absolute)) ? { kind: 'local' } : { kind: 'private' }
}
