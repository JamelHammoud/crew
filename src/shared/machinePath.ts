import { matchFiles, type FileEntry } from './files'
import { pathCandidates, type PathIndex, type PathMatch } from './pathMention'

export interface MachineDir {
  dir: string
  repoDir: string | null
  entries: FileEntry[]
}

const HOME = /^~(?=\/)/

export function machineRun(query: string): boolean {
  return query.startsWith('/') || HOME.test(query)
}

export function machineDirQuery(query: string): string | null {
  if (!machineRun(query)) return null
  const at = query.lastIndexOf('/')
  if (at === -1) return null
  return at === 0 ? '/' : query.slice(0, at)
}

export function machineToken(dir: MachineDir, name: string): string {
  if (dir.repoDir === null) return dir.dir === '/' ? `/${name}` : `${dir.dir}/${name}`
  return dir.repoDir ? `${dir.repoDir}/${name}` : name
}

function asMatch(dir: MachineDir, entry: FileEntry, nameHits: number[]): PathMatch {
  const path = machineToken(dir, entry.name)
  const start = path.length - entry.name.length
  return { path, hits: nameHits.map(hit => hit + start), dir: entry.dir, head: true }
}

function inDir(dir: MachineDir, tail: string, limit: number): PathMatch[] {
  const shown = tail.startsWith('.') ? dir.entries : dir.entries.filter(entry => !entry.name.startsWith('.'))
  if (!tail) return shown.slice(0, limit).map(entry => asMatch(dir, entry, []))
  const lower = tail.toLowerCase()
  const hits = [...tail].map((_, at) => at)
  const heads: PathMatch[] = []
  const left: FileEntry[] = []
  for (const entry of shown) {
    if (entry.name.toLowerCase().startsWith(lower)) heads.push(asMatch(dir, entry, hits))
    else left.push(entry)
  }
  if (heads.length >= limit) return heads.slice(0, limit)
  const rest = matchFiles(
    left.map(entry => entry.name),
    tail,
    limit - heads.length
  ).map(match => {
    const entry = left.find(one => one.name === match.path) as FileEntry
    return { ...asMatch(dir, entry, match.hits), head: false }
  })
  return [...heads, ...rest]
}

export function machineCandidates(dirs: readonly MachineDir[], query: string, limit: number): PathMatch[] {
  const at = query.lastIndexOf('/')
  if (!machineRun(query) || at === -1) return []
  const tail = query.slice(at + 1)
  return dirs.flatMap(dir => inDir(dir, tail, limit))
}

export function revealedBy(dirs: readonly MachineDir[]): string[] {
  return dirs.flatMap(dir => [dir.dir, ...dir.entries.map(entry => machineToken({ ...dir, repoDir: null }, entry.name))])
}
