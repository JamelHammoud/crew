import { useState, type ReactNode } from 'react'
import { MenuItem, Popover } from '../../components/Popover'
import Spinner from '../../components/Spinner'
import { ArrowRightGlyph, TrashGlyph } from '../../icons'

// One place you can be. A project on this machine and a session somebody
// invited you to are the same row, because from here they are the same thing.
//
// Taking one off the list is a right click rather than a button that fades in
// over the arrow. A row this size has one thing to press, and the arrow saying
// where the row goes is worth more than a second control standing on top of it.
export default function PlaceRow({
  mark,
  title,
  line,
  busy,
  disabled,
  onOpen,
  onForget
}: {
  mark: ReactNode
  title: string
  line: string
  busy?: boolean
  disabled?: boolean
  onOpen: () => void
  onForget?: () => void
}) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  return (
    <div className="group relative">
      <button
        onClick={onOpen}
        onContextMenu={
          onForget && !busy
            ? event => {
                event.preventDefault()
                setMenuAt({ x: event.clientX, y: event.clientY })
              }
            : undefined
        }
        disabled={disabled}
        className="w-full rounded-2xl px-3 py-2.5 flex items-center gap-3 text-left transition-all duration-150 hover:bg-ink-700 active:scale-[0.99] disabled:opacity-50 disabled:scale-100"
      >
        <span className="w-9 h-9 rounded-full bg-ink-700 flex items-center justify-center shrink-0 transition-colors duration-150 group-hover:bg-ink-600">
          {mark}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg truncate">{title}</span>
          <span className="block text-xs text-fg-muted truncate">{line}</span>
        </span>
        {busy ? (
          <Spinner size={15} className="text-fg-muted" />
        ) : (
          <ArrowRightGlyph className="w-4 h-4 text-fg-faint transition-all duration-150 group-hover:text-fg-secondary group-hover:translate-x-0.5" />
        )}
      </button>
      {onForget && (
        <Popover open={menuAt !== null} onClose={() => setMenuAt(null)} at={menuAt ?? undefined} className="min-w-40">
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
      )}
    </div>
  )
}
