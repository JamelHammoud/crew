import { useMemo, type ReactNode } from 'react'
import type { BoardMentionRef } from '../../../shared/design'
import { docExcerpt, type DocMentionRef } from '../../../shared/docs'
import type { AgentMentionRef, PooledAgent } from '../../../shared/llm'
import {
  changedSettings,
  overallUsageWindow,
  plainFields,
  relabelMentions,
  settingLabel,
  visibleSettingFields
} from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import type { CrewRefKind } from '../../../shared/refs'
import { FrameGlyph } from '../design/glyphs'
import { DocGlyph } from '../icons'
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
import ProviderMark from './ProviderMark'
import Spinner from './Spinner'
import SubagentMark from './SubagentMark'

function CardRule({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`-mx-3 mt-2.5 border-t border-fg/[0.06] px-3 pt-2.5 ${className}`}>{children}</div>
}

// A band across the foot of the card, on the card's own bottom corners, the way
// the preview under a board is and the way the same band sits under an agent in
// the settings.
function CardFoot({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-3 -mb-3 mt-2.5 flex items-center gap-2 rounded-b-2xl border-t border-fg/[0.06] bg-fg/[0.04] px-3 py-2">
      {children}
    </div>
  )
}

// The face, the name and whose it is, which is what both cards open with. An
// agent runs a real CLI on somebody's machine and spends their tokens, so who
// that is stands under the name rather than being something to go and look up.
function CardHead({ face, name, badge, under }: { face: ReactNode; name: string; badge?: ReactNode; under?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {face}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-fg truncate">{name}</span>
          {badge}
        </div>
        {under && <div className="text-xs text-fg/45 truncate">{under}</div>}
      </div>
    </div>
  )
}

function AgentCardContent({ agent }: { agent: PooledAgent }) {
  // A field read rather than a walk, and the card is only ever rendered while it
  // is standing, so a chip on screen costs nothing until it is hovered.
  const threads = useCrew(s => s.activePrompts[agent.id]?.length ?? 0)
  const shown = [
    ...visibleSettingFields(plainFields(agent.fields), agent.settings),
    ...changedSettings(agent.fields, agent.settings).filter(field => field.advanced)
  ]
  const settings = shown
    .map(field => ({ label: field.label, value: settingLabel(field, agent.settings) }))
    .filter(row => row.value)
  const usage = overallUsageWindow(agent.usage)
  const details = usage ? [...settings, { label: 'Usage', value: `${Math.round(usage.percent)}%` }] : settings
  return (
    <>
      <CardHead
        face={<AgentIcon seed={agent.id} presence={agent.status === 'offline' ? 'offline' : 'online'} />}
        name={agent.label}
        badge={<ProviderMark provider={agent.provider} />}
        under={agent.ownerName}
      />
      {details.length > 0 && (
        <CardRule className="space-y-1.5">
          {details.map(row => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="shrink-0 text-fg/45">{row.label}</span>
              <span className="min-w-0 truncate text-fg/70">{row.value}</span>
            </div>
          ))}
        </CardRule>
      )}
      {threads > 0 && (
        <CardFoot>
          <Spinner size={12} className="text-fg" />
          <span className="text-xs font-semibold text-fg">Working</span>
          {threads > 1 && <span className="text-xs text-fg/45">on {threads} threads</span>}
        </CardFoot>
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

function HelperCardContent({ threadId }: { threadId: string }) {
  const thread = useCrew(state => state.threads[threadId])
  const agent = useCrew(state => state.agents.find(one => one.id === thread?.agentId))
  if (!thread?.helper || !agent) return null
  const field = agent.fields.find(one => one.key === 'model')
  const model = thread.helperModel ?? agent.settings.model ?? field?.default ?? ''
  const label = field ? settingLabel(field, { ...agent.settings, model }) : model || 'Default'
  return (
    <>
      <CardHead
        face={<SubagentMark seed={threadId} />}
        name={thread.helper}
        badge={<ProviderMark provider={agent.provider} />}
        under={agent.label}
      />
      <CardRule>
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="shrink-0 text-fg/45">Model</span>
          <span className="min-w-0 truncate text-fg/70">{label}</span>
        </div>
      </CardRule>
    </>
  )
}

export function HelperName({ threadId, children }: { threadId: string; children: ReactNode }) {
  return <HoverCard content={<HelperCardContent threadId={threadId} />}>{children}</HoverCard>
}

function MentionChip({ self = false, children }: { self?: boolean; children: ReactNode }) {
  const tint = self ? 'text-attention bg-attention/20 hover:bg-attention/30' : 'text-fg bg-fg/10 hover:bg-fg/[0.16]'
  return (
    <strong className={`font-semibold cursor-default rounded-md px-1 py-0.5 transition-colors ${tint}`}>
      {children}
    </strong>
  )
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
        <DocGlyph className="w-4 h-4 shrink-0 text-sky-300 light:text-sky-700" />
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

export function BoardCardContent({ boardId }: { boardId: string }) {
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
  const Icon = refKind === 'board' ? FrameGlyph : DocGlyph
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
    <CardHead
      face={<Avatar name={member.name} presence={member.connected ? 'online' : 'offline'} />}
      name={member.name}
      badge={self ? <Pill glass>You</Pill> : undefined}
    />
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
      <HoverCard hug content={<MemberCardContent member={member} self={member.id === selfId} />} className={className}>
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

// One person, written the way a mention in a message is. Anything holding a name
// and nothing else, like whoever added a track, names them with this, and
// somebody who has since left the crew still reads as their name.
export function PersonMention({ name, className }: { name: string; className?: string }) {
  return (
    <MemberName name={name} className={className}>
      <MentionChip>@{name}</MentionChip>
    </MemberName>
  )
}
