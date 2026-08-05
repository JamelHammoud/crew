import { useState } from 'react'
import { SpeakerGlyph, SpeakerOffGlyph } from '../icons'
import { Popover } from './Popover'
import Slider from './Slider'
import Tooltip from './Tooltip'

export default function VolumeButton({
  volume,
  muted,
  className = '',
  onVolume,
  onMuted
}: {
  volume: number
  muted: boolean
  className?: string
  onVolume: (volume: number) => void
  onMuted: (muted: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const Mark = muted ? SpeakerOffGlyph : SpeakerGlyph

  return (
    <span className="relative shrink-0 flex">
      <Tooltip label="Volume" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Volume"
          aria-expanded={open}
          className={`${className} ${open ? 'text-fg bg-fg/10' : ''}`}
        >
          <Mark className="w-4 h-4" />
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} side="top" className="w-52">
        <div className="px-2 py-1 flex items-center gap-2">
          <button
            onClick={() => onMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/70 transition-all duration-150 hover:text-fg hover:bg-fg/10 active:scale-95"
          >
            <Mark className="w-4 h-4" />
          </button>
          <Slider label="Volume" value={muted ? 0 : volume} className="flex-1" onChange={onVolume} />
        </div>
      </Popover>
    </span>
  )
}
