import { attachmentUrl } from '../../../shared/attachments'
import { UndoGlyph } from '../icons'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import { EmojiText } from './Emoji'
import { replyImage } from './reply'

export default function ReplyQuote({
  targetId,
  authorId,
  authorName,
  label,
  text,
  strong
}: {
  targetId?: string
  authorId?: string
  authorName: string
  label: string
  text: string
  strong?: boolean
}) {
  const agentId = useCrew(s => s.agents.find(a => a.id === authorId)?.id)
  const httpBase = useCrew(s => s.httpBase)
  const image = useCrew(s => replyImage(s.events, targetId))
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5">
        <UndoGlyph className="h-4 w-4 text-fg-muted" />
        {agentId ? <AgentIcon seed={agentId} size="xs" /> : <Avatar name={authorName} size="xs" />}
      </span>
      <span className={`min-w-0 shrink-0 truncate text-sm font-semibold ${strong ? 'text-fg' : 'text-fg-secondary'}`}>
        {label}
      </span>
      {image && httpBase && (
        <img
          src={attachmentUrl(httpBase, image)}
          alt={image.name}
          className="h-5 w-5 shrink-0 rounded-md border border-fg/10 object-cover"
        />
      )}
      {text && (
        <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
          <EmojiText text={text} />
        </span>
      )}
    </span>
  )
}
