import type { Attachment, OutgoingAttachment } from './attachments'
import type { SessionEvent } from './events'
import type { AgentSettingField, AgentSettings, AgentStep, PooledAgent, RunStep } from './llm'

export interface RegisteredLlm {
  instanceId: string
  provider: string
  label: string
  fields: AgentSettingField[]
  settings: AgentSettings
}

export interface MemberInfo {
  id: string
  name: string
  connected: boolean
}

export interface SessionSnapshot {
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  docs: Record<string, string>
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[] }
  | { type: 'chat.send'; text: string; mentions: string[]; threadId?: string; attachments?: OutgoingAttachment[] }
  | { type: 'doc.update'; page: string; text: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.register'; llm: RegisteredLlm }
  | { type: 'agent.deregister'; instanceId: string }
  | { type: 'agent.step'; promptId: string; step: RunStep }
  | { type: 'agent.tokens'; promptId: string; tokens: number }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
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
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  | { type: 'error'; message: string }
