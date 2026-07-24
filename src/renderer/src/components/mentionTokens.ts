import { docRefs, resolveDocRef, type DocMentionRef, type DocPage } from '../../../shared/docs'
import type { PooledAgent } from '../../../shared/llm'

export type MentionToken =
  | { kind: 'text'; text: string }
  | { kind: 'agent'; text: string; agent: PooledAgent }
  | { kind: 'doc'; text: string; page: string | null }

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function tokenizeMentions(
  text: string,
  agents: PooledAgent[],
  docs: Record<string, DocPage>,
  docMentions?: DocMentionRef[]
): MentionToken[] {
  const refs = docMentions
    ? docMentions
        .filter(ref => ref.title.trim().length > 0)
        .map(ref => ({ title: ref.title, page: resolveDocRef(docs, ref) }))
    : docRefs(docs).map(ref => ({ title: ref.title, page: ref.page as string | null }))
  const names = [...agents.map(a => `@${a.label}`), ...refs.map(ref => `#${ref.title}`)]
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
    const ref = part.startsWith('#') ? refs.find(r => r.title.toLowerCase() === name) : undefined
    if (agent) tokens.push({ kind: 'agent', text: part, agent })
    else if (ref) tokens.push({ kind: 'doc', text: part, page: ref.page })
    else tokens.push({ kind: 'text', text: part })
  }
  return tokens
}
