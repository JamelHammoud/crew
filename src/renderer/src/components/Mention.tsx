import { ComputerDesktopIcon, DocumentTextIcon } from '@heroicons/react/16/solid'
import { useMemo, type ReactNode } from 'react'
import type { BoardMentionRef } from '../../../shared/design'
import { docExcerpt, type DocMentionRef } from '../../../shared/docs'
import type { AgentMentionRef, PooledAgent } from '../../../shared/llm'
import { relabelMentions, visibleSettingFields } from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import type { CrewRefKind } from '../../../shared/refs'
import { FrameGlyph } from '../design/glyphs'
import { useCrew } from '../state/store'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import BoardPreview from './BoardPreview'
import { TextWithFileLinks } from './fileLinks'
import HoverCard from './HoverCard'
import { localizeDoc } from './images'
import Markdown from './Markdown'
import { tokenizeMentions, writtenRefs } from './mentionTokens'
import Pill from './Pill'

function CardRule({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`-mx-3 mt-2.5 border-t border-fg/[0.06] px-3 pt-2.5 ${className}`}>{children}</div>
}

function AgentCardContent({ agent }: { agent: PooledAgent }) {
  const settings = visibleSettingFields(agent.fields, agent.settings)
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
        <CardRule className="space-y-1.5">
          {settings.map(row => (
            <span key={row.label} className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">{row.label}</span>
              <span className="text-fg-secondary">{row.value}</span>
            </span>
          ))}
        </CardRule>
      )}
    </>
  )
}

export function AgentName({
  agent,
  className,
  children
}: {
  agent: PooledAgent
  className?: string
  children: ReactNode
}) {
  return (
    <HoverCard content={<AgentCardContent agent={agent} />} className={className}>
      {children}
    </HoverCard>
  )
}

function MentionChip({ self = false, children }: { self?: boolean; children: ReactNode }) {
  const tint = self
    ? 'text-attention bg-attention/20 hover:bg-attention/30'
    : 'text-fg bg-fg/10 hover:bg-fg/[0.16]'
  return <strong className={`font-semibold cursor-default rounded-md px-1 py-0.5 transition-colors ${tint}`}>{children}</strong>
}

export function AgentMention({ agent, children }: { agent: PooledAgent; children: ReactNode }) {
  return (
    <AgentName agent={agent}>
      <MentionChip>{children}</MentionChip>
    </AgentName>
  )
}

function MemberMention({ member, children }: { member: MemberInfo; children: ReactNode }) {
  const selfId = useCrew(s => s.selfId)
  return (
    <MemberName id={member.id} name={member.name}>
      <MentionChip self={member.id === selfId}>{children}</MentionChip>
    </MemberName>
  )
}

function DocCardContent({ page }: { page: string }) {
  const doc = useCrew(s => s.docs[page])
  const httpBase = useCrew(s => s.httpBase)
  if (!doc) return null
  const excerpt = docExcerpt(doc.text)
  return (
    <>
      <span className="flex items-center gap-2">
        <DocumentTextIcon className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
        <span className="text-sm font-semibold text-fg truncate">{doc.title}</span>
      </span>
      {excerpt && (
        <CardRule>
          <Markdown className="md-peek max-h-40 overflow-hidden" text={localizeDoc(excerpt, httpBase)} />
        </CardRule>
      )}
    </>
  )
}

function BoardCardContent({ boardId }: { boardId: string }) {
  const board = useCrew(s => s.boards.find(b => b.id === boardId))
  if (!board) return null
  return (
    <>
      <span className="flex items-center gap-2">
        <FrameGlyph className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
        <span className="text-sm font-semibold text-fg truncate">{board.name}</span>
      </span>
      <BoardPreview boardId={boardId} />
    </>
  )
}

export function RefMention({
  refKind,
  target,
  children
}: {
  refKind: CrewRefKind
  target: string | null
  children: ReactNode
}) {
  const openDoc = useCrew(s => s.openDoc)
  const openBoard = useCrew(s => s.openBoard)
  const Icon = refKind === 'board' ? FrameGlyph : DocumentTextIcon
  const pill = (
    <span
      onClick={
        target
          ? event => {
              event.stopPropagation()
              if (refKind === 'board') openBoard(target)
              else openDoc(target)
            }
          : undefined
      }
      className={`inline-flex items-center gap-1 align-baseline font-medium rounded-md px-1.5 py-0.5 text-sky-300 bg-sky-400/15 transition-colors hover:bg-sky-400/25 light:text-sky-700 light:bg-sky-500/10 light:hover:bg-sky-500/20 ${
        target ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 -mt-px" />
      {children}
    </span>
  )
  if (!target) return pill
  return (
    <HoverCard content={refKind === 'board' ? <BoardCardContent boardId={target} /> : <DocCardContent page={target} />}>
      {pill}
    </HoverCard>
  )
}

export function MentionText({
  text,
  mentionRefs,
  docMentions,
  boardMentions
}: {
  text: string
  mentionRefs?: AgentMentionRef[]
  docMentions?: DocMentionRef[]
  boardMentions?: BoardMentionRef[]
}) {
  const agents = useCrew(s => s.agents)
  const members = useCrew(s => s.members)
  const docs = useCrew(s => s.docs)
  const boards = useCrew(s => s.boards)
  const tokens = useMemo(() => {
    const refs = writtenRefs(text, docs, boards, docMentions, boardMentions)
    return tokenizeMentions(relabelMentions(text, mentionRefs, agents), agents, members, refs)
  }, [agents, boardMentions, boards, docMentions, docs, members, mentionRefs, text])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'agent') {
          return (
            <AgentMention key={index} agent={token.agent}>
              {token.text}
            </AgentMention>
          )
        }
        if (token.kind === 'member') {
          return (
            <MemberMention key={index} member={token.member}>
              {token.text}
            </MemberMention>
          )
        }
        if (token.kind === 'ref') {
          return (
            <RefMention key={index} refKind={token.ref.kind} target={token.ref.target}>
              {token.text.slice(1)}
            </RefMention>
          )
        }
        return <TextWithFileLinks key={index} text={token.text} />
      })}
    </>
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

// An id names its author for good. The written name is only a fallback, for
// events from before ids were carried on them.
export function MemberName({
  id,
  name,
  className,
  children
}: {
  id?: string
  name: string
  className?: string
  children: ReactNode
}) {
  const member = useCrew(s => s.members.find(m => (id ? m.id === id : m.name === name)))
  const agent = useCrew(s => s.agents.find(a => (id ? a.id === id : a.label === name)))
  const selfId = useCrew(s => s.selfId)
  if (member) {
    return (
      <HoverCard content={<MemberCardContent member={member} self={member.id === selfId} />} className={className}>
        {children}
      </HoverCard>
    )
  }
  if (agent) {
    return (
      <AgentName agent={agent} className={className}>
        {children}
      </AgentName>
    )
  }
  return <>{children}</>
}
