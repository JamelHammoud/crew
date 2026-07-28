import type { ReactNode } from 'react'
import Spinner from '../../components/Spinner'
import Tooltip from '../../components/Tooltip'
import { ArrowRightGlyph, CloseGlyph } from '../../icons'

// One place you can be. A project on this machine and a session somebody
// invited you to are the same row, because from here they are the same thing.
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
  return (
    <div className="group relative">
      <button
        onClick={onOpen}
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
          <ArrowRightGlyph
            className={`w-4 h-4 text-fg-faint transition-all duration-150 group-hover:text-fg-secondary group-hover:translate-x-0.5 ${
              onForget ? 'group-hover:opacity-0' : ''
            }`}
          />
        )}
      </button>
      {onForget && !busy && (
        <Tooltip label="Forget" className="absolute right-3 top-1/2 -translate-y-1/2">
          <button
            onClick={onForget}
            aria-label="Forget this project"
            className="w-6 h-6 rounded-full flex items-center justify-center text-fg-faint opacity-0 transition-all duration-150 hover:bg-ink-600 hover:text-fg group-hover:opacity-100 active:scale-95"
          >
            <CloseGlyph className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  )
}
