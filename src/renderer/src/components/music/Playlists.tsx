import { useMemo, useState } from 'react'
import {
  findPlaylists,
  isMine,
  MUSIC_SETS,
  playlistItems,
  PLAYLIST_NAME_LIMIT,
  type MusicPlaylist
} from '../../../../shared/music'
import { ChevronRightGlyph, PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import PlaylistCover from './PlaylistCover'
import { tracks } from './say'

function Row({ playlist, onOpen }: { playlist: MusicPlaylist; onOpen: () => void }) {
  const uploads = useMusic(s => s.uploads)
  const room = useMusic(s => s.room)
  const items = useMemo(() => playlistItems(playlist, uploads), [playlist, uploads])
  const on = room.playlistId === playlist.id && room.trackId !== null

  return (
    <li>
      <button
        onClick={onOpen}
        className={`w-full h-14 px-2 rounded-2xl flex items-center gap-3 text-left transition-colors duration-150 ${
          on ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
        }`}
      >
        <PlaylistCover
          items={items}
          size={40}
          playing={on && room.playing}
          className="w-10 h-10 shrink-0 rounded-[10px]"
        />
        <span className="flex-1 min-w-0">
          <span className={`block truncate text-sm ${on ? 'text-fg font-medium' : 'text-fg-secondary'}`}>
            {playlist.name}
          </span>
          <span className="block truncate text-xs text-fg-muted">{tracks(items.length)}</span>
        </span>
        <ChevronRightGlyph className="w-4 h-4 shrink-0 text-fg-faint" />
      </button>
    </li>
  )
}

function Section({
  title,
  playlists,
  onOpen
}: {
  title: string
  playlists: MusicPlaylist[]
  onOpen: (playlistId: string) => void
}) {
  if (playlists.length === 0) return null
  return (
    <>
      <li className="px-3 pt-3 pb-1 text-xs text-fg-muted">{title}</li>
      {playlists.map(playlist => (
        <Row key={playlist.id} playlist={playlist} onOpen={() => onOpen(playlist.id)} />
      ))}
    </>
  )
}

// The app's own lists first, then yours, then a section for each person who made
// one.
export default function Playlists({
  query,
  naming,
  onNaming,
  onOpen
}: {
  query: string
  naming: boolean
  onNaming: (open: boolean) => void
  onOpen: (playlistId: string) => void
}) {
  const playlists = useMusic(s => s.playlists)
  const selfName = useCrew(s => s.selfName)
  const [name, setName] = useState('')
  const found = useMemo(() => findPlaylists(playlists, query), [playlists, query])
  const mine = found.filter(playlist => isMine(playlist, selfName))
  const theirs = found.filter(playlist => !isMine(playlist, selfName))
  const names = [...new Set(theirs.map(playlist => playlist.by))].sort((a, b) => a.localeCompare(b))

  const make = () => {
    const asked = name.trim()
    setName('')
    onNaming(false)
    if (asked) useMusic.getState().makePlaylist(asked)
  }

  return (
    <ul className="p-2">
      {!query.trim() && (
        <li className="h-14 px-2 rounded-2xl flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 rounded-xl border border-dashed border-fg/15 flex items-center justify-center text-fg-faint">
            <PlusGlyph className="w-4 h-4" />
          </span>
          {naming ? (
            <input
              autoFocus
              value={name}
              maxLength={PLAYLIST_NAME_LIMIT}
              placeholder="Name it"
              aria-label="Name the playlist"
              onChange={event => setName(event.target.value)}
              onBlur={make}
              onKeyDown={event => {
                if (event.key === 'Enter') make()
                if (event.key === 'Escape') {
                  setName('')
                  onNaming(false)
                }
              }}
              className="flex-1 min-w-0 h-9 px-3.5 rounded-full bg-fg/[0.06] text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-fg/[0.08]"
            />
          ) : (
            <button onClick={() => onNaming(true)} className="flex-1 min-w-0 h-full text-left">
              <span className="block text-sm text-fg-secondary">New playlist</span>
              <span className="block truncate text-xs text-fg-muted">Yours to fill, for everyone to play</span>
            </button>
          )}
        </li>
      )}

      <Section title="Yours" playlists={mine} onOpen={onOpen} />
      {names.map(who => (
        <Section
          key={who}
          title={who}
          playlists={theirs.filter(playlist => playlist.by === who)}
          onOpen={onOpen}
        />
      ))}

      {found.length === 0 && (
        <li className="px-3 py-6 text-center text-sm text-fg-muted">
          {query.trim() ? 'No playlists by that name' : 'No playlists yet'}
        </li>
      )}
    </ul>
  )
}
