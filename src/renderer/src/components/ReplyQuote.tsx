import { ArrowUturnLeftIcon } from '@heroicons/react/16/solid'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import { EmojiText } from './Emoji'

export default function ReplyQuote({
  authorId,
  authorName,
  label,
  text,
  strong
}: {
  authorId?: string
  authorName: string
  label: string
  text: string
  strong?: boolean
}) {
  const agentId = useCrew(s => s.agents.find(a => a.id === authorId)?.id)
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5">
        <ArrowUturnLeftIcon className="h-4 w-4 text-fg-muted" />
        {agentId ? <AgentIcon seed={agentId} size="xs" /> : <Avatar name={authorName} size="xs" />}
      </span>
      <span className={`min-w-0 truncate text-sm font-semibold ${strong ? 'text-fg' : 'text-fg-secondary'}`}>
        {label}
      </span>
      {text && (
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
          <EmojiText text={text} />
        </span>
      )}
    </span>
  )
}
