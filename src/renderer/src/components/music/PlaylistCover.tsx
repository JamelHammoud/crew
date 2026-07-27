import { musicSet, type MusicItem, type MusicPlaylist } from '../../../../shared/music'
import { MusicGlyph } from '../../icons'
import Cover from './Cover'
import CrewGlass from './CrewGlass'

// A list somebody made has no picture of its own, so it wears the pictures of
// what is in it: four in a square once there are four, the first one on its own
// until then, and an empty tile while there is nothing to show.
//
// The app's own list is the one that does have a picture of its own. It is
// always the same list, so it is photographed like a track, out of its own
// colors, and the mark stands in it as glass rather than being printed on top.
export default function PlaylistCover({
  playlist,
  items,
  size,
  playing = false,
  className = ''
}: {
  playlist: MusicPlaylist
  items: readonly MusicItem[]
  size: number
  playing?: boolean
  className?: string
}) {
  const set = musicSet(playlist.id)
  if (set) {
    return (
      <Cover item={set} size={size} playing={playing} className={className}>
        <CrewGlass className="absolute inset-0 w-full h-full" />
      </Cover>
    )
  }
  if (items.length >= 4) {
    return (
      <span className={`grid grid-cols-2 grid-rows-2 overflow-hidden ${className}`}>
        {items.slice(0, 4).map(item => (
          <Cover key={item.id} item={item} size={size / 2} playing={playing} className="w-full h-full" />
        ))}
      </span>
    )
  }
  if (items.length > 0) {
    return <Cover item={items[0]} size={size} playing={playing} className={className} />
  }
  return (
    <span className={`bg-ink-800 flex ring-1 ring-inset ring-fg/[0.06] ${className}`}>
      <MusicGlyph className="w-1/3 h-1/3 m-auto text-fg-faint" />
    </span>
  )
}
