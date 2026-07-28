import type { ReactNode } from 'react'
import type { CommandName } from '../../../shared/commands'
import { relabelMentions } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import CommandChip from './CommandChip'
import FeedCard from './FeedCard'
import { MentionText } from './Mention'

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

  // The card wears what was asked for, so a plan says so until it is built.
  const chips: CommandName[] = []
  if (thread.mode === 'plan') chips.push('plan')
  if (thread.ghost) chips.push('ghost')

  return (
    <FeedCard
      author={thread.createdBy}
      ts={ts}
      title={<MentionText text={title} />}
      badge={thread.ghost && <Pill>Only you</Pill>}
      dashed={thread.ghost}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
    >
      {children}
    </FeedCard>
  )
}
