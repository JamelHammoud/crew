import { resolveBoardRef, type BoardMentionRef, type DesignBoardMeta } from '../../../shared/design'
import { resolveDocRef, type DocMentionRef, type DocPage } from '../../../shared/docs'
import type { PooledAgent } from '../../../shared/llm'
import type { MemberInfo } from '../../../shared/protocol'
import { crewRefs, refsIn, type CrewRefKind } from '../../../shared/refs'

export interface WrittenRef {
  kind: CrewRefKind
  title: string
  target: string | null
}

export type MentionToken =
  | { kind: 'text'; text: string }
  | { kind: 'agent'; text: string; agent: PooledAgent }
  | { kind: 'member'; text: string; member: MemberInfo }
  | { kind: 'ref'; text: string; ref: WrittenRef }

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function writtenRefs(
  text: string,
  docs: Record<string, DocPage>,
  boards: DesignBoardMeta[],
  docMentions?: DocMentionRef[],
  boardMentions?: BoardMentionRef[]
): WrittenRef[] {
  if (!docMentions && !boardMentions)
    return refsIn(text, crewRefs(docs, boards)).map(ref => ({ kind: ref.kind, title: ref.title, target: ref.key }))
  return [
    ...(docMentions ?? []).map(ref => ({
      kind: 'doc' as const,
      title: ref.title,
      target: resolveDocRef(docs, ref)
    })),
    ...(boardMentions ?? []).map(ref => ({
      kind: 'board' as const,
      title: ref.name,
      target: resolveBoardRef(boards, ref)
    }))
  ].filter(ref => ref.title.trim().length > 0)
}

export function tokenizeMentions(
  text: string,
  agents: PooledAgent[],
  members: MemberInfo[],
  refs: WrittenRef[]
): MentionToken[] {
  const names = [
    ...agents.map(agent => `@${agent.label}`),
    ...members.map(member => `@${member.name}`),
    ...refs.map(ref => `#${ref.title}`)
  ]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
  if (names.length === 0) return text ? [{ kind: 'text', text }] : []
  const parts = text.split(new RegExp(`((?:${names.join('|')})(?![\\w-]))`, 'gi'))
  const tokens: MentionToken[] = []
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    if (!part) continue
    if (index % 2 === 0) {
      tokens.push({ kind: 'text', text: part })
      continue
    }
    const name = part.slice(1).toLowerCase()
    const agent = part.startsWith('@') ? agents.find(a => a.label.toLowerCase() === name) : undefined
    const member = part.startsWith('@') ? members.find(candidate => candidate.name.toLowerCase() === name) : undefined
    const ref = part.startsWith('#') ? refs.find(r => r.title.toLowerCase() === name) : undefined
    if (agent) tokens.push({ kind: 'agent', text: part, agent })
    else if (member) tokens.push({ kind: 'member', text: part, member })
    else if (ref) tokens.push({ kind: 'ref', text: part, ref })
    else tokens.push({ kind: 'text', text: part })
  }
  return tokens
}
