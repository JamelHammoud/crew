import { TrashIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import Markdown from './Markdown'
import { MemberName, MentionText } from './Mention'
import MessageReactions from './MessageReactions'
import Pill from './Pill'
import { MenuItem, Popover } from './Popover'
import { usePresence } from './presence'
import Tooltip from './Tooltip'
import MessageImages from './MessageImages'
import type { ThreadItem } from './thread'
import { formatFullTime, formatTime } from './time'

export default function ChatMessage({ item }: { item: ThreadItem }) {
  const presence = usePresence(item.author)
  const agentSeed = useCrew(s => (item.self ? undefined : s.agents.find(a => a.label === item.author)?.id))
  const deleteMessage = useCrew(s => s.deleteMessage)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const deletable = item.kind === 'message' && item.self
  if (item.kind === 'note') {
    return <p className="text-xs text-fg-muted text-center animate-rise">{item.text}</p>
  }
  return (
    <div
      className="group/message relative flex gap-4 animate-rise"
      onContextMenu={
        deletable
          ? event => {
              event.preventDefault()
              setMenuAt({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      {agentSeed ? <AgentIcon seed={agentSeed} presence={presence} /> : <Avatar name={item.author} presence={presence} />}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <MemberName name={item.author}>
            <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
              {item.author}
            </span>
          </MemberName>
          {item.self && <Pill>You</Pill>}
          <Tooltip label={formatFullTime(item.ts)}>
            <span className="text-sm text-fg-faint cursor-default">{formatTime(item.ts)}</span>
          </Tooltip>
        </div>
        {item.kind === 'reply' ? (
          <div className={item.error ? 'text-base text-danger mt-1.5' : 'mt-1.5'}>
            {item.error ? item.text : <Markdown text={item.text || '…'} />}
          </div>
        ) : (
          item.text && (
            <p className="text-base text-fg leading-[22px] whitespace-pre-wrap mt-1">
              <MentionText text={item.text} docMentions={item.docMentions} />
            </p>
          )
        )}
        {item.attachments && <MessageImages attachments={item.attachments} />}
        {item.streaming && <span className="inline-block w-2 h-4 bg-fg-muted animate-pulse mt-1 rounded-sm" />}
        {item.reactionTargetId && (
          <MessageReactions
            targetId={item.reactionTargetId}
            reactions={item.reactions}
            deletable={deletable}
            onDelete={() => deleteMessage(item.key)}
          />
        )}
      </div>
      {deletable && (
        <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined}>
          <MenuItem
            icon={<TrashIcon />}
            label="Delete message"
            danger
            onClick={() => {
              setMenuAt(null)
              deleteMessage(item.key)
            }}
          />
        </Popover>
      )}
    </div>
  )
}
