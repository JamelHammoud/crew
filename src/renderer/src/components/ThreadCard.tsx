import { useState } from 'react'
import { ArchiveGlyph, CheckGlyph, EyeGlyph, StopGlyph, WarningGlyph } from '../icons'
import { type ThreadMeta } from '../state/store'
import Counts from './Counts'
import type { ThreadStatus } from './feed/feedItems'
import { MenuDivider, Popover } from './Popover'
import Spinner from './Spinner'
import { Mark } from './StepRow'
import { THREAD_STATE_LABELS, type ThreadState } from './thread'
import ThreadCardShell from './ThreadCardShell'
import { liveLine, type LiveLine } from './threadLive'
import ThreadStrand, { type StrandTone } from './ThreadStrand'
import { ThreadIdItem, ThreadOpenItems, ThreadStatusItems } from './threadMenu'
import ThinkingMark from './ThinkingMark'
import { formatElapsed } from './time'
import { useNow } from './useNow'

export function StateIcon({ state, className = 'w-4 h-4' }: { state: ThreadState; className?: string }) {
  if (state === 'working') return <Spinner size={16} className="text-fg" />
  if (state === 'failed') return <WarningGlyph className={`${className} text-danger shrink-0`} />
  // The mark on the button that ended it, so the row says what was done rather
  // than warning about it.
  if (state === 'stopped') return <StopGlyph className={`${className} text-fg-muted shrink-0`} />
  if (state === 'ready') return <EyeGlyph className={`${className} text-fg shrink-0`} />
  if (state === 'archived') return <ArchiveGlyph className={`${className} text-fg-muted shrink-0`} />
  return <CheckGlyph className={`${className} text-fg shrink-0`} />
}

const TONES: Record<ThreadState, StrandTone> = {
  working: 'plain',
  ready: 'plain',
  done: 'plain',
  stopped: 'quiet',
  archived: 'quiet',
  failed: 'danger'
}

const MARK = 'w-[18px] h-[18px]'

export default function ThreadCard({
  thread,
  ts,
  status,
  onOpen
}: {
  thread: ThreadMeta
  ts: number
  status: ThreadStatus
  onOpen: () => void
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const live = status.state === 'working'
  const now = useNow(live)
  const line: LiveLine = live ? liveLine(status.step) : { label: THREAD_STATE_LABELS[status.state] }

  return (
    <>
      <ThreadCardShell
        thread={thread}
        ts={ts}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
      >
        <ThreadStrand
          onOpen={onOpen}
          dashed={thread.ghost}
          mark={
            live ? (
              line.icon ? (
                <Mark icon={line.icon} running />
              ) : (
                <ThinkingMark running />
              )
            ) : (
              <StateIcon state={status.state} className={MARK} />
            )
          }
          label={line.label}
          tone={TONES[status.state]}
          figures={
            <>
              <Counts added={status.added} removed={status.removed} className="mono-inline" />
              {live && status.startedAt !== undefined && (
                <span className="text-fg-muted tabular-nums">{formatElapsed(now - status.startedAt)}</span>
              )}
            </>
          }
        />
      </ThreadCardShell>
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-52">
        <ThreadOpenItems threadId={thread.id} onOpen={onOpen} onDone={() => setMenuAt(null)} />
        <MenuDivider />
        <ThreadStatusItems threadId={thread.id} onDone={() => setMenuAt(null)} />
        <MenuDivider />
        <ThreadIdItem threadId={thread.id} onDone={() => setMenuAt(null)} />
      </Popover>
    </>
  )
}
