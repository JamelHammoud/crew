import type { ReactNode } from 'react'
import { relabelMentions } from '../../../shared/llm'
import { useCrew, type ThreadMeta } from '../state/store'
import Avatar from './Avatar'
import { MemberName, MentionText } from './Mention'
import { usePresence } from './presence'
import Tooltip from './Tooltip'
import { formatFullTime, formatTime } from './time'

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
  const presence = usePresence(thread.createdBy)
  const agents = useCrew(s => s.agents)

  // The title is brought up to date before the agent's name is put in front of
  // it, so a renamed agent is not named twice.
  const written = relabelMentions(thread.title, thread.titleRefs, agents)
  const prefix = `@${thread.agentLabel}`
  const title = written.toLowerCase().startsWith(prefix.toLowerCase()) ? written : `${prefix} ${written}`

  return (
    <div className="flex gap-4 animate-rise" onContextMenu={onContextMenu}>
      <Avatar name={thread.createdBy} presence={presence} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <MemberName name={thread.createdBy}>
            <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
              {thread.createdBy}
            </span>
          </MemberName>
          <Tooltip label={formatFullTime(ts)}>
            <span className="text-sm text-fg-faint cursor-default">{formatTime(ts)}</span>
          </Tooltip>
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={event => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onOpen()
          }}
          className="group mt-2 border border-ink-700 rounded-card overflow-hidden cursor-pointer transition-colors duration-200 hover:border-ink-600"
        >
          <p className="px-5 py-4 text-base text-fg leading-[22px] truncate">
            <MentionText text={title} />
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
