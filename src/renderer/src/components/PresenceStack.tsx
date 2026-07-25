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
  threads: number
}

export function presentNow(
  members: MemberInfo[],
  agents: PooledAgent[],
  selfId: string,
  activePrompts: Record<string, string[]> = {}
): Present[] {
  const threadsOf = (agent: PooledAgent): number => (activePrompts[agent.id] ?? []).length
  return [
    ...members
      .filter(member => member.connected && member.id !== selfId)
      .map(member => ({ id: member.id, name: member.name, agent: false, threads: 0 })),
    ...agents
      .filter(agent => threadsOf(agent) > 0 || agent.status === 'busy')
      .map(agent => ({ id: agent.id, name: agent.label, agent: true, threads: threadsOf(agent) }))
  ]
}

function Face({ who, size = 'md' }: { who: Present; size?: 'sm' | 'md' }): ReactElement {
  return who.agent ? <AgentIcon seed={who.id} size={size} /> : <Avatar name={who.name} size={size} />
}

function Group({ label, who }: { label: string; who: Present[] }): ReactElement | null {
  if (who.length === 0) return null
  return (
    <div className="py-2">
      <p className="px-3 pb-2 text-xs font-semibold text-fg-muted">{label}</p>
      <div className="space-y-0.5">
        {who.map(one => (
          <div key={one.id} className="flex items-center gap-2.5 px-3 py-1">
            <Face who={one} size="sm" />
            <span className="text-sm font-medium text-fg whitespace-nowrap">{one.name}</span>
            {one.threads > 0 && (
              <span className="ml-auto pl-4 text-xs text-fg-muted whitespace-nowrap">
                {one.threads === 1 ? '1 thread' : `${one.threads} threads`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PresenceStack(): ReactElement | null {
  const members = useCrew(s => s.members)
  const agents = useCrew(s => s.agents)
  const selfId = useCrew(s => s.selfId)
  const activePrompts = useCrew(s => s.activePrompts)
  const [open, setOpen] = useState(false)

  const here = presentNow(members, agents, selfId, activePrompts)
  if (here.length === 0) return null

  const shown = here.slice(0, FACES)
  const rest = here.length - shown.length
  const people = here.filter(one => !one.agent)
  const working = here.filter(one => one.agent)

  return (
    <div className="relative">
      <Tooltip label="Who's here" disabled={open}>
        <button
          onClick={() => setOpen(was => !was)}
          aria-label="Who's here"
          className={`flex items-center rounded-full transition-all duration-150 active:scale-95 ${
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
      <Popover open={open} onClose={() => setOpen(false)} className="min-w-52">
        <Group label="Online" who={people} />
        {people.length > 0 && working.length > 0 && <div className="h-px bg-fg/[0.06] -mx-1.5 my-1" />}
        <Group label="Working" who={working} />
      </Popover>
    </div>
  )
}
