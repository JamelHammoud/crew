import type { ReactNode } from 'react'
import Avatar from './Avatar'
import { MemberName } from './Mention'
import { usePresence } from './presence'
import Tooltip from './Tooltip'
import { formatFullTime, formatTime } from './time'

// Anything in the feed that is a card rather than a message: who it came from,
// when, and a bordered box under them. `onOpen` is what makes the box itself
// the button, so a card whose action lives inside it leaves it out.
export default function FeedCard({
  author,
  ts,
  title,
  badge,
  dashed,
  onOpen,
  onContextMenu,
  children
}: {
  author: string
  ts: number
  title: ReactNode
  badge?: ReactNode
  dashed?: boolean
  onOpen?: () => void
  onContextMenu?: (event: React.MouseEvent) => void
  children?: ReactNode
}) {
  const presence = usePresence(author)

  return (
    <div className="flex items-start gap-4 animate-rise" onContextMenu={onContextMenu}>
      <Avatar name={author} presence={presence} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline gap-2.5">
          <MemberName name={author}>
            <span className="text-base font-semibold text-fg-muted transition-colors hover:text-fg-secondary cursor-default">
              {author}
            </span>
          </MemberName>
          <Tooltip label={formatFullTime(ts)}>
            <span className="text-sm text-fg-faint cursor-default">{formatTime(ts)}</span>
          </Tooltip>
        </div>
        <div
          role={onOpen ? 'button' : undefined}
          tabIndex={onOpen ? 0 : undefined}
          onClick={onOpen}
          onKeyDown={event => {
            if (!onOpen || (event.key !== 'Enter' && event.key !== ' ')) return
            event.preventDefault()
            onOpen()
          }}
          className={`group mt-2 border border-ink-700 rounded-card overflow-hidden transition-colors duration-200 ${
            onOpen ? 'cursor-pointer hover:border-ink-600' : ''
          }`}
        >
          <p className="px-5 py-4 text-base text-fg leading-[22px] truncate">{title}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
