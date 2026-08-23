import { LineText, useHighlight } from './codeLine'
import type { Row } from './diffRows'

export default function CodeRows({
  path,
  rows,
  gutter,
  line,
  dirty,
  activeRow
}: {
  path: string
  rows: Row[]
  gutter: string
  line: number | null
  dirty: boolean
  activeRow: number | null
}) {
  const tokensFor = useHighlight(path, rows, dirty ? 150 : 0)

  const gutter = (text: string | number, tone: string, tint: string) => (
    <span
      data-code-gutter
      style={{ minWidth: `calc(2rem + ${gutter})` }}
      className={`sticky left-0 z-10 shrink-0 box-border px-4 text-right select-none bg-ink-900 ${tone}`}
    >
      {tint && <span className={`absolute inset-0 ${tint}`} />}
      <span className="relative">{text}</span>
    </span>
  )

  return (
    <div aria-hidden>
      {rows.map((row, index) => {
        if (row.line === null) {
          return (
            <div key={index} data-row={index} data-gone className="flex bg-danger/10">
              {gutter('−', 'text-danger/60', 'bg-danger/10')}
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
            className={`flex ${
              row.changed ? 'bg-positive/10' : marked ? 'bg-fg/[0.07]' : activeRow === index ? 'bg-fg/[0.035]' : ''
            }`}
          >
            {gutter(
              row.line,
              `tabular-nums ${row.changed || marked ? 'text-fg' : 'text-fg-faint'}`,
              row.changed ? 'bg-positive/10' : marked ? 'bg-fg/[0.07]' : activeRow === index ? 'bg-fg/[0.035]' : ''
            )}
            <span data-code-text className="whitespace-pre text-fg-secondary pr-4">
              <LineText row={row} tokens={tokensFor(row)} tint="bg-positive/25" />
            </span>
          </div>
        )
      })}
    </div>
  )
}
