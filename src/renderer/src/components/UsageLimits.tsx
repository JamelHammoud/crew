import type { AgentUsage, UsageWindow } from '../../../shared/llm'
import Pill from './Pill'
import { useNow } from './useNow'

function formatAgo(ms: number): string {
  if (ms < 90 * 1000) return 'just now'
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatReset(resetsAt: number, now: number): string {
  const date = new Date(resetsAt)
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (resetsAt - now < 24 * 60 * 60 * 1000) return `Resets ${time}`
  const day = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `Resets ${day} ${time}`
}

function WindowRow({ window, now }: { window: UsageWindow; now: number }) {
  const percent = Math.round(window.percent)
  const hot = percent >= 90 || (window.severity !== undefined && window.severity !== 'normal')

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">{window.label}</span>
        {window.resetsAt && <span className="shrink-0 text-xs text-fg-muted">{formatReset(window.resetsAt, now)}</span>}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${hot ? 'bg-danger' : 'bg-fg'}`}
            style={{ width: `${Math.min(100, Math.max(0, window.percent))}%` }}
          />
        </div>
        <span className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${hot ? 'text-danger' : 'text-fg'}`}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

export default function UsageLimits({
  usage,
  sharesAccount = false
}: {
  usage?: AgentUsage
  sharesAccount?: boolean
}) {
  const now = useNow(Boolean(usage), 30000)
  const detail = usage && [usage.accountLabel, usage.plan && `${usage.plan} plan`].filter(Boolean).join(' · ')
  const stamp = usage
    ? usage.asOf !== undefined
      ? `As of ${formatAgo(now - usage.asOf)}`
      : `Updated ${formatAgo(now - usage.fetchedAt)}`
    : null

  return (
    <div className="rounded-2xl bg-ink-850 px-4 py-3.5 ring-1 ring-inset ring-white/[0.04]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-semibold text-fg">Usage limits</span>
        {sharesAccount && <Pill>Same account</Pill>}
        {stamp && <span className="ml-auto shrink-0 text-xs text-fg-muted">{stamp}</span>}
      </div>
      {detail && <p className="mt-0.5 truncate text-xs text-fg-muted">{detail}</p>}
      {!usage && <p className="mt-2 text-sm text-fg-muted">No usage data available for this provider.</p>}
      {usage?.error && <p className="mt-2 text-sm text-fg-muted">{usage.error}</p>}
      {usage && !usage.error && usage.windows.length === 0 && (
        <p className="mt-2 text-sm text-fg-muted">No usage limits reported.</p>
      )}
      {usage && !usage.error && usage.windows.length > 0 && (
        <div className="mt-3 space-y-3">
          {usage.windows.map(window => (
            <WindowRow key={window.key} window={window} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}
