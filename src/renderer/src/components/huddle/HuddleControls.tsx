import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  ComputerDesktopIcon,
  MicrophoneIcon,
  PhoneXMarkIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon
} from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import Tooltip from '../Tooltip'
import { useHuddle } from '../../state/huddle'

function Control({
  label,
  active,
  danger,
  lit,
  onClick,
  children
}: {
  label: string
  active?: boolean
  danger?: boolean
  lit?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const tone = danger
    ? 'bg-danger/15 text-danger hover:bg-danger/25'
    : active
      ? 'bg-fg text-ink-900 hover:bg-fg/90'
      : 'bg-fg/[0.08] text-fg-secondary hover:bg-fg/[0.14] hover:text-fg'
  return (
    <Tooltip label={label}>
      <button
        onClick={onClick}
        aria-label={label}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${tone} ${
          lit ? 'shadow-[0_0_0_3px_rgb(255_255_255/0.22)]' : ''
        }`}
      >
        {children}
      </button>
    </Tooltip>
  )
}

export default function HuddleControls() {
  const micOn = useHuddle(s => s.micOn)
  const cameraOn = useHuddle(s => s.cameraOn)
  const sharing = useHuddle(s => s.sharing)
  const expanded = useHuddle(s => s.expanded)
  const toggleMic = useHuddle(s => s.toggleMic)
  const toggleCamera = useHuddle(s => s.toggleCamera)
  const stopSharing = useHuddle(s => s.stopSharing)
  const setPicking = useHuddle(s => s.setPicking)
  const setExpanded = useHuddle(s => s.setExpanded)
  const leave = useHuddle(s => s.leave)

  return (
    <div className="flex items-center gap-1.5">
      <Control label={micOn ? 'Mute' : 'Unmute'} active={micOn} onClick={() => void toggleMic()}>
        <MicrophoneIcon className="w-[18px] h-[18px]" />
      </Control>
      <Control
        label={cameraOn ? 'Stop video' : 'Start video'}
        active={cameraOn}
        onClick={() => void toggleCamera()}
      >
        {cameraOn ? (
          <VideoCameraIcon className="w-[18px] h-[18px]" />
        ) : (
          <VideoCameraSlashIcon className="w-[18px] h-[18px]" />
        )}
      </Control>
      <Control
        label={sharing ? 'Stop sharing' : 'Share screen'}
        active={sharing}
        onClick={() => (sharing ? stopSharing() : setPicking(true))}
      >
        <ComputerDesktopIcon className="w-[18px] h-[18px]" />
      </Control>
      <Control label={expanded ? 'Shrink' : 'Expand'} onClick={() => setExpanded(!expanded)}>
        {expanded ? (
          <ArrowsPointingInIcon className="w-[18px] h-[18px]" />
        ) : (
          <ArrowsPointingOutIcon className="w-[18px] h-[18px]" />
        )}
      </Control>
      <span className="w-px h-6 bg-fg/[0.08] mx-1" />
      <Control label="Leave" danger onClick={leave}>
        <PhoneXMarkIcon className="w-[18px] h-[18px]" />
      </Control>
    </div>
  )
}
