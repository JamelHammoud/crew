import type { ReactNode } from 'react'
import { relabelMentions } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import FeedCard from './FeedCard'
import { MentionText } from './Mention'
import Pill from './Pill'

export default function ThreadCardShell({
  thread,
  ts,
  onOpen,
  onContextMenu,
  children
}: {
  thread: ThreadMeta
  ts: number
  onOpen: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  children: ReactNode
}) {
  const agents = useCrew(s => s.agents)

  // The title is brought up to date before the agent's name is put in front of
  // it, so a renamed agent is not named twice.
  const written = relabelMentions(thread.title, thread.titleRefs, agents)
  const prefix = `@${thread.agentLabel}`
  const title = written.toLowerCase().startsWith(prefix.toLowerCase()) ? written : `${prefix} ${written}`

  return (
    <FeedCard
      author={thread.createdBy}
      ts={ts}
      title={<MentionText text={title} />}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
    >
      {children}
    </FeedCard>
  )
}
