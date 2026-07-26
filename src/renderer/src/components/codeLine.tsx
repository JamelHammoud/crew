import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../state/theme'
import { docText, type Row, type Span } from './diffRows'
import { highlightLines, type ThemedToken } from './highlight'

interface Piece {
  text: string
  color: string | undefined
  marked: boolean
}

type Highlight = { lines: string[]; byLine: ThemedToken[][] }

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
  const [highlight, setHighlight] = useState<Highlight | null>(null)
  const source = useMemo(() => docText(rows), [rows])

  useEffect(() => setHighlight(null), [path, theme])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(
      () =>
        void highlightLines(path, source, theme).then(result => {
          if (alive && result) setHighlight({ lines: source.split('\n'), byLine: result })
        }),
      delay
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [path, source, theme, delay])

  return (row: Row) => {
    if (row.line === null || !highlight) return undefined
    const at = row.line - 1
    return highlight.lines[at] === row.text ? highlight.byLine[at] : undefined
  }
}
