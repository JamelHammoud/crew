import { slashCandidates, type SlashCommand } from './commands'
import { matchFiles } from './files'

export interface PathIndex {
  paths: string[]
  dirs: Set<string>
  all: Set<string>
}

export interface PathRun {
  text: string
  path: boolean
}

export interface PathMatch {
  path: string
  hits: number[]
  dir: boolean
}

const RUN = /(?:^|\s)(\S*)$/
const LEADING_SLASH = /^\/+/

// A path is what has a slash in it. A bare word is a word, and a menu that
// opened on one would open on every word anybody types.
export function pathQuery(value: string, caret: number, offered: readonly SlashCommand[] = []): string | null {
  if (slashCandidates(value, offered).length > 0) return null
  const run = RUN.exec(value.slice(0, caret))?.[1] ?? ''
  if (!run.includes('/') || run.includes('//')) return null
  if (run.startsWith('#') || run.startsWith('~') || run.includes('@')) return null
  return run.replace(LEADING_SLASH, '') ? run : null
}

export function pathIndex(files: readonly string[]): PathIndex {
  const dirs = new Set<string>()
  for (const file of files) {
    for (let at = file.indexOf('/'); at !== -1; at = file.indexOf('/', at + 1)) dirs.add(file.slice(0, at))
  }
  return { paths: [...dirs, ...files], dirs }
}

const depthAfter = (path: string, from: number): number => {
  let count = 0
  for (let at = path.indexOf('/', from); at !== -1; at = path.indexOf('/', at + 1)) count += 1
  return count
}

// What somebody has typed so far, taken as the head of a path, comes first and
// in the order a folder holds it: the folder itself, then what is directly
// inside it, then what is further down. That is what makes a trailing slash
// read as opening the folder rather than as a search that happens to match it.
// Everything else is the same letter by letter match the Files filter runs.
export function pathCandidates(index: PathIndex, query: string, limit: number): PathMatch[] {
  const needle = query.replace(LEADING_SLASH, '')
  if (!needle) return []
  const lower = needle.toLowerCase()
  const hits = [...needle].map((_, at) => at)
  const under: PathMatch[] = []
  const taken = new Set<string>()
  for (const path of index.paths) {
    if (!path.toLowerCase().startsWith(lower)) continue
    taken.add(path)
    under.push({ path, hits, dir: index.dirs.has(path) })
  }
  under.sort(
    (a, b) =>
      depthAfter(a.path, needle.length) - depthAfter(b.path, needle.length) ||
      Number(b.dir) - Number(a.dir) ||
      a.path.localeCompare(b.path)
  )
  if (under.length >= limit) return under.slice(0, limit)
  const rest = matchFiles(index.paths, needle, limit + taken.size)
    .filter(match => !taken.has(match.path))
    .map(match => ({ path: match.path, hits: match.hits, dir: index.dirs.has(match.path) }))
  return [...under, ...rest].slice(0, limit)
}

// A folder takes the slash with it, so the menu stays open on what is inside it
// and the next press picks one. A file is the end of it.
export function pathToken(match: PathMatch): string {
  return match.dir ? `${match.path}/` : match.path
}
