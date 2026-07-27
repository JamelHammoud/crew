import { useMemo } from 'react'
import { findMusic, isMine, playlistItems, type MusicPlaylist } from '../../../../shared/music'
import { MinusGlyph, PauseGlyph, PlayGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import Tooltip from '../Tooltip'
import { quietPill, solidButton } from './buttons'
import PlaylistCover from './PlaylistCover'
import { tracks } from './say'
import TrackRow, { rowAction, rowActionQuiet } from './TrackRow'

// One list, played through. A track put on from in here carries the list with
// it, so Next and Back walk the list rather than the whole shelf.
export default function PlaylistView({
  playlist,
  query,
  onSongs
}: {
  playlist: MusicPlaylist
  query: string
  onSongs: () => void
}) {
  const room = useMusic(s => s.room)
  const uploads = useMusic(s => s.uploads)
  const selfName = useCrew(s => s.selfName)
  const items = useMemo(() => playlistItems(playlist, uploads), [playlist, uploads])
  const shown = useMemo(() => findMusic(items, query), [items, query])
  const on = room.playlistId === playlist.id && room.trackId !== null
  const mine = isMine(playlist, selfName)

  const play = () => {
    if (on) useMusic.getState().toggle()
    else if (items.length > 0) useMusic.getState().put(items[0].id, playlist.id)
  }

  const put = (trackId: string) => {
    if (trackId === room.trackId && on) useMusic.getState().toggle()
    else useMusic.getState().put(trackId, playlist.id)
  }

  return (
    <div className="pb-2">
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <PlaylistCover
          items={items}
          size={48}
          playing={on && room.playing}
          className="w-12 h-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-fg">{playlist.name}</h3>
          <p className="truncate text-xs text-fg-muted">
            {playlist.by && !mine ? `${playlist.by} · ${tracks(items.length)}` : tracks(items.length)}
          </p>
        </div>
        {mine && (
          <Tooltip label="Delete this playlist">
            <button
              onClick={() => useMusic.getState().dropPlaylist(playlist.id)}
              aria-label="Delete this playlist"
              className={rowAction}
            >
              <TrashGlyph className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
        <Tooltip label={on && room.playing ? 'Pause' : 'Play'}>
          <button
            onClick={play}
            disabled={items.length === 0}
            aria-label={on && room.playing ? 'Pause' : 'Play'}
            className={`${solidButton} w-9 h-9 disabled:opacity-30`}
          >
            {on && room.playing ? <PauseGlyph className="w-4 h-4" /> : <PlayGlyph className="w-4 h-4" />}
          </button>
        </Tooltip>
      </div>

      <ul className="p-2 pt-0">
        {shown.map(item => (
          <TrackRow
            key={item.id}
            item={item}
            on={item.id === room.trackId && on}
            playing={room.playing}
            onPlay={() => put(item.id)}
            actions={
              mine && (
                <Tooltip label="Take it out">
                  <button
                    onClick={() => useMusic.getState().holdTrack(playlist.id, item.id, false)}
                    aria-label={`Take ${item.name} out`}
                    className={rowActionQuiet}
                  >
                    <MinusGlyph className="w-4 h-4" />
                  </button>
                </Tooltip>
              )
            }
          />
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-6 flex flex-col items-center gap-3">
            <p className="text-sm text-fg-muted">{query.trim() ? 'No tracks found' : 'Nothing in here yet'}</p>
            {!query.trim() && mine && (
              <button onClick={onSongs} className={`${quietPill} h-8 px-3.5`}>
                Add tracks
              </button>
            )}
          </li>
        )}
      </ul>
    </div>
  )
}
