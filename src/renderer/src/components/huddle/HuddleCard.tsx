import { SignalSlashIcon } from '@heroicons/react/16/solid'
import { useHuddle } from '../../state/huddle'
import AvatarStack from '../AvatarStack'
import FeedCard from '../FeedCard'
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

  const live = room.id === record.id && room.peers.length > 0
  const now = useNow(live)
  const names = live ? room.peers.map(peer => peer.name) : record.names
  const detail = live
    ? formatElapsed(now - (room.startedAt ?? record.ts))
    : record.ms === null
      ? 'Ended'
      : `Lasted ${formatSpan(record.ms)}`

  return (
    <FeedCard author={record.by} ts={record.ts} title="Huddle">
      <div className="w-full bg-ink-700 px-5 h-[52px] flex items-center gap-3">
        {live ? <Live /> : <SignalSlashIcon className="w-4 h-4 text-fg-muted shrink-0" />}
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
