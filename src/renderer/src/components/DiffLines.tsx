import type { ReactNode } from 'react'
import { LineText, useHighlight } from './codeLine'
import type { Row } from './diffRows'

function Line({
  row,
  tokens,
  numbers,
  width,
  wrap
}: {
  row: Row
  tokens: ReturnType<ReturnType<typeof useHighlight>>
  numbers: boolean
  width: number
  wrap: boolean
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
      {/* What a wrapped line does with its second half is the whole of whether
          wrapping is readable. Hung under the code it reads as one line that
          ran on, where flush against it every wrap reads as a new line of the
          file and a diff stops having a shape. */}
      <span
        className={`pr-3 ${
          wrap ? 'min-w-0 flex-1 whitespace-pre-wrap break-words pl-4 -indent-4' : 'whitespace-pre'
        } ${gone ? 'text-fg-muted' : 'text-fg-secondary'}`}
      >
        <LineText row={row} tokens={tokens} tint={gone ? 'bg-danger/25' : 'bg-positive/25'} />
      </span>
    </div>
  )
}

// What stands between one stretch of a file and the next. It is a rule rather
// than a count of the lines nobody is being shown: the numbers either side
// already say how far it is, and a row of type saying it again is a row spent
// on nothing. What it does carry is what the lines under it sit inside, where
// git worked one out, since landing partway down a file is the one place that
// cannot be read off the lines themselves.
function Gap({ says }: { says: string }) {
  return (
    <div className="flex h-6 select-none items-center gap-2 px-3">
      <span className="h-px w-6 shrink-0 bg-fg/[0.07]" />
      {says && <span className="truncate text-fg-faint/70">{says}</span>}
      <span className="h-px flex-1 bg-fg/[0.07]" />
    </div>
  )
}

// A glance at what an agent did scrolls sideways, because a step in a thread is
// read past rather than read and the line it cuts off is one nobody was going
// to reach anyway. A file being reviewed in a 480 column is the opposite: the
// line running off the right is the one being judged, and a column that cuts it
// off is a column the work cannot be done in. So the reading wraps, and the
// wrapped part hangs under the code rather than under the gutter.
export default function DiffLines({
  path,
  rows,
  more,
  numbers = false,
  wrap = false
}: {
  path: string
  rows: Row[]
  more?: ReactNode
  numbers?: boolean
  wrap?: boolean
}) {
  const tokensFor = useHighlight(path, rows)
  if (rows.length === 0) return null
  // The gutter is as wide as the highest number it has to hold, so a file of
  // ninety lines is not paying for four figures of empty room.
  const width = Math.max(2, String(rows.reduce((high, row) => Math.max(high, row.at ?? 0), 0)).length) + 1

  return (
    <div className={`select-text bg-ink-850 py-1.5 font-mono text-xs leading-5 ${wrap ? '' : 'overflow-x-auto'}`}>
      <div className={wrap ? '' : 'w-max min-w-full'}>
        {rows.map((row, index) =>
          row.gap ? (
            <Gap key={index} says={row.text} />
          ) : (
            <Line key={index} row={row} tokens={tokensFor(row)} numbers={numbers} width={width} wrap={wrap} />
          )
        )}
        {more}
      </div>
    </div>
  )
}
