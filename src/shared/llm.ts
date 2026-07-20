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
  waitingThreadIds: string[]
}

export interface AgentDef {
  instanceId: string
  provider: string
  name: string
  settings: AgentSettings
}

export interface ProviderCapability {
  provider: string
  label: string
  fields: AgentSettingField[]
}

export function agentId(ownerName: string, instanceId: string): string {
  return `${ownerName.trim().toLowerCase()}/${instanceId}`
}

export function mentionsIn(
  text: string,
  agents: Array<Pick<PooledAgent, 'id' | 'label' | 'status'>>
): string[] {
  let work = ` ${text.toLowerCase()} `
  const ids: string[] = []
  const ordered = [...agents].sort((a, b) => b.label.length - a.label.length)
  for (const agent of ordered) {
    if (agent.status === 'offline') continue
    const needle = `@${agent.label.toLowerCase()}`
    const at = work.indexOf(needle)
    if (at === -1) continue
    if (/[\w-]/.test(work[at + needle.length])) continue
    ids.push(agent.id)
    work = work.slice(0, at) + ' '.repeat(needle.length) + work.slice(at + needle.length)
  }
  return ids
}
