import { useState, type ReactNode } from 'react'
import {
  CameraGlyph,
  CameraOffGlyph,
  ChevronDownGlyph,
  CollapseGlyph,
  DesktopGlyph,
  ExpandGlyph,
  LeaveGlyph,
  MicGlyph
} from '../../icons'
import type { InputKind } from '../../media/devices'
import { useHuddle } from '../../state/huddle'
import Tooltip from '../Tooltip'
import DeviceMenu, { PICK } from './DeviceMenu'

// A control that runs on a device can be asked which one, by the notch on its
// corner or by right-clicking it, the way the rest of the app opens a menu.
function Control({
  label,
  kind,
  active,
  danger,
  lit,
  onClick,
  children
}: {
  label: string
  kind?: InputKind
  active?: boolean
  danger?: boolean
  lit?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const tone = danger
    ? 'bg-danger/15 text-danger hover:bg-danger/25'
    : active
      ? 'bg-fg text-ink-900 hover:bg-fg/90'
      : 'bg-fg/[0.08] text-fg-secondary hover:bg-fg/[0.14] hover:text-fg'
  return (
    <span className="group relative flex">
      <Tooltip label={label} disabled={open}>
        <button
          onClick={onClick}
          onContextMenu={
            kind &&
            (event => {
              event.preventDefault()
              setOpen(true)
            })
          }
          aria-label={label}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 ${tone} ${
            lit ? 'shadow-[0_0_0_3px_rgb(255_255_255/0.22)]' : ''
          }`}
        >
          {children}
        </button>
      </Tooltip>
      {kind && (
        <>
          <button
            onClick={() => setOpen(shown => !shown)}
            aria-label={PICK[kind]}
            className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-ink-800 ring-1 ring-fg/10 flex items-center justify-center text-fg/70 transition-opacity duration-150 hover:text-fg focus-visible:opacity-100 ${
              open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <ChevronDownGlyph className="w-2.5 h-2.5" />
          </button>
          <DeviceMenu kind={kind} open={open} onClose={() => setOpen(false)} />
        </>
      )}
    </span>
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
  const talking = useHuddle(s => s.speaking.includes(s.peerId))

  return (
    <div className="flex items-center gap-1.5">
      <Control
        label={micOn ? 'Mute' : 'Unmute'}
        kind="microphone"
        active={micOn}
        lit={micOn && talking}
        onClick={() => void toggleMic()}
      >
        <MicGlyph className="w-[18px] h-[18px]" />
      </Control>
      <Control
        label={cameraOn ? 'Stop video' : 'Start video'}
        kind="camera"
        active={cameraOn}
        onClick={() => void toggleCamera()}
      >
        {cameraOn ? (
          <CameraGlyph className="w-[18px] h-[18px]" />
        ) : (
          <CameraOffGlyph className="w-[18px] h-[18px]" />
        )}
      </Control>
      <Control
        label={sharing ? 'Stop sharing' : 'Share screen'}
        active={sharing}
        onClick={() => (sharing ? stopSharing() : setPicking(true))}
      >
        <DesktopGlyph className="w-[18px] h-[18px]" />
      </Control>
      <Control label={expanded ? 'Shrink' : 'Expand'} onClick={() => setExpanded(!expanded)}>
        {expanded ? (
          <CollapseGlyph className="w-[18px] h-[18px]" />
        ) : (
          <ExpandGlyph className="w-[18px] h-[18px]" />
        )}
      </Control>
      <span className="w-px h-6 bg-fg/[0.08] mx-1" />
      <Control label="Leave" danger onClick={leave}>
        <LeaveGlyph className="w-[18px] h-[18px]" />
      </Control>
    </div>
  )
}
