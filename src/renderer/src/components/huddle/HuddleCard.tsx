import { useState } from 'react'
import { SignalOffGlyph, TrashGlyph } from '../../icons'
import { useHuddle } from '../../state/huddle'
import { useCrew } from '../../state/store'
import AvatarStack from '../AvatarStack'
import FeedCard from '../FeedCard'
import { MenuItem, Popover } from '../Popover'
import { formatElapsed, formatSpan } from '../time'
import { useNow } from '../useNow'
import Live from './Live'
import { nameList, type HuddleRecord } from './log'

// A call in the feed. While it is going the block is the way into it, and once
// it is over it is what the crew missed: who was there and how long it ran.
export default function HuddleCard({ record }: { record: HuddleRecord }) {
  const room = useHuddle(s => s.room)
  const joined = useHuddle(s => s.joined)
  const joining = useHuddle(s => s.joining)
  const join = useHuddle(s => s.join)
  const selfId = useCrew(s => s.selfId)
  const deleteHuddle = useCrew(s => s.deleteHuddle)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const live = room.id === record.id && room.peers.length > 0
  const now = useNow(live)
  // Two windows on one folder are two people in the call and one name in the
  // crew, so the block names them once either way.
  const names = live ? [...new Set(room.peers.map(peer => peer.name))] : record.names
  const detail = live
    ? formatElapsed(now - (room.startedAt ?? record.ts))
    : record.ms === null
      ? 'Ended'
      : `Lasted ${formatSpan(record.ms)}`

  const deletable = record.byId === selfId && !live

  return (
    <>
      <FeedCard
        author={record.by}
        ts={record.ts}
        title="Huddle"
        onContextMenu={
          deletable
            ? event => {
                event.preventDefault()
                setMenuAt({ x: event.clientX, y: event.clientY })
              }
            : undefined
        }
      >
        <div className="w-full bg-ink-700 px-5 h-[52px] flex items-center gap-3">
        {live ? <Live /> : <SignalOffGlyph className="w-4 h-4 text-fg-muted shrink-0" />}
        <AvatarStack names={names} />
        <span className="text-base font-semibold text-fg truncate">{nameList(names)}</span>
        <span className="text-base text-fg-muted truncate flex-1">{detail}</span>
        {live && !joined && (
          <button
            onClick={() => void join()}
            disabled={joining}
            className="h-8 px-4 shrink-0 rounded-full text-sm font-semibold bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-50"
          >
            {joining ? 'Joining' : 'Join'}
          </button>
        )}
      </div>
    </FeedCard>
  )
}
