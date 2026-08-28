import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
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
import { insideRoot, resolveRepoPath } from './files'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_CACHE_BYTES = 64 * 1024 * 1024
const MAX_TEXT = 240
const BATCH = 20
const MAX_REPLACEMENTS = 100000
const UTF8 = new TextDecoder('utf-8', { fatal: true })

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
    .find(text, limit)
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

async function safeAbsolute(root: string, relative: string): Promise<string | null> {
  const absolute = resolveRepoPath(root, relative)
  if (!absolute) return null
  const [realRoot, realTarget] = await Promise.all([fs.realpath(root).catch(() => null), fs.realpath(absolute).catch(() => null)])
  if (!realRoot || !realTarget || insideRoot(realRoot, realTarget) === null) return null
  return realTarget
}

async function writeAtomic(absolute: string, expected: string, text: string): Promise<boolean> {
  const current = await fs.readFile(absolute).catch(() => null)
  if (!current) return false
  let decoded: string
  try {
    decoded = UTF8.decode(current)
  } catch {
    return false
  }
  if (decoded !== expected) return false
  const stat = await fs.stat(absolute).catch(() => null)
  if (!stat?.isFile()) return false
  const temporary = path.join(path.dirname(absolute), `.${path.basename(absolute)}.crew-${randomUUID()}`)
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null
  try {
    handle = await fs.open(temporary, 'wx', stat.mode)
    await handle.writeFile(text, 'utf8')
    await handle.sync()
    await handle.close()
    handle = null
    const latest = await fs.readFile(absolute).catch(() => null)
    if (!latest || !latest.equals(current)) return false
    await fs.rename(temporary, absolute)
    return true
  } catch {
    return false
  } finally {
    await handle?.close().catch(() => undefined)
    await fs.rm(temporary, { force: true }).catch(() => undefined)
  }
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

  private async read(root: string, relative: string, fresh = false): Promise<CachedFile | null> {
    const absolute = await safeAbsolute(root, relative)
    if (!absolute) return null
    const stat = await fs.stat(absolute).catch(() => null)
    if (!stat?.isFile()) return null
    const cached = this.cache.get(relative)
    if (!fresh && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
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
      let text: string | null = null
      if (!bytes.subarray(0, 8000).includes(0)) {
        try {
          text = UTF8.decode(bytes)
        } catch {
          text = null
        }
      }
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
    if (options.refresh) this.clear()
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
    const plans: { path: string; absolute: string; text: string; ranges: TextRange[] }[] = []
    let replacements = 0
    for (const path of paths) {
      if (!compiled.search.accepts(path)) continue
      const file = await this.read(root, path, true)
      if (!file || file.text === null || file.partial) continue
      const ranges = targetRange(
        request,
        path,
        file.text,
        compiled.search.find(file.text, MAX_REPLACEMENTS + 1 - replacements)
      )
      if (ranges.length === 0) continue
      replacements += ranges.length
      if (replacements > MAX_REPLACEMENTS) {
        return { files: 0, replacements: 0, failed: [], error: 'Too many replacements' }
      }
      const absolute = await safeAbsolute(root, path)
      if (!absolute) continue
      plans.push({ path, absolute, text: file.text, ranges })
    }
    const failed: string[] = []
    let files = 0
    let written = 0
    for (const plan of plans) {
      if (await writeAtomic(plan.absolute, plan.text, replacedText(plan.text, plan.ranges, request))) {
        this.forget(plan.path)
        files++
        written += plan.ranges.length
      } else {
        failed.push(plan.path)
      }
    }
    return { files, replacements: written, failed, error: null }
  }
}
