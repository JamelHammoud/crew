import { useState } from 'react'
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
  onForget
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
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div className="pb-3">
      <button
        onClick={onOpen}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        aria-current={here ? 'page' : undefined}
        className={`group relative w-full min-h-11 rounded-xl px-2 py-1.5 flex items-center gap-2.5 text-left transition-colors duration-150 hover:bg-fg/[0.06] ${
          here
            ? 'bg-fg/[0.07] text-fg shadow-[inset_0_0_0_1px_rgb(255_255_255/0.035)]'
            : 'text-fg/70'
        }`}
      >
        <span
          className={`w-7 h-7 shrink-0 rounded-[9px] grid place-items-center transition-colors duration-150 ${
            here
              ? 'bg-fg/[0.08] text-fg/80'
              : 'bg-fg/[0.03] text-fg/45 group-hover:bg-fg/[0.05] group-hover:text-fg/65'
          }`}
        >
          {markOf(place)}
        </span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="truncate text-sm font-medium leading-[17px]">{place.title}</span>
          <span className={`truncate text-xs leading-4 ${here ? 'text-fg/45' : 'text-fg/30 group-hover:text-fg/40'}`}>
            {place.line}
          </span>
        </span>
        {busy && <Spinner size={13} className="text-fg/45" />}
      </button>
      {threads.length > 0 && (
        <div className="relative ml-4 mt-1 space-y-0.5 border-l border-fg/[0.07] pl-3">
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
        </div>
      )}
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
