import { useMemo, useState } from 'react'
import type { AgentStep } from '../../../shared/llm'
import { ChevronRightGlyph, DocGlyph } from '../icons'
import Counts from './Counts'
import { FilePathLink } from './StepRow'

export default function FilesChanged({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false)
  const files = useMemo(() => {
    const map = new Map<string, { added: number; removed: number; diff: string }>()
    for (const step of steps) {
      for (const file of step.files ?? []) {
        const entry = map.get(file.path) ?? { added: 0, removed: 0, diff: '' }
        entry.added += file.added
        entry.removed += file.removed
        if (file.diff) entry.diff = entry.diff ? `${entry.diff}\n\n${file.diff}` : file.diff
        map.set(file.path, entry)
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [steps])

  if (files.length === 0) return null

  const totals = files.reduce(
    (acc, [, file]) => ({ added: acc.added + file.added, removed: acc.removed + file.removed }),
    { added: 0, removed: 0 }
  )

  return (
    <div className="ml-14 border border-ink-700 rounded-card overflow-hidden animate-rise select-none">
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2.5 px-4 h-11 w-full text-left bg-ink-700/50"
      >
        <DocGlyph className="w-4 h-4 text-fg-muted shrink-0" />
        <span className="text-sm font-semibold text-fg">
          {files.length} {files.length === 1 ? 'file' : 'files'} changed
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <Counts added={totals.added} removed={totals.removed} />
          <ChevronRightGlyph
            className={`w-3.5 h-3.5 shrink-0 text-fg-faint group-hover:text-fg-muted transition-transform duration-200 ${
              open ? 'rotate-90' : ''
            }`}
          />
        </span>
      </button>
      {open && (
        <div className="px-4 py-2.5 space-y-1.5">
          {files.map(([path, file]) => (
            <div key={path} className="flex items-center gap-3 text-xs font-mono">
              <FilePathLink path={path} diff={file.diff} className="text-fg-secondary truncate flex-1" />
              <Counts added={file.added} removed={file.removed} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
