import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import type { AgentUsage, UsageWindow } from '../../../shared/llm'
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
  if (resetsAt - now < 24 * 60 * 60 * 1000) return `resets ${time}`
  const day = date.toLocaleDateString('en-US', { weekday: 'short' })
  return `resets ${day} ${time}`
}

function isHot(window: UsageWindow): boolean {
  return window.percent >= 90 || (window.severity !== undefined && window.severity !== 'normal')
}

function WindowRow({ window, now }: { window: UsageWindow; now: number }) {
  const hot = isHot(window)
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-sm text-fg-secondary truncate">{window.label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-ink-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${hot ? 'bg-danger' : 'bg-fg'}`}
          style={{ width: `${Math.min(100, Math.max(0, window.percent))}%` }}
        />
      </div>
      <span className={`w-11 shrink-0 text-right text-sm font-semibold tabular-nums ${hot ? 'text-danger' : 'text-fg'}`}>
        {Math.round(window.percent)}%
      </span>
      <span className="w-32 shrink-0 text-right text-xs text-fg-muted truncate">
        {window.resetsAt ? formatReset(window.resetsAt, now) : ''}
      </span>
    </div>
  )
}

// Expandable usage footer on an agent card. Collapsed, it shows the hottest
// window at a glance; expanded, every rate-limit window the provider reports.
export default function UsageFooter({ usage, sharedWith }: { usage: AgentUsage; sharedWith: string[] }) {
  const [open, setOpen] = useState(false)
  const now = useNow(open, 30000)
  const hottest = usage.windows.reduce<UsageWindow | null>(
    (max, window) => (!max || window.percent > max.percent ? window : max),
    null
  )
  const detail = [usage.accountLabel, usage.plan && `${usage.plan} plan`].filter(Boolean).join(' · ')
  const stamp =
    usage.asOf !== undefined ? `as of ${formatAgo(now - usage.asOf)}` : `updated ${formatAgo(now - usage.fetchedAt)}`
  return (
    <div className="border-t border-ink-700">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center px-5 h-11 text-sm font-semibold text-fg-muted hover:text-fg-secondary transition-colors"
      >
        Usage
        <span className="ml-auto flex items-center gap-3">
          {!open && usage.error && <span className="font-normal">unavailable</span>}
          {!open && !usage.error && hottest && (
            <>
              <span className="w-20 h-1.5 rounded-full bg-ink-700 overflow-hidden">
                <span
                  className={`block h-full rounded-full ${isHot(hottest) ? 'bg-danger' : 'bg-fg'}`}
                  style={{ width: `${Math.min(100, Math.max(0, hottest.percent))}%` }}
                />
              </span>
              <span className={`tabular-nums ${isHot(hottest) ? 'text-danger' : 'text-fg'}`}>
                {Math.round(hottest.percent)}%
              </span>
            </>
          )}
          <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-2 animate-rise">
          {(detail || stamp) && (
            <div className="flex items-baseline gap-2 pb-1">
              <span className="text-xs text-fg-muted truncate">{detail}</span>
              <span className="ml-auto shrink-0 text-xs text-fg-muted">{stamp}</span>
            </div>
          )}
          {sharedWith.length > 0 && (
            <p className="text-xs text-fg-muted pb-1">Limits shared with {sharedWith.join(', ')}</p>
          )}
          {usage.error && <p className="text-sm text-fg-muted">{usage.error}</p>}
          {!usage.error && usage.windows.length === 0 && (
            <p className="text-sm text-fg-muted">No usage data available for this provider.</p>
          )}
          {!usage.error && usage.windows.map(window => <WindowRow key={window.key} window={window} now={now} />)}
        </div>
      )}
    </div>
  )
}
