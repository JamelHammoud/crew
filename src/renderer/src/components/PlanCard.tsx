import { ChecklistGlyph } from '../icons'
import type { ThreadMeta } from '../state/store'
import type { ThreadAsk } from './feed/feedItems'
import ThreadCardShell from './ThreadCardShell'
import ThreadChips from './ThreadChips'
import ThreadStrand from './ThreadStrand'
import { useThreadMenu } from './threadMenu'

export default function PlanCard({
  thread,
  ts,
  ask,
  onOpen
}: {
  thread: ThreadMeta
  ts: number
  ask?: ThreadAsk
  onOpen: () => void
}) {
  const { onContextMenu, menu } = useThreadMenu({ threadId: thread.id, onOpen })

  return (
    <>
      <ThreadCardShell thread={thread} ts={ts} ask={ask} onContextMenu={onContextMenu}>
        <ThreadStrand
          onOpen={onOpen}
          dashed={thread.ghost}
          chips={<ThreadChips thread={thread} />}
          mark={<ChecklistGlyph className="w-[18px] h-[18px] text-fg shrink-0" />}
          label="Planning complete"
        />
      </ThreadCardShell>
      {menu}
    </>
  )
}
