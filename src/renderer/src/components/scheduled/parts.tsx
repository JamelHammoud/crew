import type { ReactNode } from 'react'

export const MORNING = 9 * 60

// The card is glass, so nothing on it is set in a solid grey: a field takes the
// foreground at an opacity the way everything else on a floating panel does.
// The clock the machine draws on a time field is the one mark in here nobody at
// Crew drew, so it is taken off and the field is typed into.
export const PILL_INPUT =
  'h-8 px-3 rounded-full bg-fg/[0.07] text-sm text-fg tabular-nums outline-none transition-colors duration-150 hover:bg-fg/[0.1] focus:bg-fg/[0.14] [&::-webkit-calendar-picker-indicator]:hidden'

// A row of controls read left to right as one sentence. What a schedule does and
// when it runs are both a line of plain words with the parts you can change set
// in pills, so the card says what it is about to do without a preview of itself
// underneath.
export function Line({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

// The words between those pills. They are read rather than pressed, so they are
// the quietest thing on the line.
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

// One day of the week. They are a strip rather than a row of pills that each
// hug their own word, so a week reads as a week.
export function Day({ label, picked, onClick }: { label: string; picked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={picked}
      className={`w-11 h-8 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 ${
        picked ? 'bg-fg text-ink-900' : 'bg-fg/[0.07] text-fg/70 hover:bg-fg/[0.12] hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
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

export const clockOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const minutesOf = (written: string, fallback: number): number => {
  const [hh, mm] = written.split(':')
  const at = Number(hh) * 60 + Number(mm)
  return Number.isFinite(at) ? at : fallback
}
