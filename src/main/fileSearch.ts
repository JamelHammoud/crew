import { promises as fs } from 'node:fs'
import type { FileContentMatch, FileContentSearch } from '../shared/files'
import {
  compileFileSearch,
  replacementFor,
  type CompiledFileSearch,
  type FileReplaceRequest,
  type FileReplaceResult,
  type FileSearchOptions,
  type TextRange
} from '../shared/fileSearch'
import { listRepoFiles } from '../shared/repoFiles'
import { resolveRepoPath } from './files'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_CACHE_BYTES = 64 * 1024 * 1024
const MAX_TEXT = 240
const BATCH = 20

type CachedFile = {
  mtimeMs: number
  size: number
  text: string | null
  partial: boolean
  cost: number
}

function lineStarts(text: string): number[] {
  const starts = [0]
  for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1)) starts.push(at + 1)
  return starts
}

function lineFor(starts: number[], offset: number): number {
  let low = 0
  let high = starts.length
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)
    if (starts[middle] <= offset) low = middle
    else high = middle
  }
  return low
}

function shownMatch(line: string, at: number, length: number): Pick<FileContentMatch, 'text' | 'start' | 'end'> {
  if (line.length <= MAX_TEXT) return { text: line, start: at, end: Math.min(line.length, at + length) }
  const room = MAX_TEXT - 2
  const from = Math.max(0, Math.min(at - 80, line.length - room))
  const to = Math.min(line.length, from + room)
  const before = from > 0 ? '…' : ''
  const after = to < line.length ? '…' : ''
  return {
    text: `${before}${line.slice(from, to)}${after}`,
    start: before.length + at - from,
    end: Math.min(before.length + to - from, before.length + at - from + length)
  }
}

function contentMatches(
  path: string,
  text: string,
  search: CompiledFileSearch,
  limit: number
): FileContentMatch[] {
  if (!search.accepts(path)) return []
  const starts = lineStarts(text)
  return search
    .find(text)
    .slice(0, limit)
    .map(range => {
      const lineIndex = lineFor(starts, range.start)
      const from = starts[lineIndex]
      const raw = text.slice(from, text.indexOf('\n', from) < 0 ? text.length : text.indexOf('\n', from))
      const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
      const column = range.start - from + 1
      return {
        path,
        line: lineIndex + 1,
        column,
        endColumn: column + range.end - range.start,
        ...shownMatch(line, column - 1, range.end - range.start)
      }
    })
}

function targetRange(request: FileReplaceRequest, path: string, text: string, ranges: TextRange[]): TextRange[] {
  if (!request.target) return ranges
  if (request.target.path !== path) return []
  const starts = lineStarts(text)
  return ranges.filter(range => {
    const lineIndex = lineFor(starts, range.start)
    const column = range.start - starts[lineIndex] + 1
    return lineIndex + 1 === request.target?.line &&
      column === request.target.column &&
      column + range.end - range.start === request.target.endColumn
  })
}

function replacedText(text: string, ranges: TextRange[], request: FileReplaceRequest): string {
  let next = text
  for (let at = ranges.length - 1; at >= 0; at--) {
    const range = ranges[at]
    const replacement = replacementFor(request.replacement, range, request.preserveCase)
    next = `${next.slice(0, range.start)}${replacement}${next.slice(range.end)}`
  }
  return next
}

export class FileSearch {
  private root = ''
  private cache = new Map<string, CachedFile>()
  private cacheBytes = 0

  private clear(): void {
    this.cache.clear()
    this.cacheBytes = 0
  }

  private forget(path: string): void {
    const cached = this.cache.get(path)
    if (!cached) return
    this.cache.delete(path)
    this.cacheBytes -= cached.cost
  }

  private remember(path: string, entry: CachedFile): void {
    this.forget(path)
    this.cache.set(path, entry)
    this.cacheBytes += entry.cost
    while (this.cacheBytes > MAX_CACHE_BYTES) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.forget(oldest)
    }
  }

  private prepare(root: string): void {
    if (root === this.root) return
    this.root = root
    this.clear()
  }

  private async read(root: string, relative: string): Promise<CachedFile | null> {
    const absolute = resolveRepoPath(root, relative)
    if (!absolute) return null
    const stat = await fs.stat(absolute).catch(() => null)
    if (!stat?.isFile()) return null
    const cached = this.cache.get(relative)
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      this.cache.delete(relative)
      this.cache.set(relative, cached)
      return cached
    }
    const handle = await fs.open(absolute, 'r').catch(() => null)
    if (!handle) return null
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, MAX_BYTES))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const bytes = buffer.subarray(0, bytesRead)
      const text = bytes.subarray(0, 8000).includes(0) ? null : bytes.toString('utf8')
      const entry: CachedFile = {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        text,
        partial: text !== null && stat.size > MAX_BYTES,
        cost: text ? Buffer.byteLength(text) : 0
      }
      this.remember(relative, entry)
      return entry
    } finally {
      await handle.close()
    }
  }

  private async paths(root: string): Promise<string[]> {
    const paths = await listRepoFiles(root)
    const current = new Set(paths)
    for (const path of this.cache.keys()) if (!current.has(path)) this.forget(path)
    return paths
  }

  async search(root: string, options: FileSearchOptions, limit = 80): Promise<FileContentSearch> {
    const compiled = compileFileSearch(options)
    if (compiled.error || !compiled.search || limit <= 0) {
      return { matches: [], limited: false, error: compiled.error }
    }
    this.prepare(root)
    const paths = await this.paths(root)
    const found: FileContentMatch[] = []
    let partial = false
    for (let at = 0; at < paths.length && found.length <= limit; at += BATCH) {
      const files = await Promise.all(paths.slice(at, at + BATCH).map(path => this.read(root, path)))
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file) continue
        partial ||= file.partial
        if (file.text === null) continue
        found.push(...contentMatches(paths[at + index], file.text, compiled.search, limit + 1 - found.length))
        if (found.length > limit) break
      }
    }
    return { matches: found.slice(0, limit), limited: partial || found.length > limit, error: null }
  }

  async replace(root: string, request: FileReplaceRequest): Promise<FileReplaceResult> {
    const compiled = compileFileSearch(request)
    if (compiled.error || !compiled.search) {
      return { files: 0, replacements: 0, failed: [], error: compiled.error }
    }
    this.prepare(root)
    const paths = request.target ? [request.target.path] : await this.paths(root)
    const failed: string[] = []
    let files = 0
    let replacements = 0
    for (const path of paths) {
      if (!compiled.search.accepts(path)) continue
      const file = await this.read(root, path)
      if (!file || file.text === null || file.partial) continue
      const ranges = targetRange(request, path, file.text, compiled.search.find(file.text))
      if (ranges.length === 0) continue
      const absolute = resolveRepoPath(root, path)
      if (!absolute) continue
      try {
        await fs.writeFile(absolute, replacedText(file.text, ranges, request), 'utf8')
        this.forget(path)
        files++
        replacements += ranges.length
      } catch {
        failed.push(path)
      }
    }
    return { files, replacements, failed, error: null }
  }
}
