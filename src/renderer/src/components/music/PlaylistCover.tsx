import type { MusicItem } from '../../../../shared/music'
import { MusicGlyph } from '../../icons'
import Cover from './Cover'

// A list has no picture of its own, so it wears the pictures of what is in it:
// four in a square once there are four, the first one on its own until then, and
// an empty tile while there is nothing to show.
export default function PlaylistCover({
  items,
  size,
  playing = false,
  className = ''
}: {
  items: readonly MusicItem[]
  size: number
  playing?: boolean
  className?: string
}) {
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
