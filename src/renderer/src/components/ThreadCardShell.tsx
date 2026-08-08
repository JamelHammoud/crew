import type { ReactNode } from 'react'
import type { CommandName } from '../../../shared/commands'
import { relabelMentions } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import CommandChip from './CommandChip'
import { FeedBlock } from './FeedCard'
import { MentionText } from './Mention'

// A thread in the feed is the ask somebody wrote with the thread hanging under
// it, rather than a card drawn around the pair. The ask is a message and reads
// as one, so nothing is boxed and the strand underneath is the only thing to
// press.
export default function ThreadCardShell({
  thread,
  ts,
  onContextMenu,
  children
}: {
  thread: ThreadMeta
  ts: number
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
  if (thread.voice) chips.push('voice')
  if (thread.forkedFrom) chips.push('fork')

  return (
    <FeedBlock author={thread.createdBy} ts={ts} onContextMenu={onContextMenu}>
      <div className="mt-1 flex items-start gap-2.5">
        <p className="min-w-0 flex-1 text-base text-fg leading-[22px] line-clamp-5 whitespace-pre-wrap break-words">
          <MentionText text={title} />
        </p>
        {chips.length > 0 && (
          <span className="shrink-0 flex items-center gap-1.5">
            {chips.map(name => (
              <CommandChip key={name} name={name} />
            ))}
          </span>
        )}
      </div>
      {children}
    </FeedBlock>
  )
}
