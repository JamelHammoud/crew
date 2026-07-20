import Avatar from './Avatar'
import Markdown from './Markdown'
import type { ThreadItem } from './thread'
import { formatTime } from './time'

export default function ChatMessage({ item }: { item: ThreadItem }) {
  if (item.kind === 'note') {
    return <p className="text-xs text-zinc-500 text-center">{item.text}</p>
  }
  return (
    <div className="flex gap-3">
      <Avatar name={item.author} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-zinc-100">{item.self ? `${item.author} (you)` : item.author}</span>
          <span className="text-[11px] text-zinc-500">{formatTime(item.ts)}</span>
        </div>
        {item.kind === 'reply' ? (
          <div className={item.error ? 'text-sm text-red-400 mt-1' : 'mt-1'}>
            {item.error ? item.text : <Markdown text={item.text || '…'} />}
          </div>
        ) : (
          <p className="text-sm text-zinc-200 whitespace-pre-wrap mt-1">{item.text}</p>
        )}
        {item.streaming && <span className="inline-block w-2 h-4 bg-zinc-500 animate-pulse mt-1" />}
      </div>
    </div>
  )
}
