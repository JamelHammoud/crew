import { useState, type PointerEvent as Press } from 'react'
import type { LiveThread } from '../../../../shared/threads'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, TrashGlyph } from '../../icons'
import Spinner from '../Spinner'
import { MenuItem, Popover } from '../Popover'
import type { Place } from '../../views/home/place'
import ThreadRow from './ThreadRow'

function markOf(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4" />
  return <FolderGlyph className="w-4 h-4" />
}

export default function PlaceGroup({
  place,
  here,
  busy,
  threads,
  openThreadIds,
  onOpen,
  onOpenThread,
  onOpenThreadToRight,
  onStop,
  onForget,
  onTake,
  dragged
}: {
  place: Place
  here: boolean
  busy: boolean
  threads: LiveThread[]
  openThreadIds: string[]
  onOpen: () => void
  onOpenThread: (threadId: string) => void
  onOpenThreadToRight: (threadId: string) => void
  onStop?: () => void
  onForget: () => void
  onTake: (event: Press) => void
  dragged: () => boolean
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div data-reorder={place.key} className="pb-4">
      <button
        onPointerDown={onTake}
        onClick={() => {
          if (!dragged()) onOpen()
        }}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        aria-current={here ? 'page' : undefined}
        className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left cursor-grab active:cursor-grabbing transition-[color,background-color,scale] duration-150 hover:bg-fg/[0.06] active:scale-[0.99] ${
          here ? 'text-fg' : 'text-fg/70'
        }`}
      >
        <span className={here ? 'text-fg/70' : 'text-fg/45'}>{markOf(place)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.title}</span>
        {busy && <Spinner size={13} className="text-fg/45" />}
      </button>
      {threads.map(thread => (
        <ThreadRow
          key={thread.id}
          thread={thread}
          open={openThreadIds.includes(thread.id)}
          here={here}
          placeKey={place.key}
          onOpen={() => onOpenThread(thread.id)}
          onOpenToRight={() => onOpenThreadToRight(thread.id)}
        />
      ))}
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-44">
        {onStop && (
          <MenuItem
            label="Stop this crew"
            onClick={() => {
              setMenuAt(null)
              onStop()
            }}
          />
        )}
        <MenuItem
          icon={<TrashGlyph className="w-4 h-4" />}
          label="Remove from the list"
          danger
          onClick={() => {
            setMenuAt(null)
            onForget()
          }}
        />
      </Popover>
    </div>
  )
}
