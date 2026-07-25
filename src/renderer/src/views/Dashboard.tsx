import AgentCard from '../components/AgentCard'
import Avatar from '../components/Avatar'
import CreateAgent from '../components/CreateAgent'
import Pill from '../components/Pill'
import { useCrew } from '../state/store'


export default function Dashboard() {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const sortedAgents = [...agents].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  const activePrompts = useCrew(s => s.activePrompts)
  const selfId = useCrew(s => s.selfId)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const updateAgentSetting = useCrew(s => s.updateAgentSetting)
  const renameAgent = useCrew(s => s.renameAgent)
  const setAgentAvatar = useCrew(s => s.setAgentAvatar)
  const removeAgent = useCrew(s => s.removeAgent)

  return (
    <div className="h-full overflow-y-auto px-6">
      <div className="max-w-[660px] mx-auto pt-28 pb-16 space-y-10">
        <section>
          <h2 className="text-sm font-semibold text-fg-muted mb-4">People</h2>
          <div className="space-y-1">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-3 py-2 -mx-3 rounded-2xl transition-colors hover:bg-fg/[0.03]"
              >
                <Avatar name={member.name} presence={member.connected ? 'online' : 'offline'} />
                <span className="text-base font-semibold text-fg">{member.name}</span>
                {member.id === selfId && <Pill>You</Pill>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg-muted">Agents</h2>
            <CreateAgent />
          </div>
          {agents.length === 0 ? (
            <p className="text-base text-fg-muted">
              No agents yet. Add one from your machine's LLMs, or wait for someone to bring theirs.
            </p>
          ) : (
            <div className="space-y-4">
              {sortedAgents.map(agent => {
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
                    onRemove={() => removeAgent(agent.id)}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
