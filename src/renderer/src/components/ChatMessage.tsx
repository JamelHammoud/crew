import { TrashIcon } from '@heroicons/react/16/solid'
import { useMemo, useState } from 'react'
import { useCrew } from '../state/store'
import Avatar from './Avatar'
import Markdown from './Markdown'
import { AgentMention, MemberName } from './Mention'
import Pill from './Pill'
import { MenuItem, Popover } from './Popover'
import { usePresence } from './presence'
import Tooltip from './Tooltip'
import MessageImages from './MessageImages'
import type { ThreadItem } from './thread'
import { formatFullTime, formatTime } from './time'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function MentionText({ text }: { text: string }) {
  const agents = useCrew(s => s.agents)
  const parts = useMemo(() => {
    const labels = agents.map(a => escapeRegex(a.label)).sort((a, b) => b.length - a.length)
    if (labels.length === 0) return [text]
    return text.split(new RegExp(`(@(?:${labels.join('|')}))`, 'g'))
  }, [agents, text])
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return part
        const agent = agents.find(a => `@${a.label}` === part)
        if (!agent) {
          return (
            <strong key={index} className="font-semibold text-fg">
              {part}
            </strong>
          )
        }
        return (
          <AgentMention key={index} agent={agent}>
            {part}
          </AgentMention>
        )
      })}
    </>
  )
}

export default function ChatMessage({ item }: { item: ThreadItem }) {
  const presence = usePresence(item.author)
  const deleteMessage = useCrew(s => s.deleteMessage)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const deletable = item.kind === 'message' && item.self
  if (item.kind === 'note') {
    return <p className="text-xs text-fg-muted text-center animate-rise">{item.text}</p>
  }
  return (
    <div
      className="flex gap-4 animate-rise"
      onContextMenu={
        deletable
          ? event => {
              event.preventDefault()
              setMenuAt({ x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      <Avatar name={item.author} presence={presence} />
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
              <MentionText text={item.text} />
            </p>
          )
        )}
        {item.attachments && <MessageImages attachments={item.attachments} />}
        {item.streaming && <span className="inline-block w-2 h-4 bg-fg-muted animate-pulse mt-1 rounded-sm" />}
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
