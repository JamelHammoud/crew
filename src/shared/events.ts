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

export const SYSTEM_AUTHOR_ID = 'crew'
export const SYSTEM_AUTHOR_NAME = 'crew'
