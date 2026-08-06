export type AgentStatus = 'idle' | 'busy' | 'offline'

export type StepKind = 'text' | 'thinking' | 'tool' | 'subagent'

export interface FileChange {
  path: string
  added: number
  removed: number
  diff?: string
}

// One line of the list an agent keeps for itself, kept as it was written rather
// than folded into the one word a step says about it. Every CLI hands the whole
// list over several times a run, and this is the only place it survives.
export interface StepTodo {
  text: string
  status: 'todo' | 'doing' | 'done'
}

export interface RunStep {
  id: string
  kind: StepKind
  status: 'running' | 'done'
  text?: string
  name?: string
  detail?: string
  output?: string
  files?: FileChange[]
  todos?: StepTodo[]
}

export interface AgentStep extends RunStep {
  ts: number
}

export interface LiveRun {
  steps: AgentStep[]
  tokens: number
  cost?: number
  startedAt: number
}

export type AgentSettings = Record<string, string>

export interface AgentSettingOption {
  value: string
  label: string
}

export type AgentSettingKind = 'choice' | 'switch' | 'number' | 'text'

export interface AgentSettingField {
  key: string
  label: string
  kind?: AgentSettingKind
  options?: AgentSettingOption[]
  default: string
  free?: boolean
  line?: string
  advanced?: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  placeholder?: string
  visibleWhen?: {
    key: string
    value: string
  }
}

export const ON = 'on'

export const fieldKind = (field: AgentSettingField): AgentSettingKind => field.kind ?? 'choice'

export const isOn = (value: string | undefined): boolean => value === ON

export function cleanSetting(field: AgentSettingField, value: string | undefined): string {
  const kind = fieldKind(field)
  if (kind === 'switch') return value === ON || value === '' ? value : field.default
  if (kind === 'text') return typeof value === 'string' ? value.trim() : field.default
  if (kind === 'number') {
    if (value === undefined || value.trim() === '') return ''
    const held = Number(value)
    if (!Number.isFinite(held)) return field.default
    const floored = field.min !== undefined ? Math.max(field.min, held) : held
    const capped = field.max !== undefined ? Math.min(field.max, floored) : floored
    return String(capped)
  }
  const options = field.options ?? []
  const valid = options.some(option => option.value === value)
  return valid || (field.free && value) ? (value as string) : field.default
}

export function settingLabel(field: AgentSettingField, settings: AgentSettings): string {
  const value = settings[field.key] ?? field.default
  const kind = fieldKind(field)
  if (kind === 'switch') return isOn(value) ? 'On' : 'Off'
  if (kind === 'number') return value ? `${value}${field.unit ? ` ${field.unit}` : ''}` : 'Default'
  if (kind === 'text') return value || 'Default'
  return field.options?.find(option => option.value === value)?.label ?? value
}

export function resolveSettings(fields: AgentSettingField[], settings: AgentSettings): AgentSettings {
  const out: AgentSettings = {}
  for (const field of fields) out[field.key] = cleanSetting(field, settings[field.key])
  return out
}

export function changedSettings(fields: AgentSettingField[], settings: AgentSettings): AgentSettingField[] {
  return visibleSettingFields(fields, settings).filter(
    field => (settings[field.key] ?? field.default) !== field.default
  )
}

export function visibleSettingFields(fields: AgentSettingField[], settings: AgentSettings): AgentSettingField[] {
  return fields.filter(field => {
    if (!field.visibleWhen) return true
    const controllingField = fields.find(candidate => candidate.key === field.visibleWhen?.key)
    return (settings[field.visibleWhen.key] ?? controllingField?.default) === field.visibleWhen.value
  })
}

// One rate-limit window as the provider reports it: "5-hour limit" at 63%,
// "Weekly (Fable)" at 21%, and so on.
export interface UsageWindow {
  key: string
  label: string
  percent: number
  severity?: string
  resetsAt?: number
  active?: boolean
}

// Usage limits for the account an agent runs on, read on the owner's machine.
// Agents on the same account carry the same accountId, which is what lets the
// UI say "these share one set of limits".
export interface AgentUsage {
  provider: string
  fetchedAt: number
  // When the data itself was recorded, if older than the fetch (codex only
  // writes limits when it runs).
  asOf?: number
  accountId?: string
  accountLabel?: string
  plan?: string
  windows: UsageWindow[]
  error?: string
}

export interface PooledAgent {
  id: string
  label: string
  provider: string
  ownerId: string
  ownerName: string
  status: AgentStatus
  runs: Record<string, LiveRun>
  settings: AgentSettings
  fields: AgentSettingField[]
  steerable?: boolean
  usage?: AgentUsage
  // An uploaded photo, stored as an attachment file name. With none, the icon
  // is the one generated from the agent id.
  avatar?: string
}

export interface AgentDef {
  // Minted once, when the agent is made, and kept for the life of the agent.
  // Older definitions have none and get one the first time they are loaded.
  id?: string
  instanceId: string
  provider: string
  name: string
  settings: AgentSettings
}

export interface ProviderCapability {
  provider: string
  label: string
  fields: AgentSettingField[]
  installed: boolean
  // Whether crew knows how to install this CLI on this machine's platform.
  installable: boolean
  // What the row says about itself where installed is not the question. A
  // server is reached rather than installed, so it says whether it answered.
  hint?: string
  // The address behind a provider somebody wrote down, and the whole of what
  // tells one of those from the five that ship.
  server?: string
  // Standing in the way of an agent that would be made right now, where being
  // installed is not the whole of whether one would run.
  note?: string
}

// Mints an id for a new agent. Only ever called once per agent: the result is
// saved with the definition, so renaming yourself keeps the agents you have
// instead of minting a second set under the new name.
export function agentId(ownerName: string, instanceId: string): string {
  return `${ownerName.trim().toLowerCase()}/${instanceId}`
}

export function mentionCandidates<T extends Pick<PooledAgent, 'label' | 'status'>>(
  agents: T[],
  query: string | null
): T[] {
  if (query === null) return []
  const q = query.toLowerCase()
  const online = agents.filter(a => a.status !== 'offline')
  const prefix = online.filter(a => a.label.toLowerCase().startsWith(q))
  if (!q || q.includes(' ')) return prefix
  const within = online.filter(a => {
    const label = a.label.toLowerCase()
    return !label.startsWith(q) && label.includes(q)
  })
  return [...prefix, ...within]
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

// What a written mention pointed at: the agent's id, plus the name it went out
// under. The id is what the mention means, the name is only how it was spelled.
export interface AgentMentionRef {
  id: string
  label: string
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const stripMention = (text: string, label: string): string =>
  text
    .replace(new RegExp(`@${escapeRegExp(label)}(?![\\w-])`, 'i'), ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Who a piece of text names, whether or not they are here right now. Only
// agents that are here get the work, but a name on the page points at its agent
// either way, so it can be read back under the name they carry today.
export function agentMentionRefsIn(
  text: string,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>
): AgentMentionRef[] {
  const here = agents.map(agent => ({ ...agent, status: 'idle' as const }))
  const labels = new Map(agents.map(agent => [agent.id, agent.label]))
  return mentionsIn(text, here).map(id => ({ id, label: labels.get(id)! }))
}

// Brings written mentions up to date. A mention still means the agent it was
// aimed at, so a rename rewrites every "@old name" that pointed there. Names
// are swapped in one pass: two agents can trade names, and a rewritten mention
// must not be rewritten again by the next rename in the list.
export function relabelMentions(
  text: string,
  refs: AgentMentionRef[] | undefined,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>
): string {
  if (!refs?.length) return text
  const renames = new Map<string, string>()
  for (const ref of refs) {
    const agent = agents.find(a => a.id === ref.id)
    if (!agent || agent.label === ref.label) continue
    renames.set(ref.label.toLowerCase(), agent.label)
  }
  if (renames.size === 0) return text
  const ordered = [...renames.keys()].sort((a, b) => b.length - a.length)
  let out = ''
  let rest = text
  outer: for (;;) {
    const lower = rest.toLowerCase()
    for (let at = 0; at < rest.length; at++) {
      if (lower[at] !== '@') continue
      for (const old of ordered) {
        if (!lower.startsWith(old, at + 1)) continue
        const end = at + old.length + 1
        if (/[\w-]/.test(rest[end] ?? '')) continue
        out += `${rest.slice(0, at)}@${renames.get(old)}`
        rest = rest.slice(end)
        continue outer
      }
    }
    return out + rest
  }
}
