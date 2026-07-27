import { useEffect, useState } from 'react'
import type { MusicItem, MusicRoom } from '../../../../shared/music'
import { PauseGlyph, PlayGlyph, SkipBackGlyph, SkipNextGlyph, StopGlyph } from '../../icons'
import { playSound } from '../../media/sounds'
import { useMusic } from '../../state/music'
import { setSounds, useSounds } from '../../state/sound'
import Slider from '../Slider'
import Tooltip from '../Tooltip'
import { quietPill, roundButton, solidButton } from './buttons'
import Cover from './Cover'
import { clock } from './say'
import Volume from './Volume'

// Where the loop has got to, read as fast as the screen draws. Nothing is asked
// for while it is standing still, since a paused loop is where it was left.
function useAt(room: MusicRoom, playing: boolean): number {
  const [at, setAt] = useState(() => useMusic.getState().position())
  useEffect(() => {
    setAt(useMusic.getState().position())
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      setAt(useMusic.getState().position())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [room, playing])
  return at
}

// The bar at the foot of the panel, and it is only there while something is on.
// Nothing playing is nothing to say, so the list gets the whole panel.
export default function NowPlaying({ track }: { track: MusicItem }) {
  const room = useMusic(s => s.room)
  const trouble = useMusic(s => s.trouble)
  const sounds = useSounds()
  const at = useAt(room, room.playing)
  // Where the bar is being dragged to, which is what it shows until the crew
  // has been told, so it does not spring back under your own finger.
  const [scrub, setScrub] = useState<number | null>(null)
  useEffect(() => setScrub(null), [room])

  const shown = scrub !== null ? scrub * track.seconds : at

  return (
    <div className="shrink-0 bg-ink-800">
      {!sounds && (
        <div className="px-3 pt-3 flex items-center gap-3">
          <p className="flex-1 text-xs text-fg-secondary">Sound is off, so you will not hear this.</p>
          <button
            onClick={() => {
              setSounds(true)
              playSound('sound.on')
            }}
            className={`${quietPill} h-7 px-3`}
          >
            Turn it on
          </button>
        </div>
      )}

      <div className="px-3 pt-3 flex items-center gap-2">
        <Cover item={track} size={44} playing={room.playing} className="w-11 h-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{track.name}</p>
          <p className={`truncate text-xs ${trouble ? 'text-danger' : 'text-fg-muted'}`}>
            {trouble ?? (track.by ? `${track.mood} · ${track.by}` : track.mood)}
          </p>
        </div>
        <Tooltip label="Back">
          <button onClick={() => useMusic.getState().skip(-1)} aria-label="Back" className={`${roundButton} w-8 h-8`}>
            <SkipBackGlyph className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <Tooltip label={room.playing ? 'Pause' : 'Play'}>
          <button
            onClick={() => useMusic.getState().toggle()}
            aria-label={room.playing ? 'Pause' : 'Play'}
            className={`${solidButton} w-10 h-10`}
          >
            {room.playing ? <PauseGlyph className="w-[18px] h-[18px]" /> : <PlayGlyph className="w-[18px] h-[18px]" />}
          </button>
        </Tooltip>
        <Tooltip label="Next">
          <button onClick={() => useMusic.getState().skip(1)} aria-label="Next" className={`${roundButton} w-8 h-8`}>
            <SkipNextGlyph className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
      </div>

      <div className="px-3 pt-2 pb-3 flex items-center gap-2">
        <span className="shrink-0 w-8 text-xs tabular-nums text-fg-muted">{clock(shown)}</span>
        <Slider
          label="Track position"
          value={scrub ?? at / track.seconds}
          className="flex-1"
          onChange={setScrub}
          onCommit={share => useMusic.getState().seek(share * track.seconds)}
        />
        <span className="shrink-0 w-8 text-right text-xs tabular-nums text-fg-muted">{clock(track.seconds)}</span>
        <Volume />
        <Tooltip label="Turn it off">
          <button
            onClick={() => useMusic.getState().off()}
            aria-label="Turn it off"
            className={`${roundButton} w-8 h-8`}
          >
            <StopGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
