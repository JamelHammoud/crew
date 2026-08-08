export const MORNING = 9 * 60

export const PILL_INPUT =
  'h-8 px-3 rounded-full bg-fg/[0.07] text-sm text-fg tabular-nums outline-none transition-colors duration-150 hover:bg-fg/[0.1] focus:bg-fg/[0.14] [&::-webkit-calendar-picker-indicator]:hidden'

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

export const clockOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export const minutesOf = (written: string, fallback: number): number => {
  const [hh, mm] = written.split(':')
  const at = Number(hh) * 60 + Number(mm)
  return Number.isFinite(at) ? at : fallback
}
