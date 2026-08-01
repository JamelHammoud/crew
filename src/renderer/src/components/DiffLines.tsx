import type { ReactNode } from 'react'
import { LineText, useHighlight } from './codeLine'
import type { Row } from './diffRows'

function Line({
  row,
  tokens,
  numbers,
  width
}: {
  row: Row
  tokens: ReturnType<ReturnType<typeof useHighlight>>
  numbers: boolean
  width: number
}) {
  const gone = row.line === null
  return (
    <div className={`flex ${gone ? 'bg-danger/10' : row.changed ? 'bg-positive/10' : ''}`}>
      {numbers && (
        <span
          style={{ width: `${width}ch` }}
          className="shrink-0 select-none pl-3 text-right text-fg-faint/70 tabular-nums"
        >
          {row.at ?? ''}
        </span>
      )}
      <span
        className={`shrink-0 w-6 select-none ${numbers ? 'pl-2' : 'pl-3'} ${
          gone ? 'text-danger/70' : row.changed ? 'text-positive/70' : 'text-fg-faint'
        }`}
      >
        {gone ? '−' : row.changed ? '+' : ''}
      </span>
      <span className={`whitespace-pre pr-3 ${gone ? 'text-fg-muted' : 'text-fg-secondary'}`}>
        <LineText row={row} tokens={tokens} tint={gone ? 'bg-danger/25' : 'bg-positive/25'} />
      </span>
    </div>
  )
}

// What stands between one stretch of a file and the next. It is a rule rather
// than a count of the lines nobody is being shown: the numbers either side
// already say how far it is, and a row of type saying it again is a row spent
// on nothing.
function Gap() {
  return (
    <div className="flex h-5 select-none items-center px-3">
      <span className="h-px flex-1 bg-fg/[0.07]" />
    </div>
  )
}

export default function DiffLines({
  path,
  rows,
  more,
  numbers = false
}: {
  path: string
  rows: Row[]
  more?: ReactNode
  numbers?: boolean
}) {
  const tokensFor = useHighlight(path, rows)
  if (rows.length === 0) return null
  // The gutter is as wide as the highest number it has to hold, so a file of
  // ninety lines is not paying for four figures of empty room.
  const width = Math.max(2, String(rows.reduce((high, row) => Math.max(high, row.at ?? 0), 0)).length) + 1

  return (
    <div className="select-text bg-ink-850 py-1.5 font-mono text-xs leading-5 overflow-x-auto">
      <div className="w-max min-w-full">
        {rows.map((row, index) =>
          row.gap ? (
            <Gap key={index} />
          ) : (
            <Line key={index} row={row} tokens={tokensFor(row)} numbers={numbers} width={width} />
          )
        )}
        {more}
      </div>
    </div>
  )
}
