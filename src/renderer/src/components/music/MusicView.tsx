import { useMemo, useRef, useState } from 'react'
import { itemFor, playlistFor } from '../../../../shared/music'
import { ChevronLeftGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import ScrollFade from '../ScrollFade'
import Tooltip from '../Tooltip'
import useScrollEdges from '../useScrollEdges'
import { roundButton } from './buttons'
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
  const scroller = useRef<HTMLDivElement>(null)
  const { edges } = useScrollEdges(scroller)

  // A list somebody deleted while you were reading it takes you back to the
  // shelf of lists rather than leaving you on a page about nothing.
  const open = playlistFor(openId, playlists)

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
        {open ? (
          <Tooltip label="All playlists">
            <button onClick={() => go(null)} aria-label="All playlists" className={`${roundButton} w-8 h-8`}>
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
        <MusicSearch query={query} onQuery={setQuery} />
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={scroller}
          className={`absolute inset-0 overflow-y-auto [scrollbar-width:thin] ${track ? 'pb-32' : ''}`}
        >
          {open ? (
            <PlaylistView playlist={open} query={query} onSongs={songs} />
          ) : tab === 'songs' ? (
            <Songs query={query} />
          ) : (
            <Playlists query={query} onOpen={go} />
          )}
        </div>
        <ScrollFade edges={{ top: edges.top, bottom: track ? true : edges.bottom }} />
        {/* A taller fade while the bar is up. The list runs on under the glass,
            and it has to be gone by the time it would show in the margin the bar
            floats in, or a row reappears under it a moment after passing behind
            it. */}
        {track && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-ink-900 from-30% to-transparent pointer-events-none"
          />
        )}
        {track && <NowPlaying track={track} />}
      </div>
    </div>
  )
}
