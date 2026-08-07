import { CheckGlyph } from '../icons'
import { useDefaultAgent } from '../state/defaultAgent'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'

// The agents that are here, as a screen inside the plus rather than a menu
// hanging off it: one card is one thing to aim at. There is no way back on it,
// because the rows it was opened from are one press away again, and no heading,
// because a row of faces one press after asking for one says it already.
//
// It is the same list the @ menu offers, since aiming the composer at somebody
// and naming them in the words are the same errand.
export default function DefaultAgentPicker({ onPick }: { onPick: () => void }) {
  const place = useCrew(s => s.place)
  const agents = useCrew(s => s.agents)
  const aimed = useDefaultAgents(s => s.aimed[place] ?? null)
  const aim = useDefaultAgents(s => s.aim)
  const here = agents.filter(agent => agent.status !== 'offline')

  return (
    <div className="p-1.5 w-56 max-h-[352px] overflow-y-auto overscroll-contain no-scrollbar">
      {here.map(agent => (
        <button
          key={agent.id}
          onClick={() => {
            aim(place, agent.id)
            onPick()
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left whitespace-nowrap transition-colors text-fg/70 hover:text-fg hover:bg-fg/5"
        >
          <AgentIcon seed={agent.id} size="xs" />
          <span className="flex-1 truncate">{agent.label}</span>
          {aimed === agent.id && <CheckGlyph className="w-4 h-4 shrink-0 text-fg" />}
        </button>
      ))}
    </div>
  )
}
