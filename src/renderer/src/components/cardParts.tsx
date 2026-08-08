import type { ReactNode } from 'react'

// What a card asking one question is built from: a line of pills, a rule that
// bleeds back through the padding the card holds its content in, and the lists a
// choice is picked out of. A schedule and a tool are the same card twice, so
// this is one file rather than two that drift apart the first time either moves.

export function Line({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

export function Word({ children }: { children: ReactNode }) {
  return <span className="text-sm text-fg/45">{children}</span>
}

export function Rule() {
  return <div className="h-px -mx-6 bg-fg/[0.07]" />
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="block mb-1.5 text-xs font-medium text-fg/45">{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-fg/35">{children}</p>
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-4 text-fg/35">{children}</p>
}

export function Picked({
  label,
  note,
  picked,
  order,
  onClick
}: {
  label: string
  note?: string
  picked: boolean
  order?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={picked}
      className={`w-full flex items-center gap-2 px-3 h-9 rounded-xl text-left transition-colors duration-150 ${
        picked ? 'bg-fg/[0.12] text-fg' : 'text-fg/70 hover:bg-fg/[0.06] hover:text-fg'
      }`}
    >
      <span className="flex-1 min-w-0 truncate text-sm">{label}</span>
      {note && <span className="shrink-0 text-xs text-fg/45">{note}</span>}
      {order !== undefined && (
        <span className="shrink-0 w-5 h-5 rounded-full bg-fg text-ink-900 text-xs font-semibold flex items-center justify-center">
          {order}
        </span>
      )}
    </button>
  )
}

export function Scroller({ children }: { children: ReactNode[] }) {
  return <div className="max-h-40 overflow-y-auto overscroll-contain no-scrollbar">{children}</div>
}
