import type { PointerEvent } from 'react'
import { huddleTitle } from '../../../../shared/huddle'
import { useHuddle } from '../../state/huddle'
import { formatClock } from '../time'
import { useNow } from '../useNow'
import HuddleControls from './HuddleControls'
import HuddleTile from './HuddleTile'
import Live from './Live'

const WIDTH = 320
const SHOWN = 4

export default function HuddleDock({
  spot,
  dragging,
  onGrab,
  attach
}: {
  spot: { x: number; y: number }
  dragging: boolean
  onGrab: (event: PointerEvent) => void
  attach: (node: HTMLDivElement | null) => void
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
  const columns = shown.length > 1 ? 2 : 1

  return (
    <div
      style={{ left: spot.x, top: spot.y, width: SIZE.w }}
      className={`glass fixed z-50 rounded-card p-2.5 flex flex-col gap-2.5 animate-pop ${
        dragging ? '' : 'transition-shadow duration-200'
      }`}
    >
      <div
        onPointerDown={onGrab}
        className={`flex items-center gap-2 px-1 pt-0.5 select-none ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <Live />
        <span className="text-sm font-semibold text-fg truncate flex-1">
          {huddleTitle(room, peerId)}
        </span>
        {room.startedAt !== null && (
          <span className="text-xs font-mono text-fg-muted tabular-nums">
            {formatClock(now - room.startedAt)}
          </span>
        )}
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {shown.map((peer, index) => (
          <div key={peer.peerId} className="relative">
            <HuddleTile
              peer={peer}
              self={peer.peerId === peerId}
              camera={peer.peerId === peerId ? localCamera : (remote[peer.peerId]?.camera ?? null)}
              speaking={speaking.includes(peer.peerId)}
              connecting={peer.peerId !== peerId && link[peer.peerId] !== 'connected'}
              size="sm"
            />
            {extra > 0 && index === shown.length - 1 && (
              <div className="absolute inset-0 rounded-xl bg-ink-950/65 backdrop-blur-[2px] flex items-center justify-center">
                <span className="text-sm font-semibold text-fg">+{extra}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <HuddleControls />
      </div>
    </div>
  )
}

export const DOCK_SIZE = SIZE
