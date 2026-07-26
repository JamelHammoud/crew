import { LineText, useHighlight } from './codeLine'
import type { Row } from './diffRows'

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
  const tokensFor = useHighlight(path, rows, dirty ? 150 : 0)

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
              <LineText row={row} tokens={tokensFor(row)} tint="bg-positive/25" />
            </span>
          </div>
        )
      })}
    </div>
  )
}
