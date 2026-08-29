export interface FileEntry {
  name: string
  dir: boolean
}

export interface FileCopyPaths {
  absolute: string
  relative: string
}

export type RepoPathKind = 'file' | 'dir' | 'missing'

export type RepoEntryKind = 'file' | 'folder'

export type RepoEntryCreateResult = { ok: true; path: string } | { ok: false; message: string }

export type RepoEntryMoveResult = { ok: true; path: string } | { ok: false; message: string }

export type RepoEntryImportResult = { ok: true; paths: string[] } | { ok: false; message: string }

export type RepoEntryTransferMode = 'copy' | 'move'

export type RepoEntryTransferResult =
  | { ok: true; entries: Array<{ source: string; path: string }> }
  | { ok: false; message: string }

// Where a path an agent mentioned lives, from this machine's point of view.
// 'repo' paths are shown relative to the project, 'local' paths are elsewhere
// on this computer and are shown as written, and 'private' paths are on
// someone else's computer, where nobody here can follow them.
export type PathLocation =
  | { kind: 'repo'; path: string; exists: boolean; dir: boolean }
  | { kind: 'local'; exists: boolean; dir: boolean }
  | { kind: 'private' }

const slashed = (text: string): string => text.split('\\').join('/')

const HOME_ROOT = /^(?:[A-Za-z]:)?\/(?:Users|home)\/[^/]+\//i
const NAMED_FILE = /\/[^/]*\.[A-Za-z0-9]{1,8}$/

export function personalPath(target: string): boolean {
  const value = slashed(target)
  return HOME_ROOT.test(value) && NAMED_FILE.test(value)
}

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

const MARKDOWN_TYPES = new Set(['md', 'markdown', 'mdown', 'mkd'])
const HTML_TYPES = new Set(['html', 'htm', 'xhtml'])
const SVG_TYPES = new Set(['svg'])

function extensionOf(name: string): string | null {
  const file = slashed(name).split('/').pop() ?? ''
  return /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? null
}

export interface Playable {
  type: string
  video: boolean
}

// What this machine can really play, rather than every container there is. A
// format the browser would refuse falls through to the file having no preview,
// which is the honest answer: a player standing there doing nothing is worse
// than a line saying there is nothing to show.
const MEDIA_TYPES: Record<string, Playable> = {
  mp3: { type: 'audio/mpeg', video: false },
  m4a: { type: 'audio/mp4', video: false },
  aac: { type: 'audio/aac', video: false },
  wav: { type: 'audio/wav', video: false },
  flac: { type: 'audio/flac', video: false },
  oga: { type: 'audio/ogg', video: false },
  ogg: { type: 'audio/ogg', video: false },
  opus: { type: 'audio/ogg', video: false },
  weba: { type: 'audio/webm', video: false },
  mp4: { type: 'video/mp4', video: true },
  m4v: { type: 'video/mp4', video: true },
  mov: { type: 'video/quicktime', video: true },
  webm: { type: 'video/webm', video: true },
  ogv: { type: 'video/ogg', video: true }
}

export function mediaType(name: string): Playable | null {
  const extension = extensionOf(name)
  return extension ? (MEDIA_TYPES[extension] ?? null) : null
}

export function isMarkdown(name: string): boolean {
  const extension = extensionOf(name)
  return extension ? MARKDOWN_TYPES.has(extension) : false
}

export function isHtml(name: string): boolean {
  const extension = extensionOf(name)
  return extension ? HTML_TYPES.has(extension) : false
}

export function isSvg(name: string): boolean {
  const extension = extensionOf(name)
  return extension ? SVG_TYPES.has(extension) : false
}

// A file that is written to be read as a page as well as as text, so it is
// offered both ways.
export function canPreview(name: string): boolean {
  return isMarkdown(name) || isHtml(name) || isSvg(name)
}

export interface FileMatch {
  path: string
  hits: number[]
}

export interface FileContentMatch {
  path: string
  line: number
  column: number
  endColumn: number
  text: string
  start: number
  end: number
}

export interface FileContentSearch {
  matches: FileContentMatch[]
  limited: boolean
  error: string | null
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
  | { kind: 'file'; path: string; text: string; truncated: boolean; preview?: string }
  | { kind: 'dir'; path: string; entries: FileEntry[] }
  | { kind: 'image'; path: string; url: string; size: number }
  | { kind: 'media'; path: string; url: string; size: number; type: string; video: boolean }
  | { kind: 'binary'; path: string; size: number }
  | { kind: 'missing'; path: string }
