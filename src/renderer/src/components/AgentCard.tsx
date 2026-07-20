import type { PooledAgent } from '../../../shared/llm'
import Pill from './Pill'

const STATUS_LABEL: Record<PooledAgent['status'], string> = {
  idle: 'Ready',
  busy: 'Working',
  offline: 'Away'
}

export default function AgentCard({
  agent,
  onStop,
  onSetting,
  onRemove
}: {
  agent: PooledAgent
  onStop?: () => void
  onSetting?: (key: string, value: string) => void
  onRemove?: () => void
}) {
  const activities = agent.activities.slice(-8).reverse()
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">{agent.label}</span>
        <Pill>{agent.provider}</Pill>
        <span className="text-xs text-zinc-500">{agent.ownerName}</span>
        <div className="ml-auto flex items-center gap-2">
          {agent.status === 'busy' && onStop && (
            <button onClick={onStop} className="text-[11px] text-zinc-400 hover:text-white">
              Stop
            </button>
          )}
          {onRemove && agent.status !== 'busy' && (
            <button onClick={onRemove} className="text-[11px] text-zinc-500 hover:text-red-400">
              Remove
            </button>
          )}
          <Pill solid={agent.status === 'busy'}>{STATUS_LABEL[agent.status]}</Pill>
        </div>
      </div>
      {onSetting && agent.fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {agent.fields.map(field => (
            <label key={field.key} className="flex items-center gap-1.5 text-xs text-zinc-500">
              {field.label}
              <select
                value={agent.settings[field.key] ?? field.default}
                onChange={event => onSetting(field.key, event.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-300 outline-none focus:border-zinc-700"
              >
                {field.options.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {activities.length > 0 && (
        <div className="space-y-1.5">
          {activities.map(activity => (
            <div key={activity.id} className="flex items-center gap-2 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activity.status === 'running' ? 'bg-white animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className="text-zinc-300">{activity.kind === 'subagent' ? `${activity.name} (agent)` : activity.name}</span>
              {activity.detail && <span className="text-zinc-600 truncate">{activity.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
