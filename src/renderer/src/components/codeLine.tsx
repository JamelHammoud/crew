import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../state/theme'
import { docText, type Row, type Span } from './diffRows'
import { highlightLines, highlightLinesNow, type Highlighted, type ThemedToken } from './highlight'

interface Piece {
  text: string
  color: string | undefined
  marked: boolean
}

function tokenSlice(tokens: ThemedToken[], from: number, to: number, offset: number): ThemedToken[] {
  const sliced: ThemedToken[] = []
  let at = 0
  for (const token of tokens) {
    const end = at + token.content.length
    const start = Math.max(at, from)
    const stop = Math.min(end, to)
    if (start < stop) {
      sliced.push({
        ...token,
        content: token.content.slice(start - at, stop - at),
        offset: offset + start - from
      })
    }
    at = end
    if (at >= to) break
  }
  return sliced
}

function tokenAt(tokens: ThemedToken[], position: number): ThemedToken | undefined {
  let at = 0
  for (const token of tokens) {
    at += token.content.length
    if (position < at) return token
  }
  return tokens.at(-1)
}

export function carryTokens(text: string, tokens: ThemedToken[]): ThemedToken[] {
  const before = tokens.map(token => token.content).join('')
  if (before === text) return tokens
  let prefix = 0
  const shortest = Math.min(before.length, text.length)
  while (prefix < shortest && before[prefix] === text[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    before[before.length - suffix - 1] === text[text.length - suffix - 1]
  ) {
    suffix += 1
  }
  const left = tokenSlice(tokens, 0, prefix, 0)
  const middle = text.slice(prefix, text.length - suffix)
  const right = tokenSlice(tokens, before.length - suffix, before.length, text.length - suffix)
  if (!middle) return [...left, ...right]
  const sample = tokenAt(tokens, Math.min(prefix, Math.max(before.length - suffix - 1, 0)))
  if (!sample) return [{ content: text, offset: 0 }]
  const { content: _content, explanation: _explanation, offset: _offset, ...style } = sample
  return [...left, { ...style, content: middle, offset: prefix }, ...right]
}

function cut(text: string, tokens: ThemedToken[] | undefined, inner: Span[]): Piece[] {
  const base: Piece[] = tokens?.length
    ? tokens.map(token => ({ text: token.content, color: token.color, marked: false }))
    : [{ text, color: undefined, marked: false }]
  if (inner.length === 0) return base
  const pieces: Piece[] = []
  let at = 0
  let span = 0
  for (const part of base) {
    const end = at + part.text.length
    let from = at
    while (from < end) {
      while (span < inner.length && inner[span].to <= from) span += 1
      const hit = inner[span]
      if (!hit || hit.from >= end) {
        pieces.push({ text: text.slice(from, end), color: part.color, marked: false })
        break
      }
      if (hit.from > from) pieces.push({ text: text.slice(from, hit.from), color: part.color, marked: false })
      const to = Math.min(hit.to, end)
      pieces.push({ text: text.slice(Math.max(from, hit.from), to), color: part.color, marked: true })
      from = to
    }
    at = end
  }
  return pieces
}

export function LineText({ row, tokens, tint }: { row: Row; tokens: ThemedToken[] | undefined; tint: string }) {
  return (
    <>
      {cut(row.text, tokens, row.inner).map((piece, index) => (
        <span
          key={index}
          className={piece.marked ? tint : undefined}
          style={piece.color ? { color: piece.color } : undefined}
        >
          {piece.text}
        </span>
      ))}
    </>
  )
}

export function useHighlight(path: string, rows: Row[], delay = 0): (row: Row) => ThemedToken[] | undefined {
  const theme = useTheme()
  const [highlight, setHighlight] = useState<Highlighted | null>(null)
  const source = useMemo(() => docText(rows), [rows])
  const immediate = useMemo(() => (delay > 0 ? highlightLinesNow(path, source, theme) : null), [path, source, theme, delay])

  useEffect(() => setHighlight(null), [path, theme])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(
      () =>
        void highlightLines(path, source, theme).then(result => {
          if (alive && result) setHighlight(result)
        }),
      delay
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [path, source, theme, delay])

  const painted = immediate ?? highlight
  const lines = useMemo(() => {
    const found = new Map<string, ThemedToken[]>()
    painted?.lines.forEach((line, index) => found.set(line, painted.byLine[index]))
    return found
  }, [painted])

  return (row: Row) => {
    if (row.line === null || !painted) return undefined
    const at = row.line - 1
    if (painted.lines[at] === row.text) return painted.byLine[at]
    const same = lines.get(row.text)
    if (same) return same
    const prior = painted.byLine[at]
    return prior ? carryTokens(row.text, prior) : undefined
  }
}
