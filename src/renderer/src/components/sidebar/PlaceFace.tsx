import { DesktopGlyph, FolderGlyph, GlobeGlyph } from '../../icons'
import type { Place } from '../../views/home/place'

export function markOf(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4" />
  return <FolderGlyph className="w-4 h-4" />
}

export default function PlaceFace({ place, lit }: { place: Place; lit?: boolean }) {
  return (
    <>
      <span className={lit ? 'text-fg/70' : 'text-fg/45'}>{markOf(place)}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.title}</span>
    </>
  )
}
