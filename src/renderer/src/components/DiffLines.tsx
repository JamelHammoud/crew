import type { ReactNode } from 'react'
import { LineText, useHighlight } from './codeLine'
import type { Row } from './diffRows'

function Line({ row, tokens }: { row: Row; tokens: ReturnType<ReturnType<typeof useHighlight>> }) {
  const gone = row.line === null
  return (
    <div className={`flex ${gone ? 'bg-danger/10' : row.changed ? 'bg-positive/10' : ''}`}>
      <span
        className={`shrink-0 w-6 pl-3 select-none ${
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

export default function DiffLines({ path, rows, more }: { path: string; rows: Row[]; more?: ReactNode }) {
  const tokensFor = useHighlight(path, rows)
  if (rows.length === 0) return null

  return (
    <div className="select-text bg-ink-850 py-1.5 font-mono text-xs leading-5 overflow-x-auto">
      <div className="w-max min-w-full">
        {rows.map((row, index) => (
          <Line key={index} row={row} tokens={tokensFor(row)} />
        ))}
        {more}
      </div>
    </div>
  )
}
