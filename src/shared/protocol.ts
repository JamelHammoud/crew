import type { SessionEvent } from './events'
import type { AgentActivity, AgentSettingField, AgentSettings, PooledAgent } from './llm'

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
  | { type: 'chat.send'; text: string; mentions: string[]; threadId?: string }
  | { type: 'doc.update'; page: string; text: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.register'; llm: RegisteredLlm }
  | { type: 'agent.deregister'; instanceId: string }
  | { type: 'agent.chunk'; promptId: string; text: string }
  | { type: 'agent.progress'; promptId: string; thinking?: string; tokens?: number }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }
  | { type: 'agent.activity'; promptId: string; activity: AgentActivity }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
  | { type: 'agent.added'; agent: PooledAgent }
  | { type: 'agent.removed'; agentId: string }
  | { type: 'agent.waiting'; agentId: string; waitingThreadIds: string[] }
  | { type: 'agent.chunk'; promptId: string; agentId: string; threadId?: string; text: string }
  | { type: 'agent.progress'; promptId: string; agentId: string; threadId?: string; thinking?: string; tokens?: number }
  | { type: 'agent.activity'; promptId: string; agentId: string; threadId?: string; activity: AgentActivity }
  | { type: 'prompt'; promptId: string; agentId: string; text: string; settings: AgentSettings }
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  | { type: 'error'; message: string }
