export interface FileEntry {
  name: string
  dir: boolean
}

export type RepoPathKind = 'file' | 'dir' | 'missing'

// Where a path an agent mentioned lives, from this machine's point of view.
// 'repo' paths are shown relative to the project, 'local' paths are elsewhere
// on this computer and are shown as written, and 'private' paths are on
// someone else's computer, where nobody here can follow them.
export type PathLocation =
  | { kind: 'repo'; path: string; exists: boolean }
  | { kind: 'local'; exists: boolean }
  | { kind: 'private' }

const slashed = (text: string): string => text.split('\\').join('/')

const rootPattern = (root: string): string =>
  slashed(root)
    .replace(/\/+$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .split('/')
    .join('[\\\\/]')

export function stripRoot(root: string, target: string): string {
  const base = slashed(root).replace(/\/+$/, '')
  const value = slashed(target)
  return value.startsWith(`${base}/`) ? value.slice(base.length + 1) : target
}

export function stripRootFromText(root: string, text: string): string {
  const pattern = new RegExp(`${rootPattern(root)}[\\\\/]([^\\s'"]*)`, 'g')
  return text.replace(pattern, (_, tail: string) => slashed(tail))
}

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

export function imageType(name: string): string | null {
  const file = slashed(name).split('/').pop() ?? ''
  const extension = /\.([a-z0-9]+)$/i.exec(file)?.[1]
  return extension ? (IMAGE_TYPES[extension.toLowerCase()] ?? null) : null
}

export function isImageUrl(url: string): boolean {
  return imageType(url.split(/[?#]/)[0] ?? '') !== null
}

export interface FileMatch {
  path: string
  hits: number[]
}

function scan(text: string, needle: string, from: number): number[] | null {
  const hits: number[] = []
  let at = from
  for (const letter of needle) {
    const found = text.indexOf(letter, at)
    if (found === -1) return null
    hits.push(found)
    at = found + 1
  }
  return hits
}

// What was typed is matched letter by letter, in order, against the whole path.
// A run that sits inside the file's own name wins over one that only lines up
// across the folders above it, and a tight run wins over a scattered one.
export function matchFiles(paths: string[], query: string, limit: number): FileMatch[] {
  const needle = query.toLowerCase().replace(/\s+/g, '')
  if (!needle) return []
  const found: { match: FileMatch; rank: number }[] = []
  for (const path of paths) {
    const lower = path.toLowerCase()
    const start = lower.lastIndexOf('/') + 1
    const inName = scan(lower, needle, start)
    const hits = inName ?? scan(lower, needle, 0)
    if (!hits) continue
    const spread = hits[hits.length - 1] - hits[0] - needle.length + 1
    const lead = hits[0] - (inName ? start : 0)
    found.push({ match: { path, hits }, rank: (inName ? 0 : 1000) + spread * 8 + lead + path.length / 1000 })
  }
  return found
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(entry => entry.match)
}

export function markRuns(text: string, hits: number[]): { text: string; hit: boolean }[] {
  const marked = new Set(hits)
  const runs: { text: string; hit: boolean }[] = []
  for (let index = 0; index < text.length; index++) {
    const hit = marked.has(index)
    const last = runs[runs.length - 1]
    if (last && last.hit === hit) last.text += text[index]
    else runs.push({ text: text[index], hit })
  }
  return runs
}

export type RepoFile =
  | { kind: 'file'; path: string; text: string; truncated: boolean }
  | { kind: 'dir'; path: string; entries: FileEntry[] }
  | { kind: 'image'; path: string; url: string; size: number }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'missing'; path: string }
