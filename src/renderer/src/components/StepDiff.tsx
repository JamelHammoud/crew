import { useMemo } from 'react'
import type { FileChange } from '../../../shared/llm'
import CopyButton from './CopyButton'
import Counts from './Counts'
import DiffLines from './DiffLines'
import { docText } from './diffRows'
import { FileTextLink, isPrivate, labelFor, PrivateChip, useLocated } from './fileLinks'
import { rowsOf } from './unifiedRows'

const SHOWN = 30

export default function StepDiff({ file, again }: { file: FileChange; again?: unknown }) {
  const rows = useMemo(() => rowsOf(file.diff ?? ''), [file.diff])
  useLocated([file.path], again)
  const shown = rows.slice(0, SHOWN)
  const rest = rows.length - shown.length

  return (
    <div className="rounded-xl border border-ink-700 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-ink-800 select-none">
        {isPrivate(file.path) ? (
          <PrivateChip path={file.path} />
        ) : (
          <FileTextLink path={file.path} diff={file.diff} className="font-mono text-xs text-fg-secondary truncate">
            {labelFor(file.path, '', file.path)}
          </FileTextLink>
        )}
        <Counts added={file.added} removed={file.removed} />
        <span className="flex-1" />
        {rows.length > 0 && <CopyButton text={docText(rows)} />}
      </div>
      <DiffLines
        path={file.path}
        rows={shown}
        more={
          rest > 0 && (
            <FileTextLink path={file.path} diff={file.diff} className="block px-3 pt-1 text-fg-faint select-none">
              {`${rest} more ${rest === 1 ? 'line' : 'lines'}`}
            </FileTextLink>
          )
        }
      />
    </div>
  )
}
