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
  const setThreadStatus = useCrew(s => s.setThreadStatus)
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
        <ThreadStatusBar
          thread={thread}
          icon={<StateIcon state={state} />}
          label={THREAD_STATE_LABELS[state]}
          detail={detail}
          danger={state === 'failed'}
        />
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
