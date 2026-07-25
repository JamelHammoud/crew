import { SignalIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import type { HuddleRoom } from '../../../../shared/huddle'
import { useHuddle } from '../../state/huddle'
import Avatar from '../Avatar'

function names(room: HuddleRoom): string {
  const all = room.peers.map(peer => peer.name)
  if (all.length === 1) return `${all[0]} is in a huddle`
  if (all.length === 2) return `${all[0]} and ${all[1]} are in a huddle`
  return `${all[0]} and ${all.length - 1} others are in a huddle`
}

// Shown to everyone who is not in the call yet. Dismissing it is per call, so a
// new huddle later still gets noticed.
export default function HuddleBanner() {
  const room = useHuddle(s => s.room)
  const join = useHuddle(s => s.join)
  const joining = useHuddle(s => s.joining)
  const [hidden, setHidden] = useState<number | null>(null)

  useEffect(() => {
    if (room.startedAt === null) setHidden(null)
  }, [room.startedAt])

  if (room.peers.length === 0 || hidden === room.startedAt) return null

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 animate-rise">
      <div className="glass rounded-full pl-4 pr-2 py-2 flex items-center gap-3">
        <SignalIcon className="w-4 h-4 text-positive shrink-0" />
        <span className="flex -space-x-1.5">
          {room.peers.slice(0, 3).map(peer => (
            <Avatar key={peer.peerId} name={peer.name} size="sm" />
          ))}
        </span>
        <span className="text-sm font-medium text-fg whitespace-nowrap">{names(room)}</span>
        <button
          onClick={() => void join()}
          disabled={joining}
          className="h-8 px-4 rounded-full text-sm font-semibold bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-50"
        >
          {joining ? 'Joining' : 'Join'}
        </button>
        <button
          onClick={() => setHidden(room.startedAt)}
          aria-label="Dismiss"
          className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-fg/[0.06] transition-colors active:scale-95"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
