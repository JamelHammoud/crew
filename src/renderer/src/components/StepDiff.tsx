import { useMemo } from 'react'
import type { FileChange } from '../../../shared/llm'
import { LineText, useHighlight } from './codeLine'
import CopyButton from './CopyButton'
import Counts from './Counts'
import { diffRows, docText, type Row } from './diffRows'
import { FileTextLink, isPrivate, labelFor, PrivateChip, useLocated } from './fileLinks'

const SHOWN = 30

interface Block {
  removed: string[]
  added: string[]
}

function blocksOf(diff: string): Block[] {
  const blocks: Block[] = []
  let block: Block | null = null
  for (const line of diff.split('\n')) {
    const removed = line.startsWith('-')
    const added = line.startsWith('+')
    if (!removed && !added) continue
    if (!block || (removed && block.added.length > 0)) {
      block = { removed: [], added: [] }
      blocks.push(block)
    }
    const text = line.slice(1).replace(/^ /, '')
    if (removed) block.removed.push(text)
    else block.added.push(text)
  }
  return blocks
}

function rowsOf(diff: string): Row[] {
  const rows: Row[] = []
  let offset = 0
  for (const block of blocksOf(diff)) {
    const made =
      block.removed.length === 0
        ? block.added.map((text, index) => ({ text, line: index + 1, changed: true, inner: [] }))
        : block.added.length === 0
          ? block.removed.map(text => ({ text, line: null, changed: true, inner: [] }))
          : diffRows(block.removed.join('\n'), block.added.join('\n'))
    for (const row of made) if (row.line !== null) row.line += offset
    offset += block.added.length
    rows.push(...made)
  }
  return rows
}

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

export default function StepDiff({ file, again }: { file: FileChange; again?: unknown }) {
  const rows = useMemo(() => rowsOf(file.diff ?? ''), [file.diff])
  const tokensFor = useHighlight(file.path, rows)
  useLocated([file.path], again)
  const shown = rows.slice(0, SHOWN)
  const rest = rows.length - shown.length

  return (
    <div className="rounded-xl border border-ink-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-800">
        {isPrivate(file.path) ? (
          <PrivateChip />
        ) : (
          <FileTextLink path={file.path} diff={file.diff} className="font-mono text-xs text-fg-secondary truncate">
            {labelFor(file.path, '', file.path)}
          </FileTextLink>
        )}
        <Counts added={file.added} removed={file.removed} />
        <span className="flex-1" />
        {rows.length > 0 && <CopyButton text={docText(rows)} />}
      </div>
      {rows.length > 0 && (
        <div className="select-text bg-ink-850 py-1.5 font-mono text-xs leading-5 overflow-x-auto">
          <div className="w-max min-w-full">
            {shown.map((row, index) => (
              <Line key={index} row={row} tokens={tokensFor(row)} />
            ))}
            {rest > 0 && (
              <FileTextLink path={file.path} diff={file.diff} className="block px-3 pt-1 text-fg-faint">
                {`${rest} more ${rest === 1 ? 'line' : 'lines'}`}
              </FileTextLink>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
