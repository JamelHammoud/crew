import { DesktopGlyph, FolderGlyph, GlobeGlyph } from '../../icons'
import type { Place } from '../../views/home/place'

export function markOf(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4" />
  return <FolderGlyph className="w-4 h-4" />
}

// What a place is called and the mark that says where it is kept. It is the row
// in the list and it is what travels with the pointer while one is being moved,
// which is one drawing rather than two: what is in hand is the thing itself.
export default function PlaceFace({ place, lit }: { place: Place; lit?: boolean }) {
  return (
    <>
      <span className={lit ? 'text-fg/70' : 'text-fg/45'}>{markOf(place)}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.title}</span>
    </>
  )
}
