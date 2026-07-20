import AgentCard from '../components/AgentCard'
import Avatar from '../components/Avatar'
import CreateAgent from '../components/CreateAgent'
import { useCrew } from '../state/store'

function instanceOf(agentId: string): string {
  const slash = agentId.indexOf('/')
  return slash === -1 ? agentId : agentId.slice(slash + 1)
}

export default function Dashboard() {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const activePrompts = useCrew(s => s.activePrompts)
  const selfId = useCrew(s => s.selfId)
  const cancelPrompt = useCrew(s => s.cancelPrompt)
  const updateAgentSetting = useCrew(s => s.updateAgentSetting)

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <section>
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">People</h2>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar name={member.name} />
                <span className="text-sm text-zinc-200">
                  {member.name}
                  {member.id === selfId && <span className="text-zinc-500"> (you)</span>}
                </span>
                <span className={`w-2 h-2 rounded-full ${member.connected ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Agents</h2>
            <CreateAgent />
          </div>
          {agents.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No agents yet. Add one from your machine's LLMs, or wait for someone to bring theirs.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map(agent => {
                const mine = agent.ownerId === selfId
                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onStop={activePrompts[agent.id] ? () => cancelPrompt(activePrompts[agent.id]) : undefined}
                    onSetting={mine ? (key, value) => updateAgentSetting(agent.id, key, value) : undefined}
                    onRemove={mine ? () => void window.crew.removeAgent(instanceOf(agent.id)) : undefined}
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
