import type { Attachment, OutgoingAttachment } from './attachments'
import type { SessionEvent } from './events'
import type { AgentSettingField, AgentSettings, AgentStep, PooledAgent, RunStep } from './llm'

export interface RegisteredLlm {
  instanceId: string
  provider: string
  label: string
  fields: AgentSettingField[]
  settings: AgentSettings
  steerable?: boolean
}

export interface MemberInfo {
  id: string
  name: string
  connected: boolean
}

export interface QueuedItem {
  promptId: string
  authorId: string
  authorName: string
  text: string
}

export interface SessionSnapshot {
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  docs: Record<string, string>
  queues: Record<string, QueuedItem[]>
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[] }
  | { type: 'chat.send'; text: string; mentions: string[]; threadId?: string; attachments?: OutgoingAttachment[] }
  | { type: 'chat.delete'; messageId: string }
  | { type: 'thread.archive'; threadId: string }
  | { type: 'doc.update'; page: string; text: string }
  | { type: 'doc.rename'; from: string; to: string }
  | { type: 'doc.delete'; page: string }
  | { type: 'queue.edit'; promptId: string; text: string }
  | { type: 'queue.remove'; promptId: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.register'; llm: RegisteredLlm }
  | { type: 'agent.deregister'; instanceId: string }
  | { type: 'agent.step'; promptId: string; step: RunStep }
  | { type: 'agent.tokens'; promptId: string; tokens: number }
  | { type: 'agent.steered'; promptId: string; ok: boolean }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
  | { type: 'queue.state'; threadId: string; items: QueuedItem[] }
  | { type: 'agent.added'; agent: PooledAgent }
  | { type: 'agent.removed'; agentId: string }
  | { type: 'agent.step'; promptId: string; agentId: string; threadId: string; step: AgentStep }
  | { type: 'agent.tokens'; promptId: string; agentId: string; threadId: string; tokens: number }
  | {
      type: 'prompt'
      promptId: string
      agentId: string
      threadId: string
      text: string
      settings: AgentSettings
      attachments?: Attachment[]
    }
  | { type: 'steer'; promptId: string; text: string; byName: string; attachments?: Attachment[] }
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  | { type: 'error'; message: string }
