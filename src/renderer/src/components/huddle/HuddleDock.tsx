import { SignalIcon } from '@heroicons/react/16/solid'
import { huddleTitle } from '../../../../shared/huddle'
import { useHuddle } from '../../state/huddle'
import { formatClock } from '../time'
import { useNow } from '../useNow'
import HuddleControls from './HuddleControls'
import HuddleTile from './HuddleTile'

const SIZE = { w: 296, h: 168 }
const SHOWN = 4

export default function HuddleDock({
  spot,
  dragging,
  onGrab
}: {
  spot: { x: number; y: number }
  dragging: boolean
  onGrab: (event: React.PointerEvent) => void
}) {
  const room = useHuddle(s => s.room)
  const peerId = useHuddle(s => s.peerId)
  const remote = useHuddle(s => s.remote)
  const link = useHuddle(s => s.link)
  const speaking = useHuddle(s => s.speaking)
  const localCamera = useHuddle(s => s.localCamera)
  const now = useNow(true)

  const shown = room.peers.slice(0, SHOWN)
  const extra = room.peers.length - shown.length

  return (
    <div
      style={{ left: spot.x, top: spot.y, width: SIZE.w }}
      className={`glass fixed z-50 rounded-card p-3 flex flex-col gap-3 animate-pop ${
        dragging ? '' : 'transition-shadow duration-200'
      }`}
    >
      <div
        onPointerDown={onGrab}
        className={`flex items-center gap-2 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <SignalIcon className="w-4 h-4 text-positive shrink-0" />
        <span className="text-sm font-semibold text-fg truncate flex-1">
          {huddleTitle(room, peerId)}
        </span>
        {room.startedAt !== null && (
          <span className="text-xs font-mono text-fg-muted tabular-nums">
            {formatClock(now - room.startedAt)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {shown.map(peer => (
          <div key={peer.peerId} className="flex-1 min-w-0 aspect-square">
            <HuddleTile
              peer={peer}
              self={peer.peerId === peerId}
              camera={peer.peerId === peerId ? localCamera : (remote[peer.peerId]?.camera ?? null)}
              speaking={speaking.includes(peer.peerId)}
              connecting={peer.peerId !== peerId && link[peer.peerId] !== 'connected'}
              size="sm"
            />
          </div>
        ))}
        {extra > 0 && (
          <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-fg-secondary">+{extra}</span>
          </div>
        )}
      </div>

      <HuddleControls />
    </div>
  )
}

export const DOCK_SIZE = SIZE
