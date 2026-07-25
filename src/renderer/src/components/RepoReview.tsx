import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState } from 'react'
import type { RepoChange } from '../../../shared/repository'
import Spinner from './Spinner'
import { Counts } from './StepRow'

const KIND_LABELS: Record<RepoChange['kind'], string> = {
  added: 'Added',
  modified: 'Modified',
  deleted: 'Deleted',
  renamed: 'Renamed',
  copied: 'Copied',
  conflict: 'Conflict'
}

function lineTone(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-fg-faint'
  if (line.startsWith('+')) return 'bg-positive/[0.08] text-positive'
  if (line.startsWith('-')) return 'bg-danger/[0.08] text-danger'
  if (line.startsWith('@@')) return 'text-fg-secondary'
  return 'text-fg-muted'
}

function Diff({ change }: { change: RepoChange }) {
  if (change.binary) {
    return <p className="px-3 py-3 text-xs text-fg-muted">Preview is unavailable for this file.</p>
  }
  if (!change.diff) {
    return <p className="px-3 py-3 text-xs text-fg-muted">There are no text lines to preview.</p>
  }
  return (
    <div className="overflow-x-auto bg-ink-900/70 py-2">
      <pre className="min-w-max text-xs font-mono leading-5">
        {change.diff.split('\n').map((line, index) => (
          <span key={index} className={`block min-h-5 px-3 whitespace-pre ${lineTone(line)}`}>
            {line || ' '}
          </span>
        ))}
      </pre>
      {change.truncated && (
        <p className="border-t border-fg/[0.06] px-3 pt-2 text-xs text-fg-muted">
          The preview stops here because this file is large.
        </p>
      )}
    </div>
  )
}

function ChangeRow({
  change,
  open,
  onToggle
}: {
  change: RepoChange
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-ink-800 ring-1 ring-fg/[0.05]">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="group flex min-h-11 w-full items-center gap-2.5 px-3 text-left transition-colors duration-150 hover:bg-fg/[0.04] active:bg-fg/[0.06]"
      >
        <ChevronRightIcon
          className={`h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-mono text-fg-secondary">{change.path}</span>
          <span className="block text-xs text-fg-muted">
            {change.previousPath ? `${KIND_LABELS[change.kind]} from ${change.previousPath}` : KIND_LABELS[change.kind]}
          </span>
        </span>
        <Counts added={change.added} removed={change.removed} />
      </button>
      {open && <Diff change={change} />}
    </div>
  )
}

export default function RepoReview({
  changes,
  loading,
  error,
  pushing,
  canPush,
  onPush
}: {
  changes: RepoChange[]
  loading: boolean
  error: string | null
  pushing: boolean
  canPush: boolean
  onPush: () => void
}) {
  const [openPath, setOpenPath] = useState<string | null>(null)
  const totals = useMemo(
    () =>
      changes.reduce(
        (sum, change) => ({ added: sum.added + change.added, removed: sum.removed + change.removed }),
        { added: 0, removed: 0 }
      ),
    [changes]
  )

  useEffect(() => {
    setOpenPath(current => {
      if (current && changes.some(change => change.path === current)) return current
      return changes.length === 1 ? changes[0].path : null
    })
  }, [changes])

  return (
    <div className="flex max-h-[min(620px,calc(100vh-32px))] flex-col overflow-hidden rounded-xl bg-ink-850">
      <div className="flex items-start gap-3 border-b border-fg/[0.06] px-4 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-fg">Review changes</span>
          <span className="block text-xs text-fg-muted">Project files stay local until you push.</span>
        </span>
        {!loading && changes.length > 0 && <Counts added={totals.added} removed={totals.removed} size="sm" />}
      </div>

      <div className="min-h-24 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-fg-muted">
            <Spinner size={14} />
            Loading changes
          </div>
        ) : error ? (
          <div className="flex min-h-24 items-center justify-center px-5 text-center text-xs text-danger">{error}</div>
        ) : changes.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center px-5 text-center text-xs text-fg-muted">
            No project changes to review.
          </div>
        ) : (
          <div className="space-y-1.5">
            {changes.map(change => (
              <ChangeRow
                key={change.path}
                change={change}
                open={openPath === change.path}
                onToggle={() => setOpenPath(openPath === change.path ? null : change.path)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-fg/[0.06] px-3 py-2.5">
        <span className="text-xs text-fg-muted">
          {changes.length > 0 ? `${changes.length} ${changes.length === 1 ? 'file' : 'files'}` : 'Nothing to push'}
        </span>
        <button
          type="button"
          disabled={!canPush || changes.length === 0 || loading || pushing}
          onClick={onPush}
          className="flex h-8 items-center gap-2 rounded-full bg-fg px-4 text-xs font-semibold text-ink-900 transition-all duration-150 hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-35"
        >
          {pushing && <Spinner size={12} />}
          Push changes
        </button>
      </div>
    </div>
  )
}
