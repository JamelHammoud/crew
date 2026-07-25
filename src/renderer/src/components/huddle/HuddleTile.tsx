import { ComputerDesktopIcon, MicrophoneIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import type { HuddlePeer } from '../../../../shared/huddle'
import { useTheme } from '../../state/theme'
import Avatar from '../Avatar'
import { avatarColors } from '../avatarColor'
import InsetRing from '../InsetRing'
import Pill from '../Pill'
import Spinner from '../Spinner'
import VideoStream from './VideoStream'
import { useLive } from './useLive'

type Size = 'sm' | 'md' | 'lg'

const LOOK: Record<
  Size,
  { corner: string; avatar: 'sm' | 'md' | 'lg'; label: string; pad: string; bloom: string }
> = {
  sm: {
    corner: 'rounded-xl',
    avatar: 'sm',
    label: 'text-[10px]',
    pad: 'p-1.5',
    bloom: 'shadow-[inset_0_0_12px_-4px_rgb(255_255_255/0.4)]'
  },
  md: {
    corner: 'rounded-2xl',
    avatar: 'md',
    label: 'text-xs',
    pad: 'p-2',
    bloom: 'shadow-[inset_0_0_20px_-7px_rgb(255_255_255/0.4)]'
  },
  lg: {
    corner: 'rounded-card',
    avatar: 'lg',
    label: 'text-sm',
    pad: 'p-3',
    bloom: 'shadow-[inset_0_0_32px_-12px_rgb(255_255_255/0.4)]'
  }
}

function Badge({ tone, children }: { tone: 'quiet' | 'danger'; children: ReactNode }) {
  return (
    <span
      className={`h-6 px-2 rounded-full flex items-center gap-1 backdrop-blur-md ${
        tone === 'danger' ? 'bg-danger/20 text-danger' : 'bg-ink-950/55 text-fg-secondary'
      }`}
    >
      {children}
    </span>
  )
}

export default function HuddleTile({
  peer,
  self,
  camera,
  speaking,
  connecting,
  size = 'md',
  face
}: {
  peer: HuddlePeer
  self: boolean
  camera: MediaStream | null
  speaking: boolean
  connecting: boolean
  size?: Size
  face?: number
}) {
  const look = LOOK[size]
  const live = useLive(camera, peer.camera)
  const colors = avatarColors(peer.name, useTheme() === 'light')

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden bg-gradient-to-b from-ink-800 to-ink-850 ${look.corner}`}
    >
      <div className={`absolute inset-0 flex items-center justify-center ${connecting ? 'opacity-30' : ''}`}>
        {live && camera ? (
          <VideoStream stream={camera} mirror={self} />
        ) : (
          <>
            <span
              className="absolute inset-0"
              style={{
                background: `radial-gradient(58% 78% at 50% 46%, color-mix(in oklab, ${colors.background} 55%, transparent), transparent 72%)`
              }}
            />
            <span className="relative block">
              <Avatar name={peer.name} size={look.avatar} px={face} />
            </span>
          </>
        )}
      </div>

      {connecting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size={size === 'sm' ? 14 : 18} className="text-fg-muted" />
        </div>
      )}

      {peer.sharing && size !== 'sm' && (
        <div className={`absolute top-0 left-0 ${look.pad}`}>
          <Badge tone="quiet">
            <ComputerDesktopIcon className="w-3 h-3" />
            <span className="text-[11px] font-medium">Sharing</span>
          </Badge>
        </div>
      )}

      <div className={`absolute inset-x-0 bottom-0 flex items-end gap-1.5 ${look.pad} pointer-events-none`}>
        <span className="min-w-0 h-6 pl-2 pr-2.5 rounded-full bg-ink-950/55 backdrop-blur-md flex items-center gap-1.5">
          {peer.muted && <MicrophoneIcon className="w-3 h-3 shrink-0 text-danger" />}
          <span className={`${look.label} font-medium text-fg truncate`}>{peer.name}</span>
        </span>
        {self && size !== 'sm' && <Pill>You</Pill>}
      </div>

      <InsetRing
        className={`transition-all duration-200 ${
          speaking
            ? 'border-2 border-fg shadow-[inset_0_0_24px_-4px_rgb(255_255_255/0.45)]'
            : 'border border-fg/[0.07]'
        }`}
      />
    </div>
  )
}
