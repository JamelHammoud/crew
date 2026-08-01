import { useState } from 'react'
import type { LiveThread } from '../../../../shared/threads'
import { DesktopGlyph, FolderGlyph, GlobeGlyph, TrashGlyph } from '../../icons'
import Spinner from '../Spinner'
import { MenuItem, Popover } from '../Popover'
import type { Place } from '../../views/home/place'

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
  openThreadId,
  onOpen,
  onOpenThread,
  onStop,
  onForget
}: {
  place: Place
  here: boolean
  busy: boolean
  threads: LiveThread[]
  openThreadId: string | null
  onOpen: () => void
  onOpenThread: (threadId: string) => void
  onStop?: () => void
  onForget: () => void
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div className="pb-4">
      <button
        onClick={onOpen}
        onContextMenu={event => {
          event.preventDefault()
          setMenuAt({ x: event.clientX, y: event.clientY })
        }}
        title={place.line}
        className={`w-full rounded-xl px-2 py-1.5 flex items-center gap-2 text-left transition-colors duration-150 hover:bg-ink-700 ${
          here ? 'text-fg' : 'text-fg-secondary'
        }`}
      >
        <span className={here ? 'text-fg-secondary' : 'text-fg-faint'}>{markOf(place)}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{place.title}</span>
        {busy && <Spinner size={13} className="text-fg-muted" />}
      </button>
      {threads.map(thread => (
        <button
          key={thread.id}
          onClick={() => onOpenThread(thread.id)}
          className={`w-full rounded-xl pl-8 pr-2 py-1.5 flex items-center gap-2 text-left text-sm transition-colors duration-150 ${
            thread.id === openThreadId
              ? 'bg-ink-700 text-fg'
              : 'text-fg-secondary hover:bg-ink-700/60 hover:text-fg'
          }`}
        >
          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
          {thread.working && <span className="w-1.5 h-1.5 rounded-full bg-positive shrink-0 animate-pulse" />}
        </button>
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
