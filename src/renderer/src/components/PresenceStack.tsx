import { useState, type ReactElement } from 'react'
import type { PooledAgent } from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import FaceStack from './FaceStack'
import { Popover } from './Popover'
import Tooltip from './Tooltip'

const FACE = 40
const FACES = 2

export interface Present {
  id: string
  name: string
  agent: boolean
}

export function presentNow(members: MemberInfo[], agents: PooledAgent[], selfId: string): Present[] {
  return [
    ...members
      .filter(member => member.connected && member.id !== selfId)
      .map(member => ({ id: member.id, name: member.name, agent: false })),
    ...agents.filter(agent => agent.status === 'busy').map(agent => ({ id: agent.id, name: agent.label, agent: true }))
  ]
}

function Face({ who, size = 'md' }: { who: Present; size?: 'sm' | 'md' }): ReactElement {
  return who.agent ? <AgentIcon seed={who.id} size={size} /> : <Avatar name={who.name} size={size} />
}

function Group({ label, who }: { label: string; who: Present[] }): ReactElement | null {
  if (who.length === 0) return null
  return (
    <div className="py-1">
      <p className="px-3 pb-1 text-xs font-semibold text-fg-muted">{label}</p>
      {who.map(one => (
        <div key={one.id} className="flex items-center gap-2.5 px-3 py-1.5">
          <Face who={one} size="sm" />
          <span className="text-sm font-medium text-fg whitespace-nowrap">{one.name}</span>
        </div>
      ))}
    </div>
  )
}

export default function PresenceStack(): ReactElement | null {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const selfId = useCrew(s => s.selfId)
  const [open, setOpen] = useState(false)

  const here = presentNow(members, agents, selfId)
  if (here.length === 0) return null

  const shown = here.slice(0, FACES)
  const rest = here.length - shown.length
  const people = here.filter(one => !one.agent)
  const working = here.filter(one => one.agent)

  return (
    <div className="relative">
      <Tooltip label="Who's here">
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Who's here"
          className={`flex items-center p-1 -m-1 rounded-full transition-all duration-150 active:scale-95 ${
            open ? 'bg-fg/[0.06]' : 'hover:bg-fg/[0.04]'
          }`}
        >
          <FaceStack face={FACE}>
            {shown.map(one => (
              <Face key={one.id} who={one} />
            ))}
            {rest > 0 && (
              <span
                style={{ width: FACE, height: FACE }}
                className="rounded-full bg-ink-700 text-fg-secondary text-sm font-semibold flex items-center justify-center select-none"
              >
                +{rest}
              </span>
            )}
          </FaceStack>
        </button>
      </Tooltip>
      <Popover open={open} onClose={() => setOpen(false)} className="min-w-48">
        <Group label="Online" who={people} />
        {people.length > 0 && working.length > 0 && <div className="h-px bg-fg/[0.06]" />}
        <Group label="Working" who={working} />
      </Popover>
    </div>
  )
}
