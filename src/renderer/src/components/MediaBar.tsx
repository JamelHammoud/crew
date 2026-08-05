import { useState } from 'react'
import { PauseGlyph, PlayGlyph } from '../icons'
import { setMediaMuted, setMediaVolume, useMediaSound } from '../state/mediaVolume'
import { barButton, solidButton } from './music/buttons'
import { clock } from './music/say'
import Slider from './Slider'
import Tooltip from './Tooltip'
import VolumeButton from './VolumeButton'

// What is being played and how far through it is. It floats at the foot of the
// picture the way the music's own bar floats at the foot of its panel, and it is
// `glass-strong` for the reason the design canvas is: a frame of video can be any
// color, and a white one turns plain glass into pale grey.
export default function MediaBar({
  playing,
  at,
  length,
  onToggle,
  onSeek
}: {
  playing: boolean
  at: number
  length: number
  onToggle: () => void
  onSeek: (seconds: number) => void
}) {
  const [scrub, setScrub] = useState<number | null>(null)
  const sound = useMediaSound()
  const shown = scrub !== null ? scrub * length : at
  const share = length ? Math.min(1, shown / length) : 0

  return (
    <div className="glass glass-strong absolute inset-x-3 bottom-3 rounded-card px-3 py-2.5 flex items-center gap-2.5 animate-rise">
      <Tooltip label={playing ? 'Pause' : 'Play'}>
        <button
          onClick={onToggle}
          aria-label={playing ? 'Pause' : 'Play'}
          className={`${solidButton} w-9 h-9 shadow-lg shadow-black/20`}
        >
          {playing ? <PauseGlyph className="w-[18px] h-[18px]" /> : <PlayGlyph className="w-[18px] h-[18px]" />}
        </button>
      </Tooltip>
      <span className="shrink-0 text-[11px] tabular-nums text-fg/45">{clock(shown)}</span>
      <Slider
        label="Position"
        value={share}
        disabled={!length}
        className="flex-1"
        onChange={value => {
          setScrub(value)
          onSeek(value * length)
        }}
        onCommit={() => setScrub(null)}
      />
      <span className="shrink-0 text-[11px] tabular-nums text-fg/45">{clock(length)}</span>
      <VolumeButton
        volume={sound.volume}
        muted={sound.muted}
        className={`${barButton} w-7 h-7`}
        onVolume={setMediaVolume}
        onMuted={setMediaMuted}
      />
    </div>
  )
}
