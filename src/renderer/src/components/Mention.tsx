import { ComputerDesktopIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import type { PooledAgent } from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import { useCrew } from '../state/store'
import Avatar from './Avatar'
import HoverCard from './HoverCard'
import Pill from './Pill'
import Spinner from './Spinner'

function AgentCardContent({ agent }: { agent: PooledAgent }) {
  const settings = agent.fields
    .map(field => ({
      label: field.label,
      value: field.options.find(o => o.value === (agent.settings[field.key] ?? field.default))?.label
    }))
    .filter(row => row.value)
  return (
    <>
      <span className="flex items-center gap-2.5">
        <Avatar name={agent.label} size="sm" presence={agent.status === 'offline' ? 'offline' : 'online'} />
        <span className="min-w-0 flex-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-fg truncate">{agent.label}</span>
          <Pill>{agent.provider}</Pill>
        </span>
      </span>
      <span className="flex items-center gap-2 mt-2.5 text-xs text-fg-muted">
        <ComputerDesktopIcon className="w-3.5 h-3.5 shrink-0" />
        {agent.ownerName}'s PC
      </span>
      {settings.length > 0 && (
        <span className="block mt-2.5 pt-2.5 border-t border-white/[0.06] space-y-1.5">
          {settings.map(row => (
            <span key={row.label} className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">{row.label}</span>
              <span className="text-fg-secondary">{row.value}</span>
            </span>
          ))}
        </span>
      )}
    </>
  )
}

export function AgentMention({ agent, children }: { agent: PooledAgent; children: ReactNode }) {
  return (
    <HoverCard content={<AgentCardContent agent={agent} />}>
      <strong className="font-semibold text-fg cursor-default rounded-md px-0.5 -mx-0.5 transition-colors hover:bg-white/10">
        {children}
      </strong>
    </HoverCard>
  )
}

function MemberCardContent({ member, self }: { member: MemberInfo; self: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Avatar name={member.name} size="sm" presence={member.connected ? 'online' : 'offline'} />
      <span className="min-w-0 flex-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-fg truncate">{member.name}</span>
        {self && <Pill>You</Pill>}
      </span>
    </span>
  )
}

export function MemberName({ name, children }: { name: string; children: ReactNode }) {
  const member = useCrew(s => s.members.find(m => m.name === name))
  const agent = useCrew(s => s.agents.find(a => a.label === name))
  const selfId = useCrew(s => s.selfId)
  if (member) {
    return <HoverCard content={<MemberCardContent member={member} self={member.id === selfId} />}>{children}</HoverCard>
  }
  if (agent) {
    return <HoverCard content={<AgentCardContent agent={agent} />}>{children}</HoverCard>
  }
  return <>{children}</>
}
