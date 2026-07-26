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

function LineText({ row, tokens, tint }: { row: Row; tokens: ThemedToken[] | undefined; tint: string }) {
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

export default function CodeRows({
  path,
  rows,
  gutter,
  line,
  dirty
}: {
  path: string
  rows: Row[]
  gutter: string
  line: number | null
  dirty: boolean
}) {
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
      dirty ? 150 : 0
    )
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [path, source, theme, dirty])

  return (
    <div aria-hidden>
      {rows.map((row, index) => {
        if (row.line === null) {
          return (
            <div key={index} data-row={index} data-gone className="flex px-4 bg-danger/10">
              <span style={{ minWidth: gutter }} className="shrink-0 mr-4 text-right select-none text-danger/60">
                −
              </span>
              <span className="whitespace-pre text-fg-muted pr-4">
                <LineText row={row} tokens={undefined} tint="bg-danger/25" />
              </span>
            </div>
          )
        }
        const at = row.line - 1
        const marked = line === row.line
        return (
          <div
            key={index}
            data-row={index}
            data-line={row.line}
            className={`flex px-4 ${row.changed ? 'bg-positive/10' : marked ? 'bg-fg/[0.07]' : ''}`}
          >
            <span
              style={{ minWidth: gutter }}
              className={`shrink-0 mr-4 text-right select-none tabular-nums ${
                row.changed || marked ? 'text-fg' : 'text-fg-faint'
              }`}
            >
              {row.line}
            </span>
            <span className="whitespace-pre text-fg-secondary pr-4">
              <LineText
                row={row}
                tokens={highlight?.lines[at] === row.text ? highlight.byLine[at] : undefined}
                tint="bg-positive/25"
              />
            </span>
          </div>
        )
      })}
    </div>
  )
}
