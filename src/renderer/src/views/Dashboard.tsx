import AgentCard from '../components/AgentCard'
import Avatar from '../components/Avatar'
import { useCrew } from '../state/store'

export default function Dashboard() {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const activePrompts = useCrew(s => s.activePrompts)
  const selfId = useCrew(s => s.selfId)
  const cancelPrompt = useCrew(s => s.cancelPrompt)

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
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Agents</h2>
          {agents.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No agents yet. When someone joins with LLMs on their machine, they show up here.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onStop={
                    activePrompts[agent.id]
                      ? () => cancelPrompt(activePrompts[agent.id])
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
