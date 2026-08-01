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
  const held = here || threads.length > 0

  return (
    <div
      className={`mb-2 rounded-[16px] p-1 transition-colors duration-150 ${
        here
          ? 'bg-fg/[0.055] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.045),0_8px_24px_rgb(0_0_0/0.1)]'
          : held
            ? 'bg-fg/[0.022]'
            : 'hover:bg-fg/[0.025]'
      }`}
    >
      <button
        onClick={onOpen}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        aria-current={here ? 'page' : undefined}
        className={`group w-full min-h-11 rounded-xl px-1.5 py-1.5 flex items-center gap-2.5 text-left transition-colors duration-150 ${
          here ? 'text-fg' : 'text-fg/70 hover:bg-fg/[0.04] hover:text-fg'
        }`}
      >
        <span
          className={`w-8 h-8 shrink-0 rounded-[10px] grid place-items-center border transition-colors duration-150 ${
            here
              ? 'border-fg/[0.1] bg-fg/[0.1] text-fg/85'
              : 'border-fg/[0.055] bg-fg/[0.035] text-fg/45 group-hover:border-fg/[0.08] group-hover:bg-fg/[0.055] group-hover:text-fg/70'
          }`}
        >
          {markOf(place)}
        </span>
        <span className="min-w-0 flex-1 flex flex-col">
          <span className="truncate text-sm font-medium leading-[17px]">{place.title}</span>
          <span className={`truncate text-xs leading-4 ${here ? 'text-fg/45' : 'text-fg/30 group-hover:text-fg/45'}`}>
            {place.line}
          </span>
        </span>
        {busy && <Spinner size={13} className="text-fg/45" />}
      </button>
      {threads.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-fg/[0.055] pt-1">
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
