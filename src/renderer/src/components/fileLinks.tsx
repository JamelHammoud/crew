import { useEffect, useState } from 'react'
import type { PathLocation } from '../../../shared/files'
import { useBrowser } from '../state/browser'

export interface FileRef {
  path: string
  line: number | null
}

const ABS_PATH = String.raw`~?\/(?:[\w.-]+\/)*[\w.-]*\w`
const SLASH_PATH = String.raw`(?:\.\/)?(?:[\w.-]+\/)+[\w.-]*\w`
const BARE_FILE = String.raw`[\w-]+(?:\.[\w-]+)*\.[A-Za-z][A-Za-z0-9]{1,6}`
const LINE_SUFFIX = String.raw`:\d+(?::\d+)?`
const DOMAINS = new Set(['com', 'net', 'org', 'io', 'dev', 'ai', 'app', 'co', 'edu', 'gov'])

const FULL_RE = new RegExp(`^(${ABS_PATH}|${SLASH_PATH}|${BARE_FILE})(${LINE_SUFFIX})?$`)
const SUFFIX_RE = new RegExp(`(${LINE_SUFFIX})$`)
const PROSE_RE = new RegExp(
  String.raw`(?<![\w/.@:~-])(${ABS_PATH}|${SLASH_PATH}|${BARE_FILE})(${LINE_SUFFIX})?(?![\w/])`,
  'g'
)

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi
const URL_TAIL_RE = /[.,;:!?'"]+$/

const PRIVATE_LABEL = 'Private file'
const PRIVATE_CLASS = 'private-file'
const UNSETTLED_TTL = 15_000

const located = new Map<string, { location: PathLocation; at: number }>()
const pending = new Map<string, Promise<PathLocation>>()

const suffixOf = (text: string): string => text.match(SUFFIX_RE)?.[1] ?? ''

// A file can appear after a pull, so only answers that will not change are
// kept for good.
const settled = (location: PathLocation): boolean =>
  location.kind === 'local' || (location.kind === 'repo' && location.exists)

export function locationOf(path: string): PathLocation | null {
  const entry = located.get(path)
  if (!entry) return null
  if (!settled(entry.location) && Date.now() - entry.at > UNSETTLED_TTL) {
    located.delete(path)
    return null
  }
  return entry.location
}

function locate(path: string): Promise<PathLocation> {
  const known = locationOf(path)
  if (known) return Promise.resolve(known)
  let promise = pending.get(path)
  if (!promise) {
    const ask = window.crew?.locatePath
    promise = (ask ? ask(path) : Promise.resolve<PathLocation>({ kind: 'local' }))
      .catch((): PathLocation => ({ kind: 'local' }))
      .then(location => {
        located.set(path, { location, at: Date.now() })
        pending.delete(path)
        return location
      })
    pending.set(path, promise)
  }
  return promise
}

// Placing a path only matters when it changes what the reader sees: a link, a
// shorter label, or a private chip.
function shifts(path: string, location: PathLocation): boolean {
  if (location.kind === 'private') return true
  if (location.kind === 'repo') return location.exists || location.path !== path
  return false
}

export async function locatePaths(paths: string[]): Promise<boolean> {
  const unknown = [...new Set(paths)].filter(path => locationOf(path) === null)
  if (unknown.length === 0) return false
  const moved = await Promise.all(unknown.map(async path => shifts(path, await locate(path))))
  return moved.some(Boolean)
}

export function openable(path: string): boolean {
  const location = locationOf(path)
  return location?.kind === 'repo' && location.exists
}

export function isPrivate(path: string): boolean {
  return locationOf(path)?.kind === 'private'
}

export function labelFor(path: string, suffix: string, fallback: string): string {
  const location = locationOf(path)
  return location?.kind === 'repo' ? location.path + suffix : fallback
}

export function targetFor(path: string): string {
  const location = locationOf(path)
  return location?.kind === 'repo' ? location.path : path
}

function toRef(rawPath: string, suffix: string | undefined): FileRef | null {
  const path = rawPath.replace(/^\.\//, '')
  if (path.startsWith('../') || path.includes('//')) return null
  if (!path.includes('/') && DOMAINS.has(path.split('.').pop() ?? '')) return null
  const line = suffix ? parseInt(suffix.slice(1), 10) : null
  return { path, line }
}

export function parseFileRef(raw: string): FileRef | null {
  const text = raw.trim()
  if (text.includes('://')) return null
  const match = text.match(FULL_RE)
  if (!match) return null
  return toRef(match[1], match[2])
}

export type FileToken =
  | { kind: 'text'; text: string }
  | { kind: 'file'; text: string; path: string; suffix: string; line: number | null }
  | { kind: 'url'; text: string }

const occurrences = (text: string, char: string): number => text.split(char).length - 1

// Sentences end after links too, so trailing punctuation belongs to the prose
// unless a bracket it opened is still waiting to close.
function trimUrl(raw: string): string {
  let url = raw.replace(URL_TAIL_RE, '')
  while (url.endsWith(')') && occurrences(url, ')') > occurrences(url, '(')) url = url.slice(0, -1)
  return url
}

function pathTokens(text: string): FileToken[] {
  const tokens: FileToken[] = []
  let cursor = 0
  for (const match of text.matchAll(PROSE_RE)) {
    const ref = toRef(match[1], match[2])
    if (!ref) continue
    const start = match.index ?? 0
    const end = start + match[0].length
    // Agents quote paths as they think, and a link wearing backticks reads as
    // punctuation nobody typed.
    const quoted = text[start - 1] === '`' && text[end] === '`'
    const from = quoted ? start - 1 : start
    if (from > cursor) tokens.push({ kind: 'text', text: text.slice(cursor, from) })
    tokens.push({ kind: 'file', text: match[0], path: ref.path, suffix: match[2] ?? '', line: ref.line })
    cursor = quoted ? end + 1 : end
  }
  if (cursor < text.length) tokens.push({ kind: 'text', text: text.slice(cursor) })
  return tokens
}

export function fileTokens(text: string): FileToken[] {
  const tokens: FileToken[] = []
  let cursor = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    const url = trimUrl(match[0])
    if (start > cursor) tokens.push(...pathTokens(text.slice(cursor, start)))
    tokens.push({ kind: 'url', text: url })
    cursor = start + url.length
  }
  if (cursor < text.length) tokens.push(...pathTokens(text.slice(cursor)))
  return tokens
}

function privateNode(doc: Document): HTMLElement {
  const chip = doc.createElement('span')
  chip.className = PRIVATE_CLASS
  chip.textContent = PRIVATE_LABEL
  return chip
}

function linkNode(doc: Document, path: string, line: number | null, label: string): HTMLAnchorElement {
  const anchor = doc.createElement('a')
  anchor.className = 'file-link'
  anchor.dataset.path = targetFor(path)
  if (line !== null) anchor.dataset.line = String(line)
  const code = doc.createElement('code')
  code.textContent = label
  anchor.appendChild(code)
  return anchor
}

export function linkifyFiles(root: HTMLElement): string[] {
  const doc = root.ownerDocument
  const unknown = new Set<string>()
  const moves = (path: string): boolean => {
    const location = locationOf(path)
    if (!location) {
      unknown.add(path)
      return false
    }
    return shifts(path, location)
  }
  for (const code of [...root.querySelectorAll('code')]) {
    if (code.closest('pre, a')) continue
    const text = code.textContent ?? ''
    const ref = parseFileRef(text)
    if (!ref || !moves(ref.path)) continue
    if (isPrivate(ref.path)) {
      code.replaceWith(privateNode(doc))
      continue
    }
    const label = labelFor(ref.path, suffixOf(text), text)
    if (!openable(ref.path)) {
      code.textContent = label
      continue
    }
    code.replaceWith(linkNode(doc, ref.path, ref.line, label))
  }
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent && !parent.closest('a, pre, code')) texts.push(node as Text)
  }
  for (const text of texts) {
    const tokens = fileTokens(text.textContent ?? '')
    const changed = tokens.filter(token => token.kind === 'file' && moves(token.path))
    if (changed.length === 0) continue
    const fragment = doc.createDocumentFragment()
    for (const token of tokens) {
      if (token.kind !== 'file' || !changed.includes(token)) {
        fragment.appendChild(doc.createTextNode(token.text))
        continue
      }
      if (isPrivate(token.path)) {
        fragment.appendChild(privateNode(doc))
        continue
      }
      const label = labelFor(token.path, token.suffix, token.text)
      if (openable(token.path)) fragment.appendChild(linkNode(doc, token.path, token.line, label))
      else fragment.appendChild(doc.createTextNode(label))
    }
    text.replaceWith(fragment)
  }
  return [...unknown]
}

export function useLocated(paths: string[]): void {
  const [, bump] = useState(0)
  const key = paths.join('\n')

  useEffect(() => {
    if (paths.length === 0) return
    let alive = true
    void locatePaths(paths).then(moved => alive && moved && bump(count => count + 1))
    return () => {
      alive = false
    }
  }, [key])
}

export function FileChip({ path, line, text }: { path: string; line: number | null; text: string }) {
  return (
    <code
      onClick={event => {
        event.stopPropagation()
        useBrowser.getState().openFile(targetFor(path), line)
      }}
      className="font-mono text-[13px] bg-ink-800 rounded-md px-1.5 py-0.5 cursor-pointer transition-colors hover:bg-ink-700 hover:text-fg"
    >
      {text}
    </code>
  )
}

export function PrivateChip() {
  return <span className={PRIVATE_CLASS}>{PRIVATE_LABEL}</span>
}

export function UrlLink({ url }: { url: string }) {
  return (
    <a
      onClick={event => {
        event.stopPropagation()
        event.preventDefault()
        useBrowser.getState().openUrl(url)
      }}
      href={url}
      className="text-fg underline underline-offset-2 decoration-fg-muted transition-colors hover:decoration-fg cursor-pointer break-words"
    >
      {url}
    </a>
  )
}

export function TextWithFileLinks({ text, plain }: { text: string; plain?: boolean }) {
  const tokens = fileTokens(text)
  useLocated(tokens.flatMap(token => (token.kind === 'file' ? [token.path] : [])))

  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'url') return plain ? token.text : <UrlLink key={index} url={token.text} />
        if (token.kind !== 'file') return token.text
        if (isPrivate(token.path)) return <PrivateChip key={index} />
        const label = labelFor(token.path, token.suffix, token.text)
        if (plain || !openable(token.path)) return label
        return <FileChip key={index} path={token.path} line={token.line} text={label} />
      })}
    </>
  )
}
