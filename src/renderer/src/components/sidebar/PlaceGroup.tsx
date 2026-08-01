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
    <div className="pb-2.5">
      <button
        onClick={onOpen}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        aria-current={here ? 'page' : undefined}
        className={`group relative w-full min-h-10 rounded-xl px-2 py-1.5 flex items-center gap-2 text-left transition-colors duration-150 hover:bg-fg/[0.055] ${
          here
            ? 'bg-fg/[0.045] text-fg before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-fg/80'
            : 'text-fg/65 hover:text-fg/85'
        }`}
      >
        <span
          className={`w-6 h-6 shrink-0 grid place-items-center transition-colors duration-150 ${
            here ? 'text-fg/75' : 'text-fg/35 group-hover:text-fg/60'
          }`}
        >
          {markOf(place)}
        </span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="truncate text-sm font-medium leading-[17px]">{place.title}</span>
          <span className={`truncate text-xs leading-4 ${here ? 'text-fg/40' : 'text-fg/25 group-hover:text-fg/40'}`}>
            {place.line}
          </span>
        </span>
        {busy && <Spinner size={13} className="text-fg/45" />}
      </button>
      {threads.length > 0 && (
        <div className="mt-0.5 space-y-0.5">
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
