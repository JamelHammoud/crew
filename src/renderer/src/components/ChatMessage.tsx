import { useMemo } from 'react'
import { useCrew } from '../state/store'
import Avatar from './Avatar'
import Markdown from './Markdown'
import Pill from './Pill'
import MessageImages from './MessageImages'
import type { ThreadItem } from './thread'
import { formatTime } from './time'

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
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-fg">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

export default function ChatMessage({ item }: { item: ThreadItem }) {
  if (item.kind === 'note') {
    return <p className="text-xs text-fg-muted text-center animate-rise">{item.text}</p>
  }
  return (
    <div className="flex gap-4 animate-rise">
      <Avatar name={item.author} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-base font-semibold text-fg-muted">{item.author}</span>
          {item.self && <Pill>You</Pill>}
          <span className="text-sm text-fg-faint">{formatTime(item.ts)}</span>
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
    </div>
  )
}
