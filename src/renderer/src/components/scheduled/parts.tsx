import type { ReactNode } from 'react'

export const PILL_INPUT =
  'h-9 px-3.5 rounded-full bg-ink-800 text-sm text-fg outline-none transition-shadow duration-200 focus:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] light:focus:shadow-[0_0_0_1px_rgb(0_0_0/0.14)]'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="block text-xs font-medium text-fg/45 mb-1.5">{label}</span>
      {children}
    </div>
  )
}

export function Choice({
  label,
  mark,
  picked,
  onClick
}: {
  label: string
  mark?: ReactNode
  picked: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={picked}
      className={`h-8 px-3 rounded-full flex items-center gap-1.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
        picked ? 'bg-fg text-ink-900' : 'bg-fg/[0.06] text-fg/70 hover:bg-fg/[0.1] hover:text-fg'
      }`}
    >
      {mark}
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
      className={`w-full flex items-center gap-2 px-3 h-10 rounded-xl text-left transition-colors duration-150 ${
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

export function Scroller({ empty, children }: { empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="text-sm text-fg/45">{empty}</p>
  return <div className="max-h-40 overflow-y-auto overscroll-contain no-scrollbar">{children}</div>
}

export const clockOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const minutesOf = (written: string, fallback: number): number => {
  const [hh, mm] = written.split(':')
  const at = Number(hh) * 60 + Number(mm)
  return Number.isFinite(at) ? at : fallback
}
