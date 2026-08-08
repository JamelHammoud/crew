import { ChecklistGlyph } from '../icons'
import type { ThreadMeta } from '../state/store'
import Markdown from './Markdown'
import ThreadCardShell from './ThreadCardShell'
import ThreadStrand from './ThreadStrand'
import { useThreadMenu } from './threadMenu'

export default function PlanCard({ thread, ts, onOpen }: { thread: ThreadMeta; ts: number; onOpen: () => void }) {
  const { onContextMenu, menu } = useThreadMenu({ threadId: thread.id, onOpen })

  return (
    <>
      <ThreadCardShell thread={thread} ts={ts} onContextMenu={onContextMenu}>
        <div className="relative mt-1 max-h-72 overflow-hidden">
          <Markdown text={thread.plan ?? ''} />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none" />
        </div>
        <ThreadStrand
          onOpen={onOpen}
          dashed={thread.ghost}
          mark={<ChecklistGlyph className="w-[18px] h-[18px] text-fg shrink-0" />}
          label="Planning complete"
        />
      </ThreadCardShell>
      {menu}
    </>
  )
}
