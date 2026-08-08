import { ArchiveGlyph, CheckGlyph, EyeGlyph, StopGlyph, WarningGlyph } from '../icons'
import { type ThreadMeta } from '../state/store'
import Counts from './Counts'
import type { ThreadAsk, ThreadStatus } from './feed/feedItems'
import Spinner from './Spinner'
import { Mark } from './StepRow'
import { THREAD_STATE_LABELS, type ThreadState } from './thread'
import ThreadCardShell from './ThreadCardShell'
import ThreadChips from './ThreadChips'
import { liveLine, type LiveLine } from './threadLive'
import ThreadStrand, { type StrandTone } from './ThreadStrand'
import { ThreadIdItem, ThreadOpenItems, ThreadStatusItems } from './threadMenu'
import ThinkingMark from './ThinkingMark'
import RunFigures from './RunFigures'
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
  ask,
  status,
  onOpen
}: {
  thread: ThreadMeta
  ts: number
  ask?: ThreadAsk
  status: ThreadStatus
  onOpen: () => void
}) {
  const { onContextMenu, menu } = useThreadMenu({ threadId: thread.id, status: true, onOpen })
  const live = status.state === 'working'
  const now = useNow(live)
  const line: LiveLine = live ? liveLine(status.step) : { label: THREAD_STATE_LABELS[status.state] }
  const running = live && status.startedAt !== undefined
  const counted = Boolean(status.added || status.removed)

  return (
    <>
      <ThreadCardShell thread={thread} ts={ts} ask={ask} onContextMenu={onContextMenu}>
        <ThreadStrand
          onOpen={onOpen}
          dashed={thread.ghost}
          chips={<ThreadChips thread={thread} />}
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
            running || counted ? (
              <>
                {live && status.startedAt !== undefined && (
                  <RunFigures
                    ms={now - status.startedAt}
                    tokens={status.tokens ?? 0}
                    cost={status.cost}
                    tone="text-fg-muted"
                  />
                )}
                {counted && (
                  <Counts added={status.added} removed={status.removed} size="beside" className="mono-inline" />
                )}
              </>
            ) : undefined
          }
        />
      </ThreadCardShell>
      {menu}
    </>
  )
}
