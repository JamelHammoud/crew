import { StopIcon, TrashIcon } from '@heroicons/react/16/solid'
import type { PooledAgent } from '../../../shared/llm'
import AgentIcon from './AgentIcon'
import Pill from './Pill'
import Select from './Select'
import Spinner from './Spinner'
import Tooltip from './Tooltip'
import UsageLimits from './UsageLimits'

export default function AgentCard({
  agent,
  threadCount,
  onStop,
  onSetting,
  onRemove,
  sharesUsageAccount = false
}: {
  agent: PooledAgent
  threadCount: number
  onStop?: () => void
  onSetting?: (key: string, value: string) => void
  onRemove?: () => void
  sharesUsageAccount?: boolean
}) {
  const status = threadCount > 0 ? 'busy' : agent.status

  return (
    <div className="group border border-ink-700 rounded-card flex flex-col transition-colors duration-200 hover:border-ink-600 animate-rise">
      <div className="px-5 py-4 flex-1 space-y-4">
        <div className="flex items-center gap-3">
          <AgentIcon seed={agent.id} presence={agent.status === 'offline' ? 'offline' : 'online'} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-fg truncate">{agent.label}</span>
              <Pill>{agent.provider}</Pill>
            </div>
            <span className="text-sm text-fg-muted">{agent.ownerName}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {threadCount > 0 && onStop && (
              <Tooltip label={threadCount > 1 ? 'Stop all threads' : 'Stop'}>
                <button
                  onClick={onStop}
                  aria-label="Stop"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg hover:bg-white/[0.06] transition-colors"
                >
                  <StopIcon className="w-4 h-4" />
                </button>
              </Tooltip>
            )}
            {onRemove && threadCount === 0 && (
              <Tooltip label="Remove agent">
                <button
                  onClick={onRemove}
                  aria-label="Remove agent"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </Tooltip>
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
        <UsageLimits usage={agent.usage} sharesAccount={sharesUsageAccount} />
      </div>
      {status === 'busy' && (
        <div className="bg-ink-700 px-5 h-11 flex items-center gap-2.5 rounded-b-[19px]">
          <Spinner size={14} className="text-fg" />
          <span className="text-sm font-semibold text-fg">Working</span>
          {threadCount > 1 && <span className="text-sm text-fg-muted">on {threadCount} threads</span>}
        </div>
      )}
    </div>
  )
}
