import {
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useCrew, type ThreadMeta } from '../state/store'
import { MenuItem, Popover } from './Popover'
import Spinner from './Spinner'
import { THREAD_STATE_LABELS, type ThreadState } from './thread'
import ThreadCardShell from './ThreadCardShell'

export function StateIcon({ state }: { state: ThreadState }) {
  if (state === 'working') return <Spinner size={16} className="text-fg" />
  if (state === 'failed') return <ExclamationTriangleIcon className="w-4 h-4 text-danger shrink-0" />
  if (state === 'ready') return <EyeIcon className="w-4 h-4 text-fg shrink-0" />
  if (state === 'archived') return <ArchiveBoxIcon className="w-4 h-4 text-fg-muted shrink-0" />
  return <CheckIcon className="w-4 h-4 text-fg shrink-0" />
}

export default function ThreadCard({
  thread,
  ts,
  state,
  detail,
  onOpen
}: {
  thread: ThreadMeta
  ts: number
  state: ThreadState
  detail: string
  onOpen: () => void
}) {
  const agent = useCrew(s => s.agents.find(a => a.id === thread.agentId))
  const setThreadStatus = useCrew(s => s.setThreadStatus)
  const owner = agent?.ownerName
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const setStatus = (status: ThreadMeta['status']) => {
    setMenuAt(null)
    setThreadStatus(thread.id, status)
  }

  return (
    <>
      <ThreadCardShell
        thread={thread}
        ts={ts}
        onOpen={onOpen}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
      >
        <button
          onClick={onOpen}
          className="relative w-full bg-ink-700 px-5 h-[52px] flex items-center gap-3 text-left"
        >
          <StateIcon state={state} />
          <span className={`text-base font-semibold shrink-0 ${state === 'failed' ? 'text-danger' : 'text-fg'}`}>
            {THREAD_STATE_LABELS[state]}
          </span>
          <span className="text-base text-fg-muted truncate flex-1">{detail}</span>
          {owner && (
            <span className="relative self-stretch shrink-0 flex items-center bg-ink-700 transition-transform duration-200 group-hover:-translate-x-5">
              <span className="absolute right-full inset-y-0 w-10 bg-gradient-to-l from-ink-700 to-transparent pointer-events-none" />
              <span className="text-base font-semibold text-fg-muted">{owner}'s PC</span>
            </span>
          )}
          <ChevronRightIcon className="w-4 h-4 text-fg-muted absolute right-4 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
        </button>
      </ThreadCardShell>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
        {thread.status === 'done' ? (
          <MenuItem icon={<ArrowUturnLeftIcon />} label="Reopen" onClick={() => setStatus('open')} />
        ) : (
          <MenuItem icon={<CheckIcon />} label="Mark done" onClick={() => setStatus('done')} />
        )}
        <MenuItem icon={<ArchiveBoxIcon />} label="Archive thread" onClick={() => setStatus('archived')} />
      </Popover>
    </>
  )
}
