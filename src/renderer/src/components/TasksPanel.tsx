import {
  ArchiveBoxXMarkIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon
} from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCrew, type ThreadMeta } from '../state/store'
import { StateIcon } from './ThreadCard'
import { describeStep, endPreview, lastEnd, threadState, type ThreadState } from './thread'
import Tooltip from './Tooltip'

interface Row {
  thread: ThreadMeta
  state: ThreadState
  detail: string
}

interface RowAction {
  icon: ReactNode
  label: string
  status: ThreadMeta['status']
}

export default function TasksPanel({
  open,
  onClose,
  onOpenThread
}: {
  open: boolean
  onClose: () => void
  onOpenThread: (threadId: string) => void
}) {
  const events = useCrew(s => s.events)
  const threads = useCrew(s => s.threads)
  const threadPrompts = useCrew(s => s.threadPrompts)
  const queues = useCrew(s => s.queues)
  const steps = useCrew(s => s.steps)
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const [showDone, setShowDone] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = []
    for (const e of events) {
      if (e.kind !== 'thread.started' || !threads[e.threadId]) continue
      const thread = threads[e.threadId]
      const promptId = threadPrompts[thread.id]
      const working = Boolean(promptId) || (queues[thread.id]?.length ?? 0) > 0
      const detail = promptId
        ? describeStep((steps[promptId] ?? []).at(-1))
        : endPreview(lastEnd(thread.id, events))
      list.push({ thread, state: threadState(thread, events, working), detail })
    }
    return list.reverse()
  }, [events, threads, threadPrompts, queues, steps])

  const inProgress = rows.filter(r => r.state === 'working' && r.thread.status !== 'archived')
  const needsReview = rows.filter(r => r.state === 'ready' || r.state === 'failed')
  const done = rows.filter(r => r.state === 'done')
  const archived = rows.filter(r => r.thread.status === 'archived')

  const item = (row: Row, action?: RowAction) => (
    <div key={row.thread.id} className="group relative">
      <button
        onClick={() => onOpenThread(row.thread.id)}
        className="w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-colors duration-150 hover:bg-white/[0.04]"
      >
        <span className="mt-1 shrink-0">
          <StateIcon state={row.state} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base text-fg truncate">{row.thread.title}</span>
          <span className="block text-sm text-fg-muted truncate">
            {row.thread.agentLabel}
            {row.detail ? ` · ${row.detail}` : ''}
          </span>
        </span>
      </button>
      {action && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <Tooltip label={action.label}>
            <button
              onClick={() => setThreadStatus(row.thread.id, action.status)}
              aria-label={action.label}
              className="w-8 h-8 rounded-full bg-ink-800 text-fg-muted flex items-center justify-center transition-all duration-150 hover:bg-ink-700 hover:text-fg active:scale-95"
            >
              {action.icon}
            </button>
          </Tooltip>
        </span>
      )}
    </div>
  )

  const heading = (title: string, count: number) => (
    <h3 className="px-3 mb-1 text-sm font-semibold text-fg-muted">
      {title} <span className="text-fg-faint">{count}</span>
    </h3>
  )

  const toggleHeading = (title: string, count: number, shown: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      className="px-3 -ml-1 mb-1 flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg-secondary"
    >
      {shown ? (
        <ChevronDownIcon className="w-3.5 h-3.5" />
      ) : (
        <ChevronRightIcon className="w-3.5 h-3.5" />
      )}
      {title} <span className="text-fg-faint">{count}</span>
    </button>
  )

  return (
    <>
      {open && <div className="absolute inset-0 z-40" onClick={onClose} />}
      <aside
        className={`app-no-drag absolute inset-y-0 right-0 z-50 w-[380px] bg-ink-900 border-l border-ink-700 shadow-2xl shadow-black/40 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="h-[70px] px-5 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-fg">Tasks</h2>
          <button
            onClick={onClose}
            aria-label="Close tasks"
            className="w-9 h-9 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-white/[0.06] active:scale-95"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-6">
          {rows.length === 0 && (
            <p className="text-base text-fg-muted text-center mt-16 px-6">
              Threads you start with an agent will show up here.
            </p>
          )}
          {inProgress.length > 0 && (
            <section>
              {heading('In progress', inProgress.length)}
              {inProgress.map(row => item(row))}
            </section>
          )}
          {needsReview.length > 0 && (
            <section>
              {heading('Needs review', needsReview.length)}
              {needsReview.map(row =>
                item(row, { icon: <CheckIcon className="w-4 h-4" />, label: 'Mark done', status: 'done' })
              )}
            </section>
          )}
          {done.length > 0 && (
            <section>
              {toggleHeading('Done', done.length, showDone, () => setShowDone(v => !v))}
              {showDone &&
                done.map(row =>
                  item(row, { icon: <ArrowUturnLeftIcon className="w-4 h-4" />, label: 'Reopen', status: 'open' })
                )}
            </section>
          )}
          {archived.length > 0 && (
            <section>
              {toggleHeading('Archived', archived.length, showArchived, () => setShowArchived(v => !v))}
              {showArchived &&
                archived.map(row =>
                  item(row, { icon: <ArchiveBoxXMarkIcon className="w-4 h-4" />, label: 'Unarchive', status: 'open' })
                )}
            </section>
          )}
        </div>
      </aside>
    </>
  )
}
