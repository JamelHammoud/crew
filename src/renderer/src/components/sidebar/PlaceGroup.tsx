import { memo, useCallback, useState } from 'react'
import { TrashGlyph } from '../../icons'
import Spinner from '../Spinner'
import { MenuItem, Popover } from '../Popover'
import PlaceFace from './PlaceFace'
import ThreadRow from './ThreadRow'
import { samePlaceGroup, type PlaceGroupProps } from './placeItems'

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
      className={`flex flex-col gap-0.5 transition-opacity duration-150 ${
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
        aria-current={here ? 'true' : undefined}
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

export default memo(PlaceGroup, samePlaceGroup)
