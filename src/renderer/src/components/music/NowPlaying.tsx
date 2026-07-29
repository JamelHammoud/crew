import { useEffect, useState } from 'react'
import type { MusicItem, MusicRoom } from '../../../../shared/music'
import { PauseGlyph, PlayGlyph, RepeatGlyph, SkipBackGlyph, SkipNextGlyph, StopGlyph } from '../../icons'
import { playSound } from '../../media/sounds'
import { useMusic } from '../../state/music'
import { setSounds, useSounds } from '../../state/sound'
import Slider from '../Slider'
import Tooltip from '../Tooltip'
import { barButton, quietPill, solidButton } from './buttons'
import Cover from './Cover'
import { meshOf } from '../art/mesh'
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

// The bar floats at the foot of the panel, and it is only there while something
// is on. Nothing playing is nothing to say, so the list gets the whole panel.
//
// It is glass with a margin round it, so the list runs on underneath rather than
// stopping at a shelf, and it is lit by the cover of whatever is playing: the
// same picture, blurred past anything you could name and held at an eighth of
// its own strength, so the foot of the panel carries the color of the track.
//
// That light is painted over the tint rather than under it, so the glass it
// stands on is `glass-lit`, which is deeper and thinner than the rest: the bar
// keeps the track's color without reading brighter than the list it floats over.
//
// The name is the whole of what it says. The line under it is for trouble alone,
// since silence that looks exactly like music playing is the worst of both, and
// it is not there when there is none.
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
    <div className="glass glass-lit absolute inset-x-3 bottom-3 isolate overflow-hidden rounded-card animate-rise">
      <span
        aria-hidden
        style={meshOf(track, 220)}
        className="absolute -inset-10 -z-10 opacity-[0.12] light:opacity-[0.16]"
      />

      {!sounds && (
        <div className="px-3.5 pt-3 flex items-center gap-3">
          <p className="flex-1 text-xs text-fg/70">Sound is off, so you will not hear this.</p>
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

      <div className="px-3.5 pt-3.5 flex items-center gap-3">
        <Cover item={track} size={48} playing={room.playing} className="w-12 h-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{track.name}</p>
          {trouble && <p className="truncate text-xs text-danger">{trouble}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-0.5">
          <Tooltip label="Back">
            <button onClick={() => useMusic.getState().skip(-1)} aria-label="Back" className={`${barButton} w-8 h-8`}>
              <SkipBackGlyph className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
          <Tooltip label={room.playing ? 'Pause' : 'Play'}>
            <button
              onClick={() => useMusic.getState().toggle()}
              aria-label={room.playing ? 'Pause' : 'Play'}
              className={`${solidButton} w-10 h-10 shadow-lg shadow-black/20`}
            >
              {room.playing ? <PauseGlyph className="w-[18px] h-[18px]" /> : <PlayGlyph className="w-[18px] h-[18px]" />}
            </button>
          </Tooltip>
          <Tooltip label="Next">
            <button onClick={() => useMusic.getState().skip(1)} aria-label="Next" className={`${barButton} w-8 h-8`}>
              <SkipNextGlyph className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="px-3.5 pt-3 pb-3 flex items-center gap-2">
        <span className="shrink-0 text-[11px] tabular-nums text-fg/45">{clock(shown)}</span>
        <Slider
          label="Track position"
          value={scrub ?? at / track.seconds}
          className="flex-1"
          onChange={setScrub}
          onCommit={share => useMusic.getState().seek(share * track.seconds)}
        />
        <span className="shrink-0 text-[11px] tabular-nums text-fg/45">{clock(track.seconds)}</span>
        <span className="shrink-0 flex items-center gap-0.5 pl-1">
          <Tooltip label={room.loop ? 'Play on to the next' : 'Repeat this track'}>
            <button
              onClick={() => useMusic.getState().setLoop(!room.loop)}
              aria-label={room.loop ? 'Play on to the next' : 'Repeat this track'}
              aria-pressed={room.loop}
              className={`${barButton} w-7 h-7 ${room.loop ? 'text-fg bg-fg/10' : ''}`}
            >
              <RepeatGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
          <Volume />
          <Tooltip label="Turn it off">
            <button onClick={() => useMusic.getState().off()} aria-label="Turn it off" className={`${barButton} w-7 h-7`}>
              <StopGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        </span>
      </div>
    </div>
  )
}
