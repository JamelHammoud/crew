import type { FileChange } from '../../shared/llm'
import { activityDetail } from './detail'
import { commandOutput } from './output'
import type { ParsedActivity } from './types'

const DIFF_LIMIT = 20000

const ACTION_TOOLS: Record<string, string> = {
  read: 'Read',
  listFiles: 'ListFiles',
  search: 'Search',
  unknown: 'Shell'
}

const ITEM_TOOLS: Record<string, string> = {
  commandExecution: 'Shell',
  fileChange: 'Edit',
  webSearch: 'WebSearch',
  imageView: 'Read',
  imageGeneration: 'GenerateImage',
  sleep: 'Sleep',
  contextCompaction: 'Memory',
  enteredReviewMode: 'Plan',
  exitedReviewMode: 'Plan'
}

const SUBAGENTS = new Set(['subAgentActivity', 'collabAgentToolCall'])

const SHELL_WRAP = /^\S*(?:ba|z)?sh\s+-[a-z]*c\s+(['"])([\s\S]*)\1\s*$/

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const unwrap = (command: string): string => command.match(SHELL_WRAP)?.[2] ?? command

const actionList = (item: any): any[] => (Array.isArray(item?.commandActions) ? item.commandActions : [])

const actionDetail = (action: any): string => {
  const type = str(action?.type)
  if (type === 'read') return str(action.path) || str(action.name) || str(action.command)
  if (type === 'search')
    return [str(action.query), str(action.path)].filter(Boolean).join(' in ') || str(action.command)
  if (type === 'listFiles') return str(action.path) || str(action.command)
  return str(action.command)
}

export function commandTool(item: any): { name: string; detail: string } {
  const actions = actionList(item)
  const types = new Set(actions.map(action => str(action?.type)))
  const name = types.size === 1 ? (ACTION_TOOLS[[...types][0]] ?? 'Shell') : 'Shell'
  if (actions.length === 1) return { name, detail: actionDetail(actions[0]) || unwrap(str(item?.command)) }
  const joined = actions
    .map(action => str(action?.command))
    .filter(Boolean)
    .join(' && ')
  return { name, detail: joined || unwrap(str(item?.command)) }
}

const clip = (diff: string): string => (diff.length > DIFF_LIMIT ? diff.slice(0, DIFF_LIMIT) + '…' : diff)

const bodyLines = (body: string): string[] => {
  const lines = body.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

const unifiedCounts = (diff: string): { added: number; removed: number } => {
  let added = 0
  let removed = 0
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added += 1
    else if (line.startsWith('-')) removed += 1
  }
  return { added, removed }
}

export function codexFile(change: any): FileChange | null {
  const path = str(change?.path)
  if (!path) return null
  const diff = str(change?.diff)
  const kind = str(change?.kind?.type)
  if (diff && !/^@@/m.test(diff) && (kind === 'add' || kind === 'delete')) {
    const sign = kind === 'add' ? '+' : '-'
    const lines = bodyLines(diff)
    const marked = clip(lines.map(line => sign + line).join('\n'))
    return kind === 'add'
      ? { path, added: lines.length, removed: 0, diff: marked }
      : { path, added: 0, removed: lines.length, diff: marked }
  }
  return { path, ...unifiedCounts(diff), diff: clip(diff) }
}

export function codexFiles(changes: unknown): FileChange[] | undefined {
  const list = Array.isArray(changes) ? changes : []
  const files = list.map(codexFile).filter((file): file is FileChange => file !== null)
  return files.length ? files : undefined
}

const webDetail = (item: any): string => {
  const action = item?.action
  const queries = Array.isArray(action?.queries) ? action.queries.filter((q: unknown) => str(q)) : []
  if (queries.length) return queries.join(', ')
  return str(action?.pattern) || str(action?.url) || str(item?.query)
}

const mcpName = (item: any): string => {
  const parts = [str(item?.appContext?.appName) || str(item?.server), str(item?.tool)].filter(Boolean)
  return parts.join('.') || 'Mcp'
}

const named = (item: any): { name: string; detail: string } => {
  const type = str(item?.type)
  if (type === 'commandExecution') return commandTool(item)
  if (type === 'fileChange') {
    const paths = (Array.isArray(item.changes) ? item.changes : []).map((c: any) => str(c?.path)).filter(Boolean)
    return { name: 'Edit', detail: paths.join(', ') }
  }
  if (type === 'webSearch') return { name: 'WebSearch', detail: webDetail(item) }
  if (type === 'mcpToolCall') return { name: mcpName(item), detail: activityDetail(item.arguments) ?? '' }
  if (type === 'dynamicToolCall') {
    const name = [str(item.namespace), str(item.tool)].filter(Boolean).join('.')
    return { name: name || 'Tool', detail: activityDetail(item.arguments) ?? '' }
  }
  if (type === 'subAgentActivity') return { name: 'Agent', detail: str(item.agentPath) }
  if (type === 'collabAgentToolCall') return { name: 'Agent', detail: str(item.prompt) || str(item.tool) }
  if (type === 'imageView') return { name: 'Read', detail: str(item.path) }
  if (type === 'imageGeneration') return { name: 'GenerateImage', detail: str(item.revisedPrompt) }
  if (type === 'sleep') return { name: 'Sleep', detail: '' }
  if (type === 'hookPrompt') {
    const fragments = Array.isArray(item.fragments) ? item.fragments : []
    return {
      name: 'Hook',
      detail: fragments
        .map((f: any) => str(f?.text))
        .filter(Boolean)
        .join('\n')
    }
  }
  if (type === 'enteredReviewMode' || type === 'exitedReviewMode') return { name: 'Plan', detail: str(item.review) }
  return { name: ITEM_TOOLS[type] ?? type, detail: '' }
}

export function itemActivity(item: any, done: boolean): ParsedActivity | null {
  const id = str(item?.id)
  const type = str(item?.type)
  if (!id || !type) return null
  const { name, detail } = named(item)
  return {
    id,
    kind: SUBAGENTS.has(type) ? 'subagent' : 'tool',
    name,
    status: done ? 'finished' : 'started',
    detail: detail || undefined,
    output: type === 'commandExecution' ? commandOutput(item.aggregatedOutput) : undefined,
    files: type === 'fileChange' ? codexFiles(item.changes) : undefined
  }
}
