import { useState } from 'react'
import { ArchiveGlyph, CheckGlyph, EyeGlyph, StopGlyph, WarningGlyph } from '../icons'
import { type ThreadMeta } from '../state/store'
import Counts from './Counts'
import type { ThreadStatus } from './feed/feedItems'
import { isPrivate, labelFor, PrivateChip, useLocated } from './fileLinks'
import { MenuDivider, Popover } from './Popover'
import RunFigures from './RunFigures'
import Spinner from './Spinner'
import { Mark } from './StepRow'
import { THREAD_STATE_LABELS, type ThreadState } from './thread'
import ThreadCardShell from './ThreadCardShell'
import { liveLine, type LiveLine } from './threadLive'
import ThreadStatusBar, { type StatusTone } from './ThreadStatusBar'
import { ThreadIdItem, ThreadOpenItems, ThreadStatusItems } from './threadMenu'
import ThinkingMark from './ThinkingMark'
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

// A state somebody decided is as quiet as the decision was. Failing is the one
// thing on a card worth a color, and the mark and the word take the same one so
// the row reads as one thing rather than as a mark beside a label.
const TONES: Record<ThreadState, StatusTone> = {
  working: 'plain',
  ready: 'plain',
  done: 'plain',
  stopped: 'quiet',
  archived: 'quiet',
  failed: 'danger'
}

const MARK = 'w-[18px] h-[18px]'

function Subject({ line }: { line: LiveLine }) {
  useLocated(line.path ? [line.path] : [])
  if (!line.subject) return null
  if (line.path && isPrivate(line.path)) return <PrivateChip />
  return (
    <span className={`min-w-0 truncate text-xs text-fg-faint ${line.mono ? 'mono-inline' : ''}`}>
      {line.path ? labelFor(line.path, '', line.subject) : line.subject}
    </span>
  )
}

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
  // The card counts its own seconds, so a run in one thread does not draw the
  // whole feed again once a second.
  const now = useNow(live)
  const line: LiveLine = live
    ? liveLine(status.step)
    : { label: THREAD_STATE_LABELS[status.state], subject: status.detail, mono: false, dots: false }
  const ms = live ? (status.startedAt === undefined ? undefined : now - status.startedAt) : status.ms

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
          subject={<Subject line={line} />}
          figures={
            <>
              {ms !== undefined && <RunFigures ms={ms} tokens={status.tokens ?? 0} cost={status.cost} />}
              <Counts added={status.added} removed={status.removed} className="mono-inline" />
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
