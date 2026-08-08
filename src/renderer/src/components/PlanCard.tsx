import { ChecklistGlyph } from '../icons'
import type { ThreadMeta } from '../state/store'
import AgentIcon from './AgentIcon'
import Clamped from './Clamped'
import type { ThreadAsk } from './feed/feedItems'
import Markdown from './Markdown'
import ThreadCardShell from './ThreadCardShell'
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
        <Clamped lines={14} watch={thread.plan} className="mt-1 text-base leading-[22px]">
          <Markdown text={thread.plan ?? ''} />
        </Clamped>
        <ThreadStrand
          onOpen={onOpen}
          dashed={thread.ghost}
          face={<AgentIcon seed={thread.agentId} px={44} />}
          mark={<ChecklistGlyph className="w-[18px] h-[18px] text-fg shrink-0" />}
          label="Planning complete"
        />
      </ThreadCardShell>
      {menu}
    </>
  )
}
