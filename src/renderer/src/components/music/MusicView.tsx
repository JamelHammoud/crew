import { useMemo, useRef, useState } from 'react'
import { itemFor, playlistFor } from '../../../../shared/music'
import { ChevronLeftGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import ScreenSwap from '../ScreenSwap'
import Tooltip from '../Tooltip'
import { roundButton } from './buttons'
import MusicScreen, { type Place } from './MusicScreen'
import MusicSearch from './MusicSearch'
import NowPlaying from './NowPlaying'
import Playlists from './Playlists'
import PlaylistView from './PlaylistView'
import Songs from './Songs'

const TABS = [
  { id: 'songs', label: 'Songs' },
  { id: 'playlists', label: 'Playlists' }
] as const

export default function MusicView() {
  const room = useMusic(s => s.room)
  const uploads = useMusic(s => s.uploads)
  const playlists = useMusic(s => s.playlists)
  const track = useMemo(() => itemFor(room.trackId, uploads), [room.trackId, uploads])
  const [tab, setTab] = useState<'songs' | 'playlists'>('songs')
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const places = useRef(new Map<string, Place>())

  // A list somebody deleted while you were reading it takes you back to the
  // shelf of lists rather than leaving you on a page about nothing.
  const open = playlistFor(openId, playlists)

  // Which screen is showing, and how far in it is. The two tabs stand beside
  // each other and a list stands inside them, so the direction every screen
  // travels falls out of the order they are named in here.
  const screen = open ? `playlist:${open.id}` : tab
  const depth = open ? 2 : tab === 'songs' ? 0 : 1

  // Where each screen was left. It is held here rather than in the screen
  // itself, since the screen is taken down whenever you leave it.
  const place = (key: string): Place => {
    const held = places.current.get(key) ?? { at: 0 }
    places.current.set(key, held)
    return held
  }

  const go = (playlistId: string | null) => {
    setQuery('')
    setOpenId(playlistId)
    if (playlistId) setTab('playlists')
  }

  const songs = () => {
    setQuery('')
    setOpenId(null)
    setTab('songs')
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3 pb-1 flex items-center gap-2">
        <div className="shrink-0">
          <ScreenSwap screen={open ? 'back' : 'tabs'} depth={open ? 1 : 0}>
            {open ? (
              <Tooltip label="All playlists">
                <button onClick={() => go(null)} aria-label="All playlists" className={`${roundButton} w-8 h-8`}>
                  <ChevronLeftGlyph className="w-4 h-4" />
                </button>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-1">
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
          </ScreenSwap>
        </div>
        <MusicSearch query={query} onQuery={setQuery} />
      </div>

      <div className="relative flex-1 min-h-0">
        <ScreenSwap screen={screen} depth={depth} fill>
          <MusicScreen place={place(screen)} under={track !== null}>
            {open ? (
              <PlaylistView playlist={open} query={query} onSongs={songs} />
            ) : tab === 'songs' ? (
              <Songs query={query} />
            ) : (
              <Playlists query={query} onOpen={go} />
            )}
          </MusicScreen>
        </ScreenSwap>
        {track && <NowPlaying track={track} />}
      </div>
    </div>
  )
}
