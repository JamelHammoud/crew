import { useCrew } from '../../state/store'
import AgentCard from '../AgentCard'
import CreateAgent from '../CreateAgent'
import { Page } from './parts'

export default function Agents() {
  const agents = useCrew(s => s.agents)
  const sorted = [...agents].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  const activePrompts = useCrew(s => s.activePrompts)
  const selfId = useCrew(s => s.selfId)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const updateAgentSetting = useCrew(s => s.updateAgentSetting)
  const renameAgent = useCrew(s => s.renameAgent)
  const setAgentAvatar = useCrew(s => s.setAgentAvatar)
  const removeAgent = useCrew(s => s.removeAgent)

  return (
    <Page title="Agents">
      <div className="flex items-center justify-between -mt-1 mb-4">
        <p className="text-sm text-fg/45">
          {agents.length === 0
            ? "Add one from your machine's LLMs, or wait for someone to bring theirs."
            : 'Everyone here works with all of them.'}
        </p>
        <CreateAgent />
      </div>
      <div className="space-y-3">
        {sorted.map(agent => {
          const mine = agent.ownerId === selfId
          const running = activePrompts[agent.id] ?? []
          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              threadCount={running.length}
              onStop={running.length > 0 ? () => running.forEach(cancelPrompt) : undefined}
              onSetting={mine ? (key, value) => updateAgentSetting(agent.id, key, value) : undefined}
              onRename={mine ? label => renameAgent(agent.id, label) : undefined}
              onAvatar={mine ? file => setAgentAvatar(agent.id, file) : undefined}
              onRemove={() => removeAgent(agent.id)}
            />
          )
        })}
      </div>
    </Page>
  )
}
