import { useEffect, useMemo, useRef, useState } from 'react'
import { musicItems, type MusicItem, type MusicRoom } from '../../../../shared/music'
import {
  MusicGlyph,
  PauseGlyph,
  PlayGlyph,
  PlusGlyph,
  SkipBackGlyph,
  SkipNextGlyph,
  SpeakerGlyph,
  SpeakerOffGlyph,
  StopGlyph,
  TrashGlyph
} from '../../icons'
import { playSound } from '../../media/sounds'
import { useMusic } from '../../state/music'
import { setSounds, useSounds } from '../../state/sound'
import { useCrew } from '../../state/store'
import Slider from '../Slider'
import Spinner from '../Spinner'
import Tooltip from '../Tooltip'
import Bars from './Bars'
import Cover from './Cover'

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
    let frame = requestAnimationFrame(function tick() {
      setAt(useMusic.getState().position())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [room, playing])
  return at
}

const round =
  'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-fg-muted transition-all duration-150 hover:text-fg hover:bg-fg/[0.06] active:scale-95'

export default function MusicView() {
  const room = useMusic(s => s.room)
  const uploads = useMusic(s => s.uploads)
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)
  const adding = useMusic(s => s.adding)
  const selfName = useCrew(s => s.selfName)
  const sounds = useSounds()
  const items = useMemo(() => musicItems(uploads), [uploads])
  const track = items.find(one => one.id === room.trackId) ?? null
  const at = useAt(room, room.playing && track !== null)
  // Where the bar is being dragged to, which is what it shows until the crew
  // has been told, so it does not spring back under your own finger.
  const [scrub, setScrub] = useState<number | null>(null)
  const [trouble, setTrouble] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  useEffect(() => setScrub(null), [room])

  const put = (one: MusicItem) => {
    if (one.id === room.trackId) useMusic.getState().toggle()
    else useMusic.getState().put(one.id)
  }

  const take = async (file: File | undefined) => {
    if (!file) return
    setTrouble(await useMusic.getState().add(file))
  }

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto [scrollbar-width:thin]">
      <div className="p-4 flex gap-4">
        {track ? (
          <Cover item={track} size={104} playing={room.playing} className="w-[104px] h-[104px] shrink-0 rounded-2xl" />
        ) : (
          <div className="w-[104px] h-[104px] shrink-0 rounded-2xl bg-ink-800 flex ring-1 ring-inset ring-fg/[0.06]">
            <MusicGlyph className="w-7 h-7 m-auto text-fg-faint" />
          </div>
        )}

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
          value={scrub ?? (track ? at / track.seconds : 0)}
          disabled={!track}
          className="flex-1"
          onChange={setScrub}
          onCommit={share => track && useMusic.getState().seek(share * track.seconds)}
        />
        <span className="shrink-0 text-xs tabular-nums text-fg-muted">
          {clock(scrub !== null && track ? scrub * track.seconds : at)} / {clock(track ? track.seconds : 0)}
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

      <div className="h-px bg-ink-700" />

      <ul className="p-2">
        {items.map(one => {
          const on = one.id === room.trackId
          return (
            <li key={one.id}>
              <button
                onClick={() => put(one)}
                aria-pressed={on}
                className={`group w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 ${
                  on ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
                }`}
              >
                <Cover item={one} size={40} playing={on && room.playing} className="w-10 h-10 shrink-0 rounded-[10px]">
                  {on && (
                    // A scrim under the bars, because a cover can be any color
                    // and white on yellow is not a bar at all.
                    <span className="absolute inset-0 flex items-end p-[7px] text-white bg-gradient-to-t from-black/55 to-transparent">
                      <Bars count={4} className="h-3/4 w-full justify-between" barClassName="w-[3px]" />
                    </span>
                  )}
                </Cover>
                <span className="flex-1 min-w-0">
                  <span className={`block truncate text-sm ${on ? 'text-fg font-medium' : 'text-fg-secondary'}`}>
                    {one.name}
                  </span>
                  <span className="block truncate text-xs text-fg-muted">
                    {one.by ? `${one.mood}, from ${one.by}` : one.mood}
                  </span>
                </span>
                <span className="shrink-0 w-9 text-right text-xs tabular-nums text-fg-faint">
                  {clock(one.seconds)}
                </span>
                {one.file && (
                  <Tooltip label="Take off the shelf">
                    <span
                      role="button"
                      aria-label={`Remove ${one.name}`}
                      onClick={event => {
                        event.stopPropagation()
                        useMusic.getState().remove(one.id)
                      }}
                      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg-faint opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-fg hover:bg-fg/10 active:scale-95"
                    >
                      <TrashGlyph className="w-4 h-4" />
                    </span>
                  </Tooltip>
                )}
              </button>
            </li>
          )
        })}
        <li>
          <button
            onClick={() => picker.current?.click()}
            disabled={adding}
            className="w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 hover:bg-fg/[0.04] disabled:opacity-50"
          >
            <span className="w-10 h-10 shrink-0 rounded-xl border border-dashed border-fg/15 flex items-center justify-center text-fg-faint">
              {adding ? <Spinner size={16} /> : <PlusGlyph className="w-4 h-4" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm text-fg-secondary">
                {adding ? 'Putting it on the shelf' : 'Add a track'}
              </span>
              <span className="block truncate text-xs text-fg-muted">
                {trouble ?? 'An audio file from this machine, for everyone here'}
              </span>
            </span>
          </button>
          <input
            ref={picker}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={event => {
              void take(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </li>
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
              {muted ? (
                <SpeakerOffGlyph className="w-[18px] h-[18px]" />
              ) : (
                <SpeakerGlyph className="w-[18px] h-[18px]" />
              )}
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
