import type { PooledAgent } from '../../../shared/llm'
import Pill from './Pill'

const STATUS_LABEL: Record<PooledAgent['status'], string> = {
  idle: 'Ready',
  busy: 'Working',
  offline: 'Away'
}

export default function AgentCard({
  agent,
  onStop
}: {
  agent: PooledAgent
  onStop?: () => void
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
          <Pill solid={agent.status === 'busy'}>{STATUS_LABEL[agent.status]}</Pill>
        </div>
      </div>
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
