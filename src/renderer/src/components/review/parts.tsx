import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../../icons'
import Pill from '../Pill'
import Tooltip from '../Tooltip'

// A group of changes, named the way every git client names it. The count rides
// in a pill beside the title and the moves that apply to the whole group stand
// at the other end of the same row, out of the way until the pointer is on it.
export function Section({
  title,
  count,
  open,
  onToggle,
  actions,
  children
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-1.5">
      <div className="group/head flex h-7 items-center gap-2 px-1">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={title}
          className="flex min-w-0 items-center gap-1.5 text-fg-muted transition-colors hover:text-fg"
        >
          <ChevronRightGlyph
            className={`w-3 h-3 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <h3 className="truncate text-xs font-medium">{title}</h3>
        </button>
        <Pill>{count}</Pill>
        <span className="flex-1" />
        {/* The slot is held whether or not the pointer is there, so nothing on
            the row travels as it is reached for. */}
        {actions && (
          <span className="flex items-center opacity-0 transition-opacity duration-150 group-hover/head:opacity-100 focus-within:opacity-100">
            {actions}
          </span>
        )}
      </div>
      {open && children}
    </section>
  )
}

export function SectionAction({
  label,
  icon,
  onClick,
  danger
}: {
  label: string
  icon: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        onClick={onClick}
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-fg/[0.06] active:scale-90 ${
          danger ? 'text-fg-muted hover:text-danger' : 'text-fg-muted hover:text-fg'
        }`}
      >
        {icon}
      </button>
    </Tooltip>
  )
}
