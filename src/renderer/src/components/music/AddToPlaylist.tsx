import { useMemo } from 'react'
import { playlistItems, type MusicItem, type MusicPlaylist } from '../../../../shared/music'
import { CheckGlyph, ChevronLeftGlyph, PlusGlyph } from '../../icons'
import { useMusic } from '../../state/music'
import PlaylistCover from './PlaylistCover'
import { tracks } from './say'

// Filing a track, as a screen inside the menu that opened it. A list is picked
// the way it is played, by its cover and its name, rather than off a line of
// text: the same rows the Playlists tab holds, at the size a menu wears them.
function Row({
  playlist,
  trackId,
  onPick
}: {
  playlist: MusicPlaylist
  trackId: string
  onPick: (on: boolean) => void
}) {
  const uploads = useMusic(s => s.uploads)
  const items = useMemo(() => playlistItems(playlist, uploads), [playlist, uploads])
  const held = playlist.trackIds.includes(trackId)

  return (
    <button
      onClick={() => onPick(!held)}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors hover:bg-fg/5"
    >
      <PlaylistCover items={items} size={32} className="w-8 h-8 shrink-0 rounded-lg" />
      <span className="flex-1 min-w-0">
        <span className={`block truncate text-sm ${held ? 'text-fg' : 'text-fg/70'}`}>{playlist.name}</span>
        <span className="block truncate text-[11px] text-fg/40">{tracks(items.length)}</span>
      </span>
      {held ? (
        <CheckGlyph className="w-4 h-4 shrink-0 text-fg" />
      ) : (
        <PlusGlyph className="w-4 h-4 shrink-0 text-fg/40" />
      )}
    </button>
  )
}

export default function AddToPlaylist({
  item,
  playlists,
  onBack,
  onPick,
  onNew
}: {
  item: MusicItem
  playlists: MusicPlaylist[]
  onBack: () => void
  onPick: (playlistId: string, on: boolean) => void
  onNew: () => void
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 px-1 pb-2">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-fg/70 transition-colors hover:text-fg hover:bg-fg/10"
        >
          <ChevronLeftGlyph className="w-4 h-4" />
        </button>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">Add to playlist</span>
          <span className="block truncate text-[11px] text-fg/40">{item.name}</span>
        </span>
      </div>

      {playlists.map(playlist => (
        <Row key={playlist.id} playlist={playlist} trackId={item.id} onPick={on => onPick(playlist.id, on)} />
      ))}

      <button
        onClick={onNew}
        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors hover:bg-fg/5"
      >
        <span className="w-8 h-8 shrink-0 rounded-lg border border-dashed border-fg/20 flex items-center justify-center text-fg/45">
          <PlusGlyph className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0 truncate text-sm text-fg/70">New playlist</span>
      </button>
    </>
  )
}
