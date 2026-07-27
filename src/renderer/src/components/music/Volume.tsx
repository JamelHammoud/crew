import { useState } from 'react'
import { SpeakerGlyph, SpeakerOffGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { Popover } from '../Popover'
import Slider from '../Slider'
import Tooltip from '../Tooltip'
import { roundButton } from './buttons'

// How loud it is where you are sitting, which is yours alone and is never sent
// anywhere. It stands beside the bar that says where the track is, so the one
// slider on the bar is the one everybody shares.
export default function Volume() {
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)
  const [open, setOpen] = useState(false)

  return (
    <span className="relative shrink-0 flex">
      <Tooltip label="Volume" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Volume"
          aria-expanded={open}
          className={`${roundButton} w-8 h-8 ${open ? 'text-fg bg-fg/[0.06]' : ''}`}
        >
          {muted ? <SpeakerOffGlyph className="w-[18px] h-[18px]" /> : <SpeakerGlyph className="w-[18px] h-[18px]" />}
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} side="top" className="w-52">
        <div className="px-2 py-1 flex items-center gap-2">
          <button
            onClick={() => useMusic.getState().setMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/70 transition-all duration-150 hover:text-fg hover:bg-fg/10 active:scale-95"
          >
            {muted ? <SpeakerOffGlyph className="w-4 h-4" /> : <SpeakerGlyph className="w-4 h-4" />}
          </button>
          <Slider
            label="Volume"
            value={muted ? 0 : volume}
            className="flex-1"
            onChange={level => useMusic.getState().setVolume(level)}
          />
        </div>
      </Popover>
    </span>
  )
}
