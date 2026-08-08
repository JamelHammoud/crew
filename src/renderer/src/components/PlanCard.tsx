import { ChecklistGlyph } from '../icons'
import type { ThreadMeta } from '../state/store'
import Markdown from './Markdown'
import ThreadCardShell from './ThreadCardShell'
import ThreadStatusBar from './ThreadStatusBar'
import { useThreadMenu } from './threadMenu'

export default function PlanCard({ thread, ts, onOpen }: { thread: ThreadMeta; ts: number; onOpen: () => void }) {
  const { onContextMenu, menu } = useThreadMenu({ threadId: thread.id, onOpen })

  return (
    <>
      <ThreadCardShell thread={thread} ts={ts} onOpen={onOpen} onContextMenu={onContextMenu}>
        <div
          className="relative max-h-72 overflow-hidden px-5 pb-2"
          onClick={event => {
            if ((event.target as HTMLElement).closest('a')) event.stopPropagation()
          }}
        >
          <Markdown text={thread.plan ?? ''} />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-900 to-transparent pointer-events-none" />
        </div>
        <ThreadStatusBar
          mark={<ChecklistGlyph className="w-[18px] h-[18px] text-fg shrink-0" />}
          label="Planning complete"
        />
      </ThreadCardShell>
      {menu}
    </>
  )
}
