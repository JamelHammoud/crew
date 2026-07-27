import { useMemo, useState } from 'react'
import { findMusic, isMine, playlistItems, type MusicPlaylist } from '../../../../shared/music'
import { MoreGlyph, PauseGlyph, PlayGlyph, TrashGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import { useCrew } from '../../state/store'
import { MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'
import { quietPill, roundButton, solidButton } from './buttons'
import PlaylistCover from './PlaylistCover'
import { span, tracks } from './say'
import TrackRow from './TrackRow'

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
  const [menu, setMenu] = useState(false)
  const items = useMemo(() => playlistItems(playlist, uploads), [playlist, uploads])
  const shown = useMemo(() => findMusic(items, query), [items, query])
  const on = room.playlistId === playlist.id && room.trackId !== null
  const mine = isMine(playlist, selfName)
  const runs = items.reduce((total, item) => total + item.seconds, 0)
  const said = [playlist.by && !mine ? playlist.by : '', tracks(items.length), items.length ? span(runs) : '']
    .filter(Boolean)
    .join(' · ')

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
      <header className="px-4 pt-3 pb-4 flex items-start gap-3.5">
        <PlaylistCover
          items={items}
          size={76}
          playing={on && room.playing}
          className="w-[76px] h-[76px] shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold leading-snug text-fg break-words line-clamp-2">{playlist.name}</h3>
          <p className="mt-0.5 truncate text-xs text-fg-muted">{said}</p>
          <div className="mt-3 flex items-center gap-1">
            <Tooltip label={on && room.playing ? 'Pause' : 'Play'}>
              <button
                onClick={play}
                disabled={items.length === 0}
                aria-label={on && room.playing ? 'Pause' : 'Play'}
                className={`${solidButton} w-9 h-9 disabled:opacity-25`}
              >
                {on && room.playing ? <PauseGlyph className="w-4 h-4" /> : <PlayGlyph className="w-4 h-4" />}
              </button>
            </Tooltip>
            {mine && (
              <span className="relative flex">
                <Tooltip label="More" disabled={menu}>
                  <button
                    onClick={() => setMenu(was => !was)}
                    aria-label="More for this playlist"
                    aria-expanded={menu}
                    aria-haspopup="menu"
                    className={`${roundButton} w-9 h-9 ${menu ? 'text-fg bg-fg/[0.06]' : ''}`}
                  >
                    <MoreGlyph className="w-[18px] h-[18px]" />
                  </button>
                </Tooltip>
                <Popover open={menu} onClose={() => setMenu(false)} align="start" className="min-w-48">
                  <MenuItem
                    icon={<PencilGlyph />}
                    label="Rename playlist"
                    onClick={() => {
                      setMenu(false)
                      setNaming(true)
                    }}
                  />
                  <MenuDivider />
                  <MenuItem
                    icon={<TrashGlyph />}
                    danger
                    label="Delete playlist"
                    onClick={() => {
                      setMenu(false)
                      useMusic.getState().dropPlaylist(playlist.id)
                    }}
                  />
                </Popover>
              </span>
            )}
          </div>
        </div>
      </header>

      <ul className="p-2 pt-0 flex flex-col gap-1">
        {shown.map(item => (
          <TrackRow
            key={item.id}
            item={item}
            on={item.id === room.trackId && on}
            playing={room.playing}
            onPlay={() => put(item.id)}
            within={playlist}
          />
        ))}
        {shown.length === 0 && (
          <li className="px-3 py-8 flex flex-col items-center gap-3">
            <p className="text-sm text-fg-muted">{query.trim() ? 'No tracks found' : 'No tracks yet'}</p>
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
