import { useEffect, useState } from 'react'
import {
  MUSIC_TRACKS,
  trackFor,
  trackLength,
  type MusicRoom,
  type MusicTrack
} from '../../../../shared/music'
import {
  MusicGlyph,
  PauseGlyph,
  PlayGlyph,
  SkipBackGlyph,
  SkipNextGlyph,
  SpeakerGlyph,
  SpeakerOffGlyph,
  StopGlyph
} from '../../icons'
import { playSound } from '../../media/sounds'
import { useMusic } from '../../state/music'
import { setSounds, useSounds } from '../../state/sound'
import { useCrew } from '../../state/store'
import InsetRing from '../InsetRing'
import Slider from '../Slider'
import Tooltip from '../Tooltip'
import Bars from './Bars'

const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// Where the loop has got to, read as fast as the screen draws. Nothing is asked
// for while it is standing still, since a paused loop is where it was left.
function useAt(room: MusicRoom, playing: boolean): number {
  const [at, setAt] = useState(() => useMusic.getState().position())
  useEffect(() => {
    setAt(useMusic.getState().position())
    if (!playing) return
    let frame = 0
    const tick = () => {
      setAt(useMusic.getState().position())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [room, playing])
  return at
}

const round =
  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95'

export default function MusicView() {
  const room = useMusic(s => s.room)
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)
  const selfName = useCrew(s => s.selfName)
  const sounds = useSounds()
  const track = trackFor(room.trackId)
  const at = useAt(room, room.playing && track !== null)
  // Where the bar is being dragged to, which is what it shows until the crew
  // has been told, so it does not spring back under your own finger.
  const [scrub, setScrub] = useState<number | null>(null)
  useEffect(() => setScrub(null), [room])

  const put = (one: MusicTrack) => {
    if (one.id === room.trackId) useMusic.getState().toggle()
    else useMusic.getState().put(one.id)
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto [scrollbar-width:thin]">
      <div className="p-4 flex gap-4">
        <div className="relative w-[124px] h-[124px] shrink-0 rounded-card bg-ink-800 flex p-5">
          {track ? (
            <Bars
              at={at}
              bpm={track.bpm}
              count={5}
              playing={room.playing}
              className="h-full w-full justify-between"
              barClassName="w-[7px]"
            />
          ) : (
            <MusicGlyph className="w-8 h-8 m-auto text-fg-faint" />
          )}
          <InsetRing className="ring-1 ring-inset ring-fg/[0.06] rounded-card" />
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
          <h2 className="text-lg font-semibold text-fg truncate">{track ? track.name : 'Nothing on'}</h2>
          <p className="text-sm text-fg-secondary truncate">
            {track ? `${track.mood}, on a loop` : 'Pick something to put on'}
          </p>
          <p className="text-xs text-fg-muted truncate">
            {track && room.by
              ? room.by === selfName
                ? 'You put this on'
                : `${room.by} put this on`
              : 'Everyone here hears it'}
          </p>
        </div>
      </div>

      <div className="px-4 flex items-center gap-3">
        <Slider
          label="Where the track is"
          value={scrub ?? (track ? at / trackLength(track) : 0)}
          disabled={!track}
          className="flex-1"
          onChange={setScrub}
          onCommit={share => track && useMusic.getState().seek(share * trackLength(track))}
        />
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">
          {clock(scrub !== null && track ? scrub * trackLength(track) : at)} /{' '}
          {clock(track ? trackLength(track) : 0)}
        </span>
      </div>

      <div className="px-4 py-3 flex items-center gap-1">
        <Tooltip label="Back">
          <button onClick={() => useMusic.getState().skip(-1)} aria-label="Back" className={round}>
            <SkipBackGlyph className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <Tooltip label={room.playing ? 'Pause' : 'Play'}>
          <button
            onClick={() => useMusic.getState().toggle()}
            aria-label={room.playing ? 'Pause' : 'Play'}
            className="w-12 h-12 mx-1 shrink-0 rounded-full flex items-center justify-center bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95"
          >
            {room.playing ? <PauseGlyph className="w-5 h-5" /> : <PlayGlyph className="w-5 h-5" />}
          </button>
        </Tooltip>
        <Tooltip label="Next">
          <button onClick={() => useMusic.getState().skip(1)} aria-label="Next" className={round}>
            <SkipNextGlyph className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
        <span className="flex-1" />
        {track && (
          <Tooltip label="Take it off">
            <button onClick={() => useMusic.getState().off()} aria-label="Take it off" className={round}>
              <StopGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="h-px mx-4 bg-ink-700" />

      <ul className="p-2">
        {MUSIC_TRACKS.map(one => {
          const on = one.id === room.trackId
          return (
            <li key={one.id}>
              <button
                onClick={() => put(one)}
                aria-pressed={on}
                className={`w-full h-12 px-2.5 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 ${
                  on ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
                }`}
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                  {on ? (
                    <Bars
                      at={at}
                      bpm={one.bpm}
                      count={3}
                      playing={room.playing}
                      className="h-[15px] w-[13px] justify-between"
                      barClassName="w-[3px] transition-[height] duration-100 ease-out"
                    />
                  ) : (
                    <MusicGlyph className="w-[18px] h-[18px] text-fg-faint" />
                  )}
                </span>
                <span className={`flex-1 min-w-0 truncate text-sm ${on ? 'text-fg font-medium' : 'text-fg-secondary'}`}>
                  {one.name}
                </span>
                <span className="shrink-0 text-xs text-fg-muted">{one.mood}</span>
                <span className="shrink-0 w-9 text-right text-xs tabular-nums text-fg-faint">
                  {clock(trackLength(one))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto">
        {!sounds && (
          <div className="mx-4 mb-1 px-4 py-3 rounded-2xl bg-ink-800 flex items-center gap-3">
            <p className="flex-1 text-xs text-fg-secondary">Crew's sounds are off, so you cannot hear this.</p>
            <button
              onClick={() => {
                setSounds(true)
                playSound('sound.on')
              }}
              className="shrink-0 h-8 px-3.5 rounded-full bg-fg text-ink-900 text-xs font-semibold transition-all duration-150 hover:bg-fg/90 active:scale-95"
            >
              Turn them on
            </button>
          </div>
        )}
        <div className="p-4 flex items-center gap-3">
        <Tooltip label={muted ? 'Unmute' : 'Mute'}>
          <button
            onClick={() => useMusic.getState().setMuted(!muted)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className={round}
          >
            {muted ? <SpeakerOffGlyph className="w-[18px] h-[18px]" /> : <SpeakerGlyph className="w-[18px] h-[18px]" />}
          </button>
        </Tooltip>
        <Slider
          label="Your volume"
          value={muted ? 0 : volume}
          className="flex-1"
          onChange={level => useMusic.getState().setVolume(level)}
        />
        <span className="shrink-0 text-xs text-fg-faint">Only yours</span>
        </div>
      </div>
    </div>
  )
}
