import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PathLocation } from '../shared/files'
import { insideRoot, statRepoFile } from './files'

const WINDOWS_PATH = /^(?:[A-Za-z]:[\\/]|\\\\)/
const MIRROR_SEGMENTS = 8
const ON_WINDOWS = process.platform === 'win32'

const slashed = (text: string): string => text.split('\\').join('/')

// Agents on other computers keep the project somewhere else, so the same file
// arrives with a different prefix. The tail of the path still matches.
async function mirroredInRepo(root: string, absolute: string): Promise<string | null> {
  const parts = slashed(absolute).split('/').filter(Boolean)
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

// A path written for a different operating system can never resolve here, so
// the only hope of showing it is finding the same file inside the project.
function fromAnotherSystem(target: string): boolean {
  if (WINDOWS_PATH.test(target)) return !ON_WINDOWS
  return ON_WINDOWS && target.startsWith('/')
}

async function elsewhere(base: string | null, target: string): Promise<PathLocation> {
  if (base) {
    const mirrored = await mirroredInRepo(base, target)
    if (mirrored) return { kind: 'repo', path: mirrored, exists: true }
  }
  return { kind: 'private' }
}

// Outside the project, a full path is only worth showing if the file is really
// here. Anything else was written on someone else's computer, where following
// it would land on nothing.
export async function locatePath(root: string | null, target: string): Promise<PathLocation> {
  const home = os.homedir()
  const base = root ? path.resolve(root) : null
  if (fromAnotherSystem(target)) return elsewhere(base, target)
  const raw = target.startsWith('~') ? path.join(home, target.slice(1)) : slashed(target)
  if (!path.isAbsolute(raw)) {
    if (!base) return { kind: 'local', exists: false }
    const inside = insideRoot(base, path.resolve(base, raw.replace(/^\.\//, '').replace(/\/+$/, '')))
    return inside === null ? { kind: 'local', exists: false } : repoLocation(base, inside)
  }
  const absolute = path.resolve(raw)
  if (base) {
    const inside = insideRoot(base, absolute)
    if (inside !== null) return repoLocation(base, inside)
    const mirrored = await mirroredInRepo(base, absolute)
    if (mirrored) return { kind: 'repo', path: mirrored, exists: true }
  }
  return (await onThisMachine(absolute)) ? { kind: 'local', exists: true } : { kind: 'private' }
}
