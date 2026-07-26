import type { InputKind } from '../../media/devices'
import { useHuddle } from '../../state/huddle'
import { MenuItem, Popover } from '../Popover'
import { useInputDevices } from './useInputDevices'

export const PICK: Record<InputKind, string> = {
  microphone: 'Choose a microphone',
  camera: 'Choose a camera'
}

const TITLES: Record<InputKind, string> = { microphone: 'Microphone', camera: 'Camera' }
const NONE: Record<InputKind, string> = {
  microphone: 'Nothing to listen with yet.',
  camera: 'Nothing to see with yet.'
}
const FIX: Record<InputKind, string> = {
  microphone: 'Open microphone settings',
  camera: 'Open camera settings'
}

export default function DeviceMenu({
  kind,
  open,
  onClose
}: {
  kind: InputKind
  open: boolean
  onClose: () => void
}) {
  const devices = useInputDevices(kind, open)
  const chosen = useHuddle(s => (kind === 'microphone' ? s.micId : s.cameraId))
  const pickInput = useHuddle(s => s.pickInput)

  return (
    <Popover open={open} onClose={onClose} align="start" side="top" maxHeight={280} className="min-w-52 max-w-72">
      <p className="px-3 pt-1 pb-1.5 text-xs font-medium text-fg/45">{TITLES[kind]}</p>
      {devices.length === 0 ? (
        <div className="px-3 pb-1.5 flex flex-col items-start gap-1.5">
          <p className="text-sm text-fg/70">{NONE[kind]}</p>
          <button
            onClick={() => void window.crew.openMediaSettings(kind)}
            className="text-sm text-fg underline underline-offset-2 decoration-fg/40 hover:decoration-fg"
          >
            {FIX[kind]}
          </button>
        </div>
      ) : (
        devices.map(device => (
          <MenuItem
            key={device.id}
            label={device.name}
            checked={device.id === chosen}
            onClick={() => {
              void pickInput(kind, device.id)
              onClose()
            }}
          />
        ))
      )}
    </Popover>
  )
}
