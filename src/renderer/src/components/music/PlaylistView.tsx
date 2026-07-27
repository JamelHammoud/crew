import { useMemo } from 'react'
import { findMusic, isMine, playlistItems, type MusicPlaylist } from '../../../../shared/music'
import { MinusGlyph, PauseGlyph, PlayGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import Tooltip from '../Tooltip'
import PlaylistCover from './PlaylistCover'
import { tracks } from './say'
import TrackRow, { rowAction, rowActionQuiet } from './TrackRow'

// One list, played through. A track put on from in here carries the list with
// it, so Next and Back walk the list rather than the whole shelf.
export default function PlaylistView({ playlist, query }: { playlist: MusicPlaylist; query: string }) {
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
            {playlist.by && !mine ? `${tracks(items.length)}, by ${playlist.by}` : tracks(items.length)}
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
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-fg text-ink-900 transition-all duration-150 hover:bg-fg/90 active:scale-95 disabled:opacity-30"
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
          <li className="px-3 py-6 text-center text-sm text-fg-muted">
            {query.trim()
              ? 'Nothing in here by that name'
              : mine
                ? 'Nothing in here yet. Add tracks from Songs.'
                : 'Nothing in here yet'}
          </li>
        )}
      </ul>
    </div>
  )
}
