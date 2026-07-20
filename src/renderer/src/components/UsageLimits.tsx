import type { AgentUsage, PooledAgent, UsageWindow } from '../../../shared/llm'
import Pill from './Pill'
import { useNow } from './useNow'

// Agents whose usage carries the same provider + account id share one set of
// limits, so they are shown as a single card listing every agent on it.
interface AccountGroup {
  key: string
  agents: PooledAgent[]
  usage?: AgentUsage
}

function groupByAccount(agents: PooledAgent[]): AccountGroup[] {
  const groups = new Map<string, AccountGroup>()
  for (const agent of agents) {
    const account = agent.usage?.accountId
    const key = account ? `${agent.usage!.provider}:${account}` : agent.id
    const group = groups.get(key)
    if (group) {
      group.agents.push(agent)
      // Prefer the freshest report when two agents carry the same account.
      if (agent.usage && (!group.usage || agent.usage.fetchedAt > group.usage.fetchedAt)) {
        group.usage = agent.usage
      }
    } else {
      groups.set(key, { key, agents: [agent], usage: agent.usage })
    }
  }
  return [...groups.values()]
}

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

function WindowRow({ window, now }: { window: UsageWindow; now: number }) {
  const percent = Math.round(window.percent)
  const hot = percent >= 90 || (window.severity !== undefined && window.severity !== 'normal')
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
        {percent}%
      </span>
      <span className="w-32 shrink-0 text-right text-xs text-fg-muted truncate">
        {window.resetsAt ? formatReset(window.resetsAt, now) : ''}
      </span>
    </div>
  )
}

function AccountCard({ group, now }: { group: AccountGroup; now: number }) {
  const usage = group.usage
  const names = group.agents.map(a => a.label).join(', ')
  const provider = usage?.provider ?? group.agents[0].provider
  const detail = usage && [usage.accountLabel, usage.plan && `${usage.plan} plan`].filter(Boolean).join(' · ')
  const stamp = usage
    ? usage.asOf !== undefined
      ? `as of ${formatAgo(now - usage.asOf)}`
      : `updated ${formatAgo(now - usage.fetchedAt)}`
    : null
  return (
    <div className="border border-ink-700 rounded-card px-5 py-4 space-y-3 animate-rise">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-base font-semibold text-fg truncate">{names}</span>
        <Pill>{provider}</Pill>
        {group.agents.length > 1 && <Pill>same account</Pill>}
        {stamp && <span className="ml-auto shrink-0 text-xs text-fg-muted">{stamp}</span>}
      </div>
      {detail && <p className="text-xs text-fg-muted -mt-1 truncate">{detail}</p>}
      {!usage && (
        <p className="text-sm text-fg-muted">No usage data available for this provider.</p>
      )}
      {usage?.error && <p className="text-sm text-fg-muted">{usage.error}</p>}
      {usage && !usage.error && (
        <div className="space-y-2">
          {usage.windows.map(window => (
            <WindowRow key={window.key} window={window} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function UsageLimits({ agents }: { agents: PooledAgent[] }) {
  const now = useNow(agents.length > 0, 30000)
  if (agents.length === 0) return null
  const groups = groupByAccount(agents)
  return (
    <section>
      <h2 className="text-sm font-semibold text-fg-muted mb-4">Usage limits</h2>
      <div className="space-y-4">
        {groups.map(group => (
          <AccountCard key={group.key} group={group} now={now} />
        ))}
      </div>
    </section>
  )
}
