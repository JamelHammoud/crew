import Avatar from '../../components/Avatar'
import Spinner from '../../components/Spinner'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, PencilGlyph, PlusGlyph } from '../../icons'
import PlaceRow from './PlaceRow'
import type { Place } from './places'

// The way in. Every project you have opened and every crew you have joined, in
// one list, and the two ways to reach a new one under it.
export default function Places({
  name,
  places,
  busy,
  busyKey,
  onOpen,
  onForget,
  onPick,
  onJoin,
  onName
}: {
  name: string
  places: Place[]
  busy: boolean
  busyKey: string | null
  onOpen: (place: Place) => void
  onForget: (place: Place) => void
  onPick: () => void
  onJoin: () => void
  onName: () => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono font-semibold text-3xl text-fg select-none">Crew</h1>
        <p className="text-base text-fg-muted mt-2">
          {places.length > 0 ? 'Pick up where you left off.' : 'Open a project and start working.'}
        </p>
      </div>

      {places.length > 0 && (
        <div className="rounded-card bg-ink-800 p-1.5">
          {places.map(place => (
            <PlaceRow
              key={place.key}
              mark={
                place.join ? (
                  <GlobeGlyph className="w-4 h-4 text-fg-secondary" />
                ) : place.project?.home === 'private' ? (
                  <DesktopGlyph className="w-4 h-4 text-fg-secondary" />
                ) : (
                  <FolderGlyph className="w-4 h-4 text-fg-secondary" />
                )
              }
              title={place.title}
              line={place.line}
              busy={busyKey === place.key}
              disabled={busy}
              onOpen={() => onOpen(place)}
              onForget={place.project ? () => onForget(place) : undefined}
            />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={onPick}
          disabled={busy}
          className="w-full h-12 rounded-full bg-fg text-ink-900 text-base font-semibold flex items-center justify-center gap-2 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
        >
          {busy && !busyKey ? <Spinner size={16} /> : <PlusGlyph className="w-4 h-4" />}
          Open a folder
        </button>
        <button
          onClick={onJoin}
          disabled={busy}
          className="w-full h-12 rounded-full border border-ink-600 text-fg text-base font-semibold transition-all duration-150 hover:border-ink-500 hover:bg-fg/[0.03] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
        >
          Join with a link
        </button>
      </div>

      <button
        onClick={onName}
        className="group w-full rounded-2xl px-2 py-2 flex items-center gap-2.5 text-left transition-colors duration-150 hover:bg-ink-800"
      >
        <Avatar name={name || '?'} size="sm" />
        <span className="min-w-0 flex-1 text-sm text-fg-secondary truncate">{name}</span>
        <PencilGlyph className="w-3.5 h-3.5 text-fg-faint transition-colors duration-150 group-hover:text-fg-secondary" />
      </button>
    </div>
  )
}
