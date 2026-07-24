import { ComputerDesktopIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import { useMemo, type ReactNode } from 'react'
import type { DocMentionRef } from '../../../shared/docs'
import type { PooledAgent } from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import HoverCard from './HoverCard'
import { tokenizeMentions } from './mentionTokens'
import Pill from './Pill'

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
        <AgentIcon seed={agent.id} size="sm" presence={agent.status === 'offline' ? 'offline' : 'online'} />
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
        <span className="block mt-2.5 pt-2.5 border-t border-fg/[0.06] space-y-1.5">
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

export function AgentName({ agent, children }: { agent: PooledAgent; children: ReactNode }) {
  return <HoverCard content={<AgentCardContent agent={agent} />}>{children}</HoverCard>
}

export function AgentMention({ agent, children }: { agent: PooledAgent; children: ReactNode }) {
  return (
    <AgentName agent={agent}>
      <strong className="font-semibold text-fg cursor-default rounded-md px-1 py-0.5 bg-fg/10 transition-colors hover:bg-fg/[0.16]">
        {children}
      </strong>
    </AgentName>
  )
}

function DocCardContent({ page }: { page: string }) {
  const doc = useCrew(s => s.docs[page])
  if (!doc) return null
  const snippet = doc.text.trim().slice(0, 280)
  return (
    <>
      <span className="flex items-center gap-2">
        <DocumentTextIcon className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
        <span className="text-sm font-semibold text-fg truncate">{doc.title}</span>
      </span>
      {snippet && (
        <span className="block mt-2.5 pt-2.5 border-t border-fg/[0.06] text-xs text-fg-muted whitespace-pre-wrap line-clamp-4">
          {snippet}
        </span>
      )}
    </>
  )
}

export function DocMention({ page, children }: { page: string | null; children: ReactNode }) {
  const pill = (
    <span className="font-medium cursor-default rounded-md px-1 py-0.5 text-sky-300 bg-sky-400/15 transition-colors hover:bg-sky-400/25 light:text-sky-700 light:bg-sky-500/10 light:hover:bg-sky-500/20">
      {children}
    </span>
  )
  if (!page) return pill
  return <HoverCard content={<DocCardContent page={page} />}>{pill}</HoverCard>
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
    return <AgentName agent={agent}>{children}</AgentName>
  }
  return <>{children}</>
}
