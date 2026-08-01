import type { ReactNode } from 'react'
import { ChevronRightGlyph } from '../../icons'
import Tooltip from '../Tooltip'

// A group of changes, named the way every git client names it. It is a heading
// over a list rather than a card holding one, so it is as tall as the words and
// the count stands beside the title in plain type: a pill there is a second
// object on a row whose whole job is to be read past.
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
    <section>
      <div className="group/head flex h-6 items-center gap-1.5 pl-1 pr-1.5">
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-label={title}
          className="flex min-w-0 items-center gap-1 text-fg-muted transition-colors hover:text-fg"
        >
          <ChevronRightGlyph
            className={`w-3 h-3 shrink-0 text-fg-faint transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          />
          <h3 className="truncate text-xs font-medium">{title}</h3>
          <span className="ml-1 text-xs tabular-nums text-fg-faint">{count}</span>
        </button>
        <span className="flex-1" />
        {/* The slot is held whether or not the pointer is there, so nothing on
            the row travels as it is reached for. */}
        {actions && (
          <span className="flex items-center opacity-0 transition-opacity duration-150 group-hover/head:opacity-100 focus-within:opacity-100">
            {actions}
          </span>
        )}
      </div>
      {open && <div className="pt-0.5">{children}</div>}
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
        className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-fg/10 active:scale-90 ${
          danger ? 'text-fg-muted hover:text-danger' : 'text-fg-muted hover:text-fg'
        }`}
      >
        {icon}
      </button>
    </Tooltip>
  )
}

// How far through the reading somebody is, as a line rather than as a sentence.
// It is the one fact a list of files cannot say about itself, and said in words
// it costs a row of the panel for the whole of a session to carry a number that
// is only ever glanced at. It stands only once there is something to say.
export function Progress({ seen, of }: { seen: number; of: number }) {
  if (seen === 0 || of === 0) return null
  const label = `${seen} of ${of} viewed`
  return (
    <Tooltip label={label}>
      <div aria-label={label} className="h-0.5 w-full bg-fg/[0.06]">
        <div
          className="h-full bg-fg/25 transition-[width] duration-300"
          style={{ width: `${Math.round((seen / of) * 100)}%` }}
        />
      </div>
    </Tooltip>
  )
}
