import type { SessionEvent } from './events'
import type { AgentActivity, AgentSettingField, AgentSettings, PooledAgent } from './llm'

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

export interface RegisteredLlm {
  provider: string
  label: string
  fields: AgentSettingField[]
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[] }
  | { type: 'chat.send'; text: string; mentions: string[] }
  | { type: 'doc.update'; page: string; text: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.chunk'; promptId: string; text: string }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }
  | { type: 'agent.activity'; promptId: string; activity: AgentActivity }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
  | { type: 'agent.chunk'; promptId: string; agentId: string; text: string }
  | { type: 'agent.activity'; promptId: string; agentId: string; activity: AgentActivity }
  | { type: 'prompt'; promptId: string; agentId: string; text: string; settings: AgentSettings }
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  | { type: 'error'; message: string }
