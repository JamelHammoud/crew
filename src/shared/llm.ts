export type AgentStatus = 'idle' | 'busy' | 'offline'

export interface AgentActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: 'running' | 'done'
  detail?: string
}

export type AgentSettings = Record<string, string>

export interface AgentSettingField {
  key: string
  label: string
  kind: 'text' | 'select'
  options?: string[]
  placeholder?: string
}

export interface PooledAgent {
  id: string
  label: string
  provider: string
  ownerId: string
  ownerName: string
  status: AgentStatus
  activities: AgentActivity[]
  settings: AgentSettings
  fields: AgentSettingField[]
}

export function agentId(ownerName: string, provider: string): string {
  return `${ownerName.trim().toLowerCase()}/${provider}`
}
