import type { AgentSettingField, FileChange } from '../../shared/llm'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { codexModels } from './codex-models'
import { activityDetail } from './detail'
import { codexUsage } from './usage'
import type { OutputParser, ParsedOutput, Provider } from './types'

const TOOL_LABELS: Record<string, string> = {
  command_execution: 'Shell',
  file_change: 'Edit',
  mcp_tool_call: 'Mcp',
  web_search: 'WebSearch',
  todo_list: 'Todo'
}

const changeFiles = (changes: unknown): FileChange[] | undefined => {
  const paths = Array.isArray(changes)
    ? changes.map(c => (typeof c === 'string' ? c : c?.path)).filter((p): p is string => typeof p === 'string')
    : changes && typeof changes === 'object'
      ? Object.keys(changes as Record<string, unknown>)
      : []
  if (!paths.length) return undefined
  return paths.map(path => ({ path, added: 0, removed: 0 }))
}

const changedPaths = (changes: unknown): string | undefined => {
  if (Array.isArray(changes)) {
    const paths = changes.map(c => (typeof c === 'string' ? c : c?.path)).filter(Boolean)
    return paths.length ? paths.join(', ') : undefined
  }
  if (changes && typeof changes === 'object') {
    const keys = Object.keys(changes as Record<string, unknown>)
    return keys.length ? keys.join(', ') : undefined
  }
  return undefined
}

const toolName = (item: any): string => {
  if (item.type === 'mcp_tool_call') {
    const parts = [item.server, item.tool ?? item.tool_name].filter(Boolean)
    if (parts.length) return parts.join('.')
  }
  return TOOL_LABELS[item.type] ?? item.type
}

const toolDetail = (item: any): string | undefined => {
  switch (item.type) {
    case 'command_execution':
      return typeof item.command === 'string' ? item.command : undefined
    case 'file_change':
      return changedPaths(item.changes)
    case 'mcp_tool_call':
      return activityDetail(item.arguments)
    case 'web_search':
      return typeof item.query === 'string' ? item.query : undefined
    default:
      return undefined
  }
}

export const parseCodexLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  const out: ParsedOutput[] = []

  if (msg?.type === 'item.started' || msg?.type === 'item.updated' || msg?.type === 'item.completed') {
    const item = msg.item
    if (!item?.type) return out
    const done = msg.type === 'item.completed'

    // Text and reasoning are only emitted once the item closes — session.ts appends
    // text on same-id merges, so emitting on updates too would duplicate the content.
    if (item.type === 'agent_message') {
      if (done && typeof item.text === 'string' && item.text.trim()) out.push({ text: item.text })
      return out
    }
    if (item.type === 'reasoning') {
      if (done && typeof item.text === 'string' && item.text.trim()) out.push({ thinking: item.text })
      return out
    }
    if (item.type === 'error') {
      if (typeof item.message === 'string' && item.message.trim()) out.push({ error: item.message })
      return out
    }
    if (typeof item.id !== 'string') return out
    out.push({
      activity: {
        id: item.id,
        kind: 'tool' as const,
        name: toolName(item),
        status: done ? ('finished' as const) : ('started' as const),
        detail: toolDetail(item),
        files: item.type === 'file_change' ? changeFiles(item.changes) : undefined
      }
    })
    return out
  }

  if (msg?.type === 'turn.completed') {
    const tokens = msg?.usage?.output_tokens
    if (typeof tokens === 'number') out.push({ tokens })
    return out
  }
  if (msg?.type === 'turn.failed') {
    const message = msg?.error?.message
    if (typeof message === 'string' && message.trim()) out.push({ error: message })
    return out
  }
  if (msg?.type === 'error') {
    if (typeof msg.message === 'string' && msg.message.trim()) out.push({ error: msg.message })
  }
  return out
}

export const codexFields = (): AgentSettingField[] => {
  const { models, efforts } = codexModels()
  return [
    { key: 'model', label: 'Model', options: choices(['', ...models]), default: '' },
    { key: 'effort', label: 'Thinking', options: choices(efforts), default: 'high' }
  ]
}

export const codexArgs = (prompt: string, get: SettingReader): string[] => [
  'exec',
  '--dangerously-bypass-approvals-and-sandbox',
  '--json',
  ...flag('--model', get('model')),
  ...flag('-c', get('effort') ? `model_reasoning_effort="${get('effort')}"` : ''),
  prompt
]

export const codexProvider: Provider = makeCliProvider({
  name: 'codex',
  label: 'Codex',
  command: 'codex',
  fields: codexFields,
  args: codexArgs,
  parser: parseCodexLine,
  usage: codexUsage
})
