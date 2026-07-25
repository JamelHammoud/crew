import { SignalIcon } from '@heroicons/react/16/solid'
import { useEffect } from 'react'
import { huddleTitle, sharingPeer } from '../../../../shared/huddle'
import { useHuddle } from '../../state/huddle'
import Spinner from '../Spinner'
import { formatClock } from '../time'
import { useNow } from '../useNow'
import HuddleControls from './HuddleControls'
import HuddleTile from './HuddleTile'
import { gridColumns } from './tiles'
import VideoStream from './VideoStream'

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
  const now = useNow(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !useHuddle.getState().picking) setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setExpanded])

  const shared = sharingPeer(room)
  const screen = shared
    ? shared.peerId === peerId
      ? localScreen
      : (remote[shared.peerId]?.screen ?? null)
    : null

  const cameraFor = (id: string) => (id === peerId ? localCamera : (remote[id]?.camera ?? null))
  const columns = gridColumns(room.peers.length)

  return (
    <div className={`fixed inset-0 z-50 bg-ink-950 flex flex-col ${picking ? '' : 'animate-pop'}`}>
      <header className="app-drag shrink-0 h-[70px] flex items-center gap-3 px-6 pl-[92px]">
        <SignalIcon className="w-4 h-4 text-positive shrink-0" />
        <span className="text-lg font-semibold text-fg truncate">{huddleTitle(room, peerId)}</span>
        {room.startedAt !== null && (
          <span className="text-sm font-mono text-fg-muted tabular-nums">
            {formatClock(now - room.startedAt)}
          </span>
        )}
      </header>

      {shared ? (
        <div className="flex-1 min-h-0 flex gap-3 px-6 pb-3">
          <div className="flex-1 min-w-0 rounded-card bg-ink-900 overflow-hidden flex items-center justify-center">
            {screen ? (
              <VideoStream stream={screen} contain />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Spinner size={20} className="text-fg-muted" />
                <p className="text-sm text-fg-muted">Waiting for {shared.name}'s screen</p>
              </div>
            )}
          </div>
          <div className="w-44 shrink-0 flex flex-col gap-3 overflow-y-auto">
            {room.peers.map(peer => (
              <div key={peer.peerId} className="aspect-video shrink-0">
                <HuddleTile
                  peer={peer}
                  self={peer.peerId === peerId}
                  camera={cameraFor(peer.peerId)}
                  speaking={speaking.includes(peer.peerId)}
                  connecting={peer.peerId !== peerId && link[peer.peerId] !== 'connected'}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-6 pb-3 overflow-y-auto">
          <div
            className="grid gap-3 h-full content-center"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {room.peers.map(peer => (
              <div key={peer.peerId} className="aspect-video min-h-0">
                <HuddleTile
                  peer={peer}
                  self={peer.peerId === peerId}
                  camera={cameraFor(peer.peerId)}
                  speaking={speaking.includes(peer.peerId)}
                  connecting={peer.peerId !== peerId && link[peer.peerId] !== 'connected'}
                  size="lg"
                />
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
