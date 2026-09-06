import type { AgentSettingField } from '../../shared/llm'
import { mcpHeaderEnv, type McpServer } from '../../shared/plugins'
import { choices, makeCliProvider, type SettingReader } from './cli'
import { codexDialog } from './codex-app'
import { codexModels, refreshCodexModels } from './codex-models'
import { itemActivity } from './codex-items'
import { activityDetail, stepTodos } from './detail'
import { usageFrom } from './tokens'
import { codexUsage } from './usage'
import type { OutputParser, ParsedOutput, Provider, RunOptions, RunParser } from './types'

const TEXT = 0
const PLAN_ID = 'plan'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const lane = (value: unknown): number => (typeof value === 'number' ? value : 0)

const thinkIndex = (summaryIndex: unknown): number => lane(summaryIndex) * 2 + 1

const rawIndex = (contentIndex: unknown): number => lane(contentIndex) * 2 + 2

const started = (item: any): ParsedOutput[] => {
  const type = str(item?.type)
  if (type === 'agentMessage') return [{ textStart: { index: TEXT, aside: str(item.phase) === 'commentary' } }]
  if (type === 'reasoning' || type === 'userMessage') return []
  const activity = itemActivity(item, false)
  return activity ? [{ activity }] : []
}

const completed = (item: any): ParsedOutput[] => {
  const type = str(item?.type)
  if (type === 'agentMessage') {
    const text = str(item.text).trim()
    const stop: ParsedOutput = { blockStop: { index: TEXT } }
    return text && str(item.phase) !== 'commentary' ? [stop, { text }] : [stop]
  }
  if (type === 'reasoning') {
    const parts = (value: unknown): string[] => (Array.isArray(value) ? value : []).map(str)
    const summary = parts(item.summary)
    const content = parts(item.content)
    const out: ParsedOutput[] = [
      ...summary.map((_, index) => ({ blockStop: { index: thinkIndex(index) } })),
      ...content.map((_, index) => ({ blockStop: { index: rawIndex(index) } }))
    ]
    const text = [...summary, ...content].filter(Boolean).join('\n\n')
    if (text) out.push({ thinking: text })
    return out
  }
  if (type === 'userMessage') return []
  const activity = itemActivity(item, true)
  return activity ? [{ activity }] : []
}

const planOutput = (params: any): ParsedOutput[] => {
  const plan = Array.isArray(params?.plan) ? params.plan : []
  const todos = stepTodos({ plan })
  if (!todos) return []
  return [
    {
      activity: {
        id: PLAN_ID,
        kind: 'tool',
        name: 'UpdatePlan',
        status: 'finished',
        detail: activityDetail({ plan }),
        todos
      }
    }
  ]
}

const turnOutput = (params: any): ParsedOutput[] => {
  const out: ParsedOutput[] = [{ turnEnd: true }]
  if (str(params?.turn?.status) === 'failed') {
    const message = str(params.turn?.error?.message).trim()
    if (message) out.push({ error: message })
  }
  return out
}

export const parseCodexLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  const method = str(msg?.method)
  if (!method) {
    const model = str(msg?.result?.model)
    return model ? [{ usage: { model } }] : []
  }
  if (msg.id !== undefined && msg.id !== null) return []
  const params = msg.params ?? {}

  switch (method) {
    case 'item/started':
      return started(params.item)
    case 'item/completed':
      return completed(params.item)
    case 'item/agentMessage/delta': {
      const delta = str(params.delta)
      return delta ? [{ textDelta: { index: TEXT, text: delta } }] : []
    }
    case 'item/reasoning/summaryPartAdded': {
      const index = thinkIndex(params.summaryIndex)
      return [{ blockStop: { index } }, { thinkingStart: { index } }]
    }
    case 'item/reasoning/summaryTextDelta': {
      const delta = str(params.delta)
      return delta ? [{ thinkingDelta: { index: thinkIndex(params.summaryIndex), text: delta } }] : []
    }
    case 'item/reasoning/textDelta': {
      const delta = str(params.delta)
      return delta ? [{ thinkingDelta: { index: rawIndex(params.contentIndex), text: delta } }] : []
    }
    case 'turn/plan/updated':
      return planOutput(params)
    case 'thread/tokenUsage/updated': {
      const usage = usageFrom(params.tokenUsage?.total)
      return usage ? [{ usage: { ...usage, total: true } }] : []
    }
    case 'turn/completed':
      return turnOutput(params)
    case 'error': {
      if (params.willRetry) return []
      const message = str(params.error?.message).trim()
      return message ? [{ error: message }] : []
    }
    default:
      return []
  }
}

export const codexParser = (): RunParser => {
  let threadId = ''
  return {
    parse: line => {
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        return []
      }
      const method = str(msg?.method)
      const notifiedThreadId = str(msg?.params?.threadId)
      if (!threadId) threadId = str(msg?.result?.thread?.id)
      if (!threadId && method === 'turn/started') threadId = notifiedThreadId
      if (threadId && notifiedThreadId && notifiedThreadId !== threadId) return []
      return parseCodexLine(line)
    }
  }
}

const SEARCH = [
  { value: '', label: 'Default' },
  { value: 'live', label: 'Live' },
  { value: 'indexed', label: 'Indexed' },
  { value: 'cached', label: 'Cached' },
  { value: 'disabled', label: 'Off' }
]

const VERBOSITY = [
  { value: '', label: 'Default' },
  { value: 'low', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'Long' }
]

const PERSONALITY = [
  { value: '', label: 'Default' },
  { value: 'pragmatic', label: 'Pragmatic' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'none', label: 'Plain' }
]

export const codexFields = (): AgentSettingField[] => {
  const { models, efforts } = codexModels()
  return [
    { key: 'model', label: 'Model', options: choices(['', ...models]), default: '', free: true },
    { key: 'effort', label: 'Thinking', options: choices(['', ...efforts]), default: '', free: true },
    {
      key: 'instructions',
      label: 'Instructions',
      kind: 'paragraph',
      default: '',
      advanced: true,
      placeholder: 'None',
      line: 'Read before every message.'
    },
    { key: 'search', label: 'Web search', options: SEARCH, default: '', advanced: true, section: 'What it can reach' },
    {
      key: 'verbosity',
      label: 'Answer length',
      options: VERBOSITY,
      default: '',
      advanced: true,
      section: 'Answers'
    },
    { key: 'personality', label: 'Tone', options: PERSONALITY, default: '', advanced: true, section: 'Answers' }
  ]
}

export const codexConfigArgs = (get: SettingReader): string[] => [
  ...(get('search') ? ['-c', `web_search=${tomlText(get('search'))}`] : []),
  ...(get('verbosity') ? ['-c', `model_verbosity=${tomlText(get('verbosity'))}`] : [])
]

const tomlText = (value: string): string => JSON.stringify(value)

const tomlList = (values: string[]): string => `[${values.map(tomlText).join(',')}]`

const tomlTable = (entries: Array<[string, string]>): string =>
  `{${entries.map(([key, value]) => `${key}=${value}`).join(',')}}`

const serverToml = (name: string, server: McpServer): string => {
  if ('url' in server) {
    const entries: Array<[string, string]> = [['url', tomlText(server.url)]]
    const headers = Object.entries(server.headers ?? {})
    if (headers.length) {
      entries.push(['env_http_headers', tomlTable(headers.map(([key]) => [key, tomlText(mcpHeaderEnv(name, key))]))])
    }
    return tomlTable(entries)
  }
  const entries: Array<[string, string]> = [['command', tomlText(server.command)]]
  if (server.args?.length) entries.push(['args', tomlList(server.args)])
  const env = Object.entries(server.env ?? {})
  if (env.length) entries.push(['env', tomlTable(env.map(([key, value]) => [key, tomlText(value)]))])
  return tomlTable(entries)
}

export const codexMcpArgs = (servers: Record<string, McpServer> = {}): string[] =>
  Object.entries(servers).flatMap(([name, server]) => ['-c', `mcp_servers.${name}=${serverToml(name, server)}`])

export const codexArgs = (_prompt?: string, get?: SettingReader, run: RunOptions = {}): string[] => [
  'app-server',
  ...codexMcpArgs(run.mcp?.servers),
  ...(get ? codexConfigArgs(get) : [])
]

// Codex has no standalone installer script; npm is its documented install path.
const INSTALL_NPM = 'npm install -g @openai/codex'

const cliProvider = makeCliProvider({
  name: 'codex',
  label: 'Codex',
  command: 'codex',
  fields: codexFields,
  args: codexArgs,
  makeParser: codexParser,
  dialog: codexDialog,
  mcp: 'inline',
  usage: codexUsage,
  install: { darwin: INSTALL_NPM, linux: INSTALL_NPM, win32: INSTALL_NPM }
})

export const codexProvider: Provider = {
  ...cliProvider,
  detect: async () => {
    const installed = await cliProvider.detect()
    if (installed) await refreshCodexModels()
    return installed
  }
}
