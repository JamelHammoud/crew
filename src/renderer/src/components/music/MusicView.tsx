import { useEffect, useMemo, useState } from 'react'
import { itemFor, playlistFor, type MusicRoom } from '../../../../shared/music'
import {
  ChevronLeftGlyph,
  MusicGlyph,
  PauseGlyph,
  PlayGlyph,
  SearchGlyph,
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
import Slider from '../Slider'
import Tooltip from '../Tooltip'
import Cover from './Cover'
import Playlists from './Playlists'
import PlaylistView from './PlaylistView'
import { clock } from './say'
import Songs from './Songs'

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

const TABS = [
  { id: 'songs', label: 'Songs' },
  { id: 'playlists', label: 'Playlists' }
] as const

export default function MusicView() {
  const room = useMusic(s => s.room)
  const uploads = useMusic(s => s.uploads)
  const playlists = useMusic(s => s.playlists)
  const volume = useMusic(s => s.volume)
  const muted = useMusic(s => s.muted)
  const trouble = useMusic(s => s.trouble)
  const selfName = useCrew(s => s.selfName)
  const sounds = useSounds()
  const track = useMemo(() => itemFor(room.trackId, uploads), [room.trackId, uploads])
  const at = useAt(room, room.playing && track !== null)
  // Where the bar is being dragged to, which is what it shows until the crew
  // has been told, so it does not spring back under your own finger.
  const [scrub, setScrub] = useState<number | null>(null)
  const [tab, setTab] = useState<'songs' | 'playlists'>('songs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => setScrub(null), [room])

  // A list somebody deleted while you were reading it takes you back to the
  // shelf of lists rather than leaving you on a page about nothing.
  const open = playlists.find(playlist => playlist.id === openId) ?? null

  const go = (playlistId: string | null) => {
    setQuery('')
    setOpenId(playlistId)
    if (playlistId) setTab('playlists')
  }

  const newPlaylist = () => {
    setQuery('')
    setOpenId(null)
    setTab('playlists')
    setNaming(true)
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
          <p className={`text-xs truncate ${track && trouble ? 'text-danger' : 'text-fg-muted'}`}>
            {track && trouble
              ? trouble
              : track && room.by
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

      <div className="px-3 pt-3 flex items-center gap-2">
        {open ? (
          <Tooltip label="All playlists">
            <button onClick={() => go(null)} aria-label="All playlists" className={`${round} w-8 h-8`}>
              <ChevronLeftGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        ) : (
          <div className="shrink-0 flex items-center gap-1">
            {TABS.map(one => (
              <button
                key={one.id}
                onClick={() => setTab(one.id)}
                aria-pressed={tab === one.id}
                className={`h-8 px-3 rounded-full text-xs font-medium transition-colors duration-150 ${
                  tab === one.id ? 'bg-fg/[0.08] text-fg' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.04]'
                }`}
              >
                {one.label}
              </button>
            ))}
          </div>
        )}
        <div className="relative flex flex-1 min-w-0">
          <SearchGlyph className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint pointer-events-none" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search music"
            spellCheck={false}
            className="w-full h-8 pl-8 pr-3 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
          />
        </div>
      </div>

      {open ? (
        <PlaylistView playlist={open} query={query} />
      ) : tab === 'songs' ? (
        <Songs query={query} onNewPlaylist={newPlaylist} />
      ) : (
        <Playlists query={query} naming={naming} onNaming={setNaming} onOpen={go} />
      )}

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
