import type { Attachment } from './attachments'
import type { DocMentionRef } from './docs'
import type { AgentSettings, AgentStep } from './llm'
import type { ReactionEmoji } from './reactions'

// 'open' means the thread still wants attention: either an agent is working or
// the result is waiting for someone to look at it. 'done' is an explicit human
// (or agent) sign-off; 'archived' hides the thread without losing it.
export type ThreadStatus = 'open' | 'done' | 'archived'

// A todo is a pre-thread: one line of intended work, no run behind it. 'Do'
// turns it into a real thread; checking it off records work done by hand.
export interface Todo {
  id: string
  text: string
  agentId?: string
  createdBy: string
  ts: number
  checked: boolean
}

export type SessionEvent =
  | {
      id: string
      ts: number
      kind: 'message'
      authorId: string
      authorName: string
      text: string
      mentions: string[]
      docMentions?: DocMentionRef[]
      threadId?: string
      attachments?: Attachment[]
    }
  | { id: string; ts: number; kind: 'message.deleted'; messageId: string }
  | { id: string; ts: number; kind: 'message.edited'; messageId: string; text: string; docMentions?: DocMentionRef[] }
  | {
      id: string
      ts: number
      kind: 'message.reaction'
      targetId: string
      targetAuthorId: string
      targetAuthorName: string
      memberId: string
      memberName: string
      emoji: ReactionEmoji
      active: boolean
      threadId?: string
    }
  | {
      id: string
      ts: number
      kind: 'message.route'
      messageId: string
      threadId: string
      promptId: string
      mode: 'queued' | 'steered'
    }
  | { id: string; ts: number; kind: 'thread.started'; threadId: string; agentId: string; agentLabel: string; title: string; byName: string; boardId?: string }
  // Superseded by thread.status; still emitted-compatible and replayed so old
  // event logs and old peers keep working.
  | { id: string; ts: number; kind: 'thread.archived'; threadId: string; byName: string }
  | { id: string; ts: number; kind: 'thread.agent'; threadId: string; agentId: string; agentLabel: string; byName: string }
  | { id: string; ts: number; kind: 'thread.status'; threadId: string; status: ThreadStatus; byName: string }
  | { id: string; ts: number; kind: 'todo.added'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.edited'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.removed'; todoId: string; byName: string }
  | { id: string; ts: number; kind: 'todo.checked'; todoId: string; checked: boolean; byName: string }
  | { id: string; ts: number; kind: 'todo.started'; todoId: string; threadId: string; byName: string }
  | {
      id: string
      ts: number
      kind: 'agent.start'
      promptId: string
      agentId: string
      agentLabel: string
      promptText: string
      byName: string
      threadId?: string
      reactionIds?: string[]
    }
  | { id: string; ts: number; kind: 'agent.step'; promptId: string; agentId: string; agentLabel: string; step: AgentStep; threadId?: string }
  | { id: string; ts: number; kind: 'agent.end'; promptId: string; agentId: string; agentLabel: string; ok: boolean; text?: string; error?: string; threadId?: string }
  | { id: string; ts: number; kind: 'person.joined'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'person.left'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'agent.online'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.offline'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.updated'; agentId: string; settings: AgentSettings }
  | { id: string; ts: number; kind: 'doc'; page: string; text: string; title?: string; byName: string }
  | { id: string; ts: number; kind: 'doc.titled'; page: string; title: string; byName: string }
  | { id: string; ts: number; kind: 'doc.renamed'; from: string; to: string; title?: string; byName: string }
  | { id: string; ts: number; kind: 'doc.deleted'; page: string; byName: string }

export const SYSTEM_AUTHOR_ID = 'crew'
export const SYSTEM_AUTHOR_NAME = 'crew'

const EPHEMERAL_KINDS = new Set([
  'doc',
  'doc.titled',
  'doc.renamed',
  'doc.deleted',
  'message.edited',
  'person.joined',
  'person.left',
  'agent.online',
  'agent.offline',
  'agent.updated',
  // Todos ride in the snapshot as first-class state (like docs and queues), so
  // their events only matter live; keeping them out of the window also stops a
  // weeks-old pending todo from falling off the end of the trim.
  'todo.added',
  'todo.edited',
  'todo.removed',
  'todo.checked',
  'todo.started'
])

export function trimEvents(events: SessionEvent[], limit: number): SessionEvent[] {
  const lasting = events.filter(e => !EPHEMERAL_KINDS.has(e.kind))
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
