import type { Attachment } from './attachments'
import type { AgentSettings, AgentStep } from './llm'

export type SessionEvent =
  | {
      id: string
      ts: number
      kind: 'message'
      authorId: string
      authorName: string
      text: string
      mentions: string[]
      threadId?: string
      attachments?: Attachment[]
    }
  | { id: string; ts: number; kind: 'message.deleted'; messageId: string }
  | {
      id: string
      ts: number
      kind: 'message.route'
      messageId: string
      threadId: string
      promptId: string
      mode: 'queued' | 'steered'
    }
  | { id: string; ts: number; kind: 'thread.started'; threadId: string; agentId: string; agentLabel: string; title: string; byName: string }
  | { id: string; ts: number; kind: 'agent.start'; promptId: string; agentId: string; agentLabel: string; promptText: string; byName: string; threadId?: string }
  | { id: string; ts: number; kind: 'agent.step'; promptId: string; agentId: string; agentLabel: string; step: AgentStep; threadId?: string }
  | { id: string; ts: number; kind: 'agent.end'; promptId: string; agentId: string; agentLabel: string; ok: boolean; text?: string; error?: string; threadId?: string }
  | { id: string; ts: number; kind: 'person.joined'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'person.left'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'agent.online'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.offline'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.updated'; agentId: string; settings: AgentSettings }
  | { id: string; ts: number; kind: 'doc'; page: string; text: string; byName: string }
  | { id: string; ts: number; kind: 'doc.renamed'; from: string; to: string; byName: string }

export const SYSTEM_AUTHOR_ID = 'crew'
export const SYSTEM_AUTHOR_NAME = 'crew'

export function trimEvents(events: SessionEvent[], limit: number): SessionEvent[] {
  const lasting = events.filter(e => e.kind !== 'doc' && e.kind !== 'doc.renamed')
  let count = 0
  let start = lasting.length
  for (let i = lasting.length - 1; i >= 0; i--) {
    if (lasting[i].kind !== 'agent.step') {
      if (count === limit) break
      count++
    }
    start = i
  }
  const kept = lasting.slice(start)
  const prompts = new Set(kept.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  return kept.filter(e => e.kind !== 'agent.step' || prompts.has(e.promptId))
}
