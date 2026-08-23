import { promises as fs } from 'node:fs'
import type { FileContentMatch, FileContentSearch } from '../shared/files'
import { listRepoFiles } from '../shared/repoFiles'
import { resolveRepoPath } from './files'

const MAX_BYTES = 5 * 1024 * 1024
const MAX_TEXT = 240
const BATCH = 20

type CachedFile = {
  mtimeMs: number
  size: number
  text: string | null
  partial: boolean
}

function matchText(line: string, at: number, length: number): Pick<FileContentMatch, 'text' | 'start' | 'end'> {
  if (line.length <= MAX_TEXT) return { text: line, start: at, end: at + length }
  const room = MAX_TEXT - 2
  const from = Math.max(0, Math.min(at - 80, line.length - room))
  const to = Math.min(line.length, from + room)
  const before = from > 0 ? '…' : ''
  const after = to < line.length ? '…' : ''
  return {
    text: `${before}${line.slice(from, to)}${after}`,
    start: before.length + at - from,
    end: before.length + at - from + length
  }
}

function searchText(path: string, text: string, needle: string, limit: number): FileContentMatch[] {
  const matches: FileContentMatch[] = []
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    const at = line.toLocaleLowerCase().indexOf(needle)
    if (at < 0) continue
    matches.push({ path, line: index + 1, ...matchText(line, at, needle.length) })
    if (matches.length >= limit) break
  }
  return matches
}

export class FileSearch {
  private root = ''
  private cache = new Map<string, CachedFile>()

  private async read(root: string, relative: string): Promise<CachedFile | null> {
    const absolute = resolveRepoPath(root, relative)
    if (!absolute) return null
    const stat = await fs.stat(absolute).catch(() => null)
    if (!stat?.isFile()) return null
    const cached = this.cache.get(relative)
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached
    const handle = await fs.open(absolute, 'r').catch(() => null)
    if (!handle) return null
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, MAX_BYTES))
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      const bytes = buffer.subarray(0, bytesRead)
      const entry: CachedFile = {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        text: bytes.subarray(0, 8000).includes(0) ? null : bytes.toString('utf8'),
        partial: stat.size > MAX_BYTES
      }
      this.cache.set(relative, entry)
      return entry
    } finally {
      await handle.close()
    }
  }

  async search(root: string, query: string, limit = 80): Promise<FileContentSearch> {
    const needle = query.trim().slice(0, 200).toLocaleLowerCase()
    if (!needle || limit <= 0) return { matches: [], limited: false }
    if (root !== this.root) {
      this.root = root
      this.cache.clear()
    }
    const paths = await listRepoFiles(root)
    const current = new Set(paths)
    for (const path of this.cache.keys()) if (!current.has(path)) this.cache.delete(path)
    const found: FileContentMatch[] = []
    let partial = false
    for (let at = 0; at < paths.length && found.length <= limit; at += BATCH) {
      const files = await Promise.all(paths.slice(at, at + BATCH).map(path => this.read(root, path)))
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        if (!file) continue
        partial ||= file.partial
        if (file.text === null) continue
        found.push(...searchText(paths[at + index], file.text, needle, limit + 1 - found.length))
        if (found.length > limit) break
      }
    }
    return { matches: found.slice(0, limit), limited: partial || found.length > limit }
  }
}
