import { formatDay } from './time'

export default function DayDivider({ ts }: { ts: number }) {
  return (
    <div className="flex items-center gap-4 animate-rise">
      <span className="h-px bg-ink-700 flex-1" />
      <span className="text-xs font-semibold text-fg-muted select-none">{formatDay(ts)}</span>
      <span className="h-px bg-ink-700 flex-1" />
    </div>
  )
}
