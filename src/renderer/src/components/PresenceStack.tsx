import { useState, type ReactElement } from 'react'
import { presentNow } from '../../../shared/presence'
import { useCrew } from '../state/store'
import FaceStack from './FaceStack'
import { Popover } from './Popover'
import PresenceList, { Face } from './PresenceList'
import Tooltip from './Tooltip'
import { activityForAgent, type AgentActivity } from './agentActivity'

const FACE = 40
const FACES = 2

export default function PresenceStack({ compact = false }: { compact?: boolean }): ReactElement | null {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const selfId = useCrew(s => s.selfId)
  const activePrompts = useCrew(s => s.activePrompts)
  const steps = useCrew(s => s.steps)
  const [open, setOpen] = useState(false)

  const here = presentNow(members, agents, selfId, activePrompts)
  if (here.length === 0) return null

  const shown = here.slice(0, compact ? 0 : FACES)
  const rest = here.length - shown.length
  const activities = Object.fromEntries(
    here.filter(one => one.agent).map(one => [one.id, activityForAgent(activePrompts[one.id], steps)])
  ) as Record<string, AgentActivity>

  return (
    <div className="relative">
      <Tooltip label="Who's here" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Who's here"
          className={`flex items-center rounded-full transition-all duration-150 active:scale-95 ${
            open ? 'ring-2 ring-fg/25' : 'hover:ring-2 hover:ring-fg/15'
          }`}
        >
          <FaceStack face={FACE}>
            {shown.map(one => (
              <Face key={one.id} who={one} activity={activities[one.id]} />
            ))}
            {rest > 0 && (
              <span
                style={{ width: FACE, height: FACE }}
                className="rounded-full bg-ink-700 text-fg-secondary text-sm font-semibold flex items-center justify-center"
              >
                +{rest}
              </span>
            )}
          </FaceStack>
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} className="min-w-52">
        <PresenceList here={here} activities={activities} />
      </Popover>
    </div>
  )
}
