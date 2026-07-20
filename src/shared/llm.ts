export type AgentStatus = 'idle' | 'busy' | 'offline'

export interface AgentActivity {
  id: string
  kind: 'tool' | 'subagent'
  name: string
  status: 'running' | 'done'
  detail?: string
}

export type AgentSettings = Record<string, string>

export interface AgentSettingOption {
  value: string
  label: string
}

export interface AgentSettingField {
  key: string
  label: string
  options: AgentSettingOption[]
  default: string
}

export function resolveSettings(fields: AgentSettingField[], settings: AgentSettings): AgentSettings {
  const out: AgentSettings = {}
  for (const field of fields) {
    const chosen = settings[field.key]
    const valid = field.options.some(option => option.value === chosen)
    out[field.key] = valid ? chosen : field.default
  }
  return out
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
