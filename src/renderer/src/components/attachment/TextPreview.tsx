import { useMemo } from 'react'
import { LineText, useHighlight } from '../codeLine'
import { plainRows } from '../diffRows'
import MarkdownView from '../MarkdownView'
import { MAX_LINES, readText } from './bytes'
import { Failed, Loading, Note } from './Frame'
import { useRead } from './useRead'

export default function TextPreview({
  url,
  name,
  mime,
  asPage = false
}: {
  url: string
  name: string
  mime: string
  asPage?: boolean
}) {
  const { data, failed } = useRead(url, readText)
  const text = data?.text ?? ''
  const all = useMemo(() => plainRows(text), [text])
  const rows = useMemo(() => all.slice(0, MAX_LINES), [all])
  const tokensFor = useHighlight(name, rows)
  const partial = (data?.partial ?? false) || all.length > MAX_LINES
  const gutter = `${Math.max(String(rows.length).length, 2)}ch`

  if (failed) return <Failed label="Could not read this file" />
  if (!data) return <Loading />

  if (asPage && mime === 'text/markdown') {
    return (
      <div className="absolute inset-0 overflow-auto">
        <MarkdownView path={name} text={text} partial={partial} />
      </div>
    )
  }

  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="min-h-full py-3 min-w-max font-mono text-xs leading-5 select-text">
        {rows.map(row => (
          <div key={row.line} className="flex px-4">
            <span
              style={{ minWidth: gutter }}
              className="shrink-0 mr-4 text-right select-none tabular-nums text-fg-faint"
            >
              {row.line}
            </span>
            <span className="whitespace-pre text-fg-secondary pr-4">
              <LineText row={row} tokens={tokensFor(row)} tint="" />
            </span>
          </div>
        ))}
        {partial && <Note>Showing the beginning of this file</Note>}
      </div>
    </div>
  )
}
