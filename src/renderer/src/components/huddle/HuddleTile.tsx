import { ComputerDesktopIcon, MicrophoneIcon } from '@heroicons/react/16/solid'
import type { HuddlePeer } from '../../../../shared/huddle'
import Avatar from '../Avatar'
import Pill from '../Pill'
import Spinner from '../Spinner'
import VideoStream from './VideoStream'

const AVATAR = { sm: 'sm', md: 'md', lg: 'lg' } as const

export default function HuddleTile({
  peer,
  self,
  camera,
  speaking,
  connecting,
  size = 'md'
}: {
  peer: HuddlePeer
  self: boolean
  camera: MediaStream | null
  speaking: boolean
  connecting: boolean
  size?: keyof typeof AVATAR
}) {
  return (
    <div
      className={`relative overflow-hidden bg-ink-800 transition-all duration-200 ${
        size === 'sm' ? 'rounded-xl' : 'rounded-2xl'
      } ${speaking ? 'ring-2 ring-fg' : 'ring-1 ring-fg/[0.06]'}`}
    >
      <div className="w-full h-full flex items-center justify-center">
        {camera && peer.camera ? (
          <VideoStream stream={camera} mirror={self} />
        ) : (
          <Avatar name={peer.name} size={AVATAR[size]} />
        )}
      </div>

      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60">
          <Spinner size={16} className="text-fg-muted" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2 flex items-end justify-between gap-2 bg-gradient-to-t from-ink-900/80 to-transparent pointer-events-none">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-fg truncate">{peer.name}</span>
          {self && <Pill>You</Pill>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {peer.sharing && (
            <span className="w-5 h-5 rounded-full bg-fg/10 flex items-center justify-center">
              <ComputerDesktopIcon className="w-3 h-3 text-fg-secondary" />
            </span>
          )}
          {peer.muted && (
            <span className="w-5 h-5 rounded-full bg-danger/15 flex items-center justify-center">
              <MicrophoneIcon className="w-3 h-3 text-danger" />
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
