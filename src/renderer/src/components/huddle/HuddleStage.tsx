import { useEffect } from 'react'
import { huddleTitle, sharingPeer } from '../../../../shared/huddle'
import { useHuddle } from '../../state/huddle'
import AvatarStack from '../AvatarStack'
import Spinner from '../Spinner'
import { formatClock } from '../time'
import { useNow } from '../useNow'
import HuddleControls from './HuddleControls'
import HuddleTile from './HuddleTile'
import Live from './Live'
import { fitTiles } from './tiles'
import { useBox } from './useBox'
import { useLive } from './useLive'
import VideoStream from './VideoStream'

const GAP = 12
const RAIL = 232

// Tiles are laid out at a worked-out width rather than in fractions, so a row
// that is not full sits in the middle instead of hugging the left edge.
const span = (columns: number): string => `calc((100% - ${(columns - 1) * GAP}px) / ${columns})`

function Shared({ stream, name, mine }: { stream: MediaStream | null; name: string; mine: boolean }) {
  const live = useLive(stream, true)

  return (
    <div className="flex-1 min-w-0 rounded-card bg-ink-950 ring-1 ring-fg/[0.07] overflow-hidden flex items-center justify-center">
      {live && stream ? (
        <VideoStream stream={stream} contain />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Spinner size={20} className="text-fg-muted" />
          <p className="text-sm text-fg-muted">
            {mine ? 'Setting up your screen' : `Waiting for ${name}'s screen`}
          </p>
        </div>
      )}
    </div>
  )
}

export default function HuddleStage() {
  const room = useHuddle(s => s.room)
  const peerId = useHuddle(s => s.peerId)
  const remote = useHuddle(s => s.remote)
  const link = useHuddle(s => s.link)
  const speaking = useHuddle(s => s.speaking)
  const localCamera = useHuddle(s => s.localCamera)
  const localScreen = useHuddle(s => s.localScreen)
  const setExpanded = useHuddle(s => s.setExpanded)
  const picking = useHuddle(s => s.picking)
  const [attach, box] = useBox()
  const now = useNow(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !useHuddle.getState().picking) setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setExpanded])

  const shared = sharingPeer(room)
  const screen = shared ? (shared.peerId === peerId ? localScreen : (remote[shared.peerId]?.screen ?? null)) : null
  const cameraFor = (id: string): MediaStream | null =>
    id === peerId ? localCamera : (remote[id]?.camera ?? null)

  const grid = fitTiles(room.peers.length, box.width, box.height, GAP)
  const tile = (peer: (typeof room.peers)[number], size: 'sm' | 'lg') => (
    <HuddleTile
      key={peer.peerId}
      peer={peer}
      self={peer.peerId === peerId}
      camera={cameraFor(peer.peerId)}
      speaking={speaking.includes(peer.peerId)}
      connecting={peer.peerId !== peerId && link[peer.peerId] !== 'connected'}
      size={size}
      face={size === 'lg' && grid.width > 0 ? Math.round(grid.width * 0.15) : undefined}
    />
  )

  return (
    <div className={`fixed inset-0 z-50 bg-ink-900 flex flex-col ${picking ? '' : 'animate-pop'}`}>
      <header className="app-drag shrink-0 h-[70px] flex items-center gap-3 px-6 mac:pl-[92px]">
        <Live />
        <AvatarStack names={room.peers.map(peer => peer.name)} size="md" />
        <span className="text-lg font-semibold text-fg truncate">{huddleTitle(room, peerId)}</span>
        {room.startedAt !== null && (
          <span className="text-sm font-mono text-fg-muted tabular-nums">
            {formatClock(now - room.startedAt)}
          </span>
        )}
      </header>

      {shared ? (
        <div className="flex-1 min-h-0 flex gap-3 px-6 pb-2">
          <Shared stream={screen} name={shared.name} mine={shared.peerId === peerId} />
          <div className="shrink-0 flex flex-col gap-3 overflow-y-auto" style={{ width: RAIL }}>
            {room.peers.map(peer => tile(peer, 'sm'))}
          </div>
        </div>
      ) : (
        <div ref={attach} className="flex-1 min-h-0 px-6 pb-2 flex items-center justify-center">
          <div className="flex flex-wrap justify-center content-center" style={{ gap: GAP }}>
            {room.peers.map(peer => (
              <div key={peer.peerId} style={{ width: grid.width > 0 ? grid.width : span(grid.columns) }}>
                {tile(peer, 'lg')}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="shrink-0 flex justify-center py-5">
        <div className="glass rounded-full px-3 py-2.5">
          <HuddleControls />
        </div>
      </div>
    </div>
  )
}
