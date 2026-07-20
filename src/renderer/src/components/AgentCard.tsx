import { StopIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import type { AgentStep, PooledAgent } from '../../../shared/llm'
import Avatar from './Avatar'
import Pill from './Pill'
import Select from './Select'
import Spinner from './Spinner'

const STATUS_LABEL: Record<PooledAgent['status'], string> = {
  idle: 'Ready',
  busy: 'Working',
  offline: 'Away'
}

function ActivityRow({ activity }: { activity: AgentStep }) {
  const [open, setOpen] = useState(false)
  const expandable = Boolean(activity.detail)
  return (
    <div>
      <button
        onClick={() => expandable && setOpen(!open)}
        className={`flex items-center gap-2.5 text-sm w-full text-left ${expandable ? '' : 'cursor-default'}`}
      >
        {activity.status === 'running' ? (
          <Spinner size={12} className="text-fg-secondary" />
        ) : (
          <span className="w-1.5 h-1.5 mx-[3px] rounded-full bg-ink-500 shrink-0" />
        )}
        <span className="text-fg-secondary shrink-0">
          {activity.kind === 'subagent' ? `${activity.name} (agent)` : activity.name}
        </span>
        {activity.detail && !open && <span className="text-fg-faint truncate font-mono text-xs">{activity.detail}</span>}
      </button>
      {open && activity.detail && (
        <p
          onClick={() => setOpen(false)}
          className="text-xs font-mono text-fg-muted leading-5 mt-1.5 ml-[5px] whitespace-pre-wrap break-all border-l-2 border-ink-700 pl-3 cursor-pointer"
        >
          {activity.detail}
        </p>
      )}
    </div>
  )
}

export default function AgentCard({
  agent,
  steps,
  threadCount,
  onStop,
  onSetting,
  onRemove
}: {
  agent: PooledAgent
  steps: AgentStep[]
  threadCount: number
  onStop?: () => void
  onSetting?: (key: string, value: string) => void
  onRemove?: () => void
}) {
  const status = threadCount > 0 ? 'busy' : agent.status
  const activities = steps
    .filter(step => step.kind === 'tool' || step.kind === 'subagent')
    .slice(-6)
    .reverse()

  return (
    <div className="group border-2 border-ink-700 rounded-card overflow-hidden flex flex-col transition-colors duration-200 hover:border-ink-600 animate-rise">
      <div className="px-5 py-4 flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={agent.label} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-fg truncate">{agent.label}</span>
              <Pill>{agent.provider}</Pill>
            </div>
            <span className="text-sm text-fg-muted">{agent.ownerName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {threadCount > 0 && onStop && (
              <button
                onClick={onStop}
                title={threadCount > 1 ? 'Stop all threads' : 'Stop'}
                aria-label="Stop"
                className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/[0.06] transition-colors"
              >
                <StopIcon className="w-4 h-4" />
              </button>
            )}
            {onRemove && threadCount === 0 && (
              <button
                onClick={onRemove}
                title="Remove agent"
                aria-label="Remove agent"
                className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {onSetting && agent.fields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {agent.fields.map(field => (
              <Select
                key={field.key}
                label={field.label}
                value={agent.settings[field.key] ?? field.default}
                options={field.options}
                onChange={value => onSetting(field.key, value)}
              />
            ))}
          </div>
        )}
        {activities.length > 0 && (
          <div className="space-y-2">
            {activities.map(activity => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
      <div className="bg-ink-700 px-5 h-11 flex items-center gap-2.5">
        {status === 'busy' ? (
          <Spinner size={14} className="text-fg" />
        ) : (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${status === 'idle' ? 'bg-positive' : 'bg-ink-500'}`}
          />
        )}
        <span className="text-sm font-semibold text-fg">{STATUS_LABEL[status]}</span>
        {threadCount > 1 && <span className="text-sm text-fg-muted">on {threadCount} threads</span>}
      </div>
    </div>
  )
}
