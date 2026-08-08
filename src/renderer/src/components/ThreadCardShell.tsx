import type { ReactNode } from 'react'
import { relabelMentions } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import type { ThreadAsk } from './feed/feedItems'
import { FeedBlock } from './FeedCard'
import MessagePreview from './MessagePreview'
import MessageReactions from './MessageReactions'

export default function ThreadCardShell({
  thread,
  ts,
  ask,
  onContextMenu,
  children
}: {
  thread: ThreadMeta
  ts: number
  ask?: ThreadAsk
  onContextMenu?: (event: React.MouseEvent) => void
  children: ReactNode
}) {
  const agents = useCrew(s => s.agents)

  // The title is brought up to date before the agent's name is put in front of
  // it, so a renamed agent is not named twice.
  const refs = ask ? ask.mentionRefs : thread.titleRefs
  const written = relabelMentions(ask ? ask.text : thread.title, refs, agents).trim()
  const prefix = `@${thread.agentLabel}`
  const named = written.toLowerCase().startsWith(prefix.toLowerCase()) ? written : `${prefix} ${written}`

  return (
    <FeedBlock author={thread.createdBy} ts={ts} thread={thread.id} onContextMenu={onContextMenu}>
      <MessagePreview text={named} mentionRefs={refs} lines={5} className="mt-1 text-base leading-[22px] text-fg" />
      {children}
    </FeedBlock>
  )
}
