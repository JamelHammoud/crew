import { useMemo, useState } from 'react'
import { findPlaylists, isMine, MUSIC_SETS, playlistItems, type MusicPlaylist } from '../../../../shared/music'
import { PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import NewPlaylist from './NewPlaylist'
import PlaylistCover from './PlaylistCover'
import { tracks } from './say'

function Row({ playlist, who, onOpen }: { playlist: MusicPlaylist; who: string; onOpen: () => void }) {
  const uploads = useMusic(s => s.uploads)
  const room = useMusic(s => s.room)
  const items = useMemo(() => playlistItems(playlist, uploads), [playlist, uploads])
  const on = room.playlistId === playlist.id && room.trackId !== null

  return (
    <li>
      <button
        onClick={onOpen}
        className={`w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 ${
          on ? 'bg-fg/[0.07]' : 'hover:bg-fg/[0.04]'
        }`}
      >
        <PlaylistCover
          playlist={playlist}
          items={items}
          size={40}
          playing={on && room.playing}
          className="w-10 h-10 shrink-0 rounded-[10px]"
        />
        <span className="flex-1 min-w-0">
          <span className={`block truncate text-sm ${on ? 'text-fg font-medium' : 'text-fg-secondary'}`}>
            {playlist.name}
          </span>
          <span className="block truncate text-xs text-fg-muted">
            {who ? `${tracks(items.length)} · ${who}` : tracks(items.length)}
          </span>
        </span>
      </button>
    </li>
  )
}

// One list, the app's own first, then yours, then everyone else's. Whose a list
// is rides on the row itself, so nothing is sorted into a section for it.
export default function Playlists({ query, onOpen }: { query: string; onOpen: (playlistId: string) => void }) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [naming, setNaming] = useState(false)
  const found = useMemo(() => findPlaylists(playlists, query), [playlists, query])
  const sets = useMemo(() => findPlaylists(MUSIC_SETS, query), [query])
  const mine = found.filter(playlist => isMine(playlist, selfName))
  const theirs = found.filter(playlist => !isMine(playlist, selfName)).sort((a, b) => a.by.localeCompare(b.by))
  const rows: { playlist: MusicPlaylist; who: string }[] = [
    ...sets.map(playlist => ({ playlist, who: '' })),
    ...mine.map(playlist => ({ playlist, who: '' })),
    ...theirs.map(playlist => ({ playlist, who: playlist.by }))
  ]

  return (
    <ul className="p-2 flex flex-col gap-1">
      {!query.trim() && (
        <li>
          <button
            onClick={() => setNaming(true)}
            className="w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 hover:bg-fg/[0.04]"
          >
            <span className="w-10 h-10 shrink-0 rounded-[10px] border border-dashed border-fg/15 flex items-center justify-center text-fg-faint">
              <PlusGlyph className="w-4 h-4" />
            </span>
            <span className="flex-1 min-w-0 text-sm text-fg-secondary">New playlist</span>
          </button>
        </li>
      )}

      {rows.map(({ playlist, who }) => (
        <Row key={playlist.id} playlist={playlist} who={who} onOpen={() => onOpen(playlist.id)} />
      ))}

      {query.trim() && rows.length === 0 && (
        <li className="px-3 py-6 text-center text-sm text-fg-muted">No playlists found</li>
      )}

      <NewPlaylist open={naming} onClose={() => setNaming(false)} onMade={onOpen} />
    </ul>
  )
}
