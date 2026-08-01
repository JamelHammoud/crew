import { useState } from 'react'
import { ArchiveGlyph, CheckGlyph, EyeGlyph, StopGlyph, WarningGlyph } from '../icons'
import { type ThreadMeta } from '../state/store'
import { MenuDivider, Popover } from './Popover'
import Spinner from './Spinner'
import { THREAD_STATE_LABELS, type ThreadState } from './thread'
import ThreadCardShell from './ThreadCardShell'
import ThreadStatusBar from './ThreadStatusBar'
import { ThreadIdItem, ThreadOpenItems, ThreadStatusItems } from './threadMenu'

export function StateIcon({ state }: { state: ThreadState }) {
  if (state === 'working') return <Spinner size={16} className="text-fg" />
  if (state === 'failed') return <WarningGlyph className="w-4 h-4 text-danger shrink-0" />
  // The mark on the button that ended it, so the row says what was done rather
  // than warning about it.
  if (state === 'stopped') return <StopGlyph className="w-4 h-4 text-fg-muted shrink-0" />
  if (state === 'ready') return <EyeGlyph className="w-4 h-4 text-fg shrink-0" />
  if (state === 'archived') return <ArchiveGlyph className="w-4 h-4 text-fg-muted shrink-0" />
  return <CheckGlyph className="w-4 h-4 text-fg shrink-0" />
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
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

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
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-52">
        <ThreadOpenItems threadId={thread.id} onOpen={onOpen} onDone={() => setMenuAt(null)} />
        <MenuDivider />
        <ThreadStatusItems threadId={thread.id} onDone={() => setMenuAt(null)} />
      </Popover>
    </>
  )
}
