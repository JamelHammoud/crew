import { memo, useCallback, useState, type PointerEvent as Press } from 'react'
import type { LiveThread } from '../../../../shared/threads'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, TrashGlyph } from '../../icons'
import Spinner from '../Spinner'
import { MenuItem, Popover } from '../Popover'
import type { Place } from '../../views/home/place'
import ThreadRow from './ThreadRow'
import { samePlace, sameLiveThreads } from './placeItems'

function markOf(place: Place) {
  if (place.join) return <GlobeGlyph className="w-4 h-4" />
  if (place.project?.home === 'private') return <DesktopGlyph className="w-4 h-4" />
  return <FolderGlyph className="w-4 h-4" />
}

interface PlaceGroupProps {
  place: Place
  here: boolean
  busy: boolean
  stoppable: boolean
  threads: LiveThread[]
  openThreadIds: string[]
  onOpen: (place: Place) => void
  onOpenThread: (place: Place, threadId: string, toRight: boolean) => void
  onStop: (place: Place) => void
  onForget: (place: Place) => void
  take: (id: string) => (event: Press) => void
  dragged: () => boolean
}

function PlaceGroup({
  place,
  here,
  busy,
  stoppable,
  threads,
  openThreadIds,
  onOpen,
  onOpenThread,
  onStop,
  onForget,
  take,
  dragged
}: PlaceGroupProps) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const openThread = useCallback(
    (threadId: string) => onOpenThread(place, threadId, false),
    [onOpenThread, place]
  )
  const openThreadToRight = useCallback(
    (threadId: string) => onOpenThread(place, threadId, true),
    [onOpenThread, place]
  )

  return (
    <div
      data-reorder={place.key}
      className={`pb-4 transition-opacity duration-150 ${
        here ? 'opacity-100' : 'opacity-45 hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        onPointerDown={take(place.key)}
        onClick={() => {
          if (!dragged()) onOpen(place)
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
          onOpen={openThread}
          onOpenToRight={openThreadToRight}
        />
      ))}
      <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-44">
        {stoppable && (
          <MenuItem
            label="Stop this crew"
            onClick={() => {
              setMenuAt(null)
              onStop(place)
            }}
          />
        )}
        <MenuItem
          icon={<TrashGlyph className="w-4 h-4" />}
          label="Remove from the list"
          danger
          onClick={() => {
            setMenuAt(null)
            onForget(place)
          }}
        />
      </Popover>
    </div>
  )
}

export default memo(
  PlaceGroup,
  (a, b) =>
    a.here === b.here &&
    a.busy === b.busy &&
    a.stoppable === b.stoppable &&
    a.openThreadIds === b.openThreadIds &&
    a.onOpen === b.onOpen &&
    a.onOpenThread === b.onOpenThread &&
    a.onStop === b.onStop &&
    a.onForget === b.onForget &&
    a.take === b.take &&
    a.dragged === b.dragged &&
    samePlace(a.place, b.place) &&
    sameLiveThreads(a.threads, b.threads)
)
