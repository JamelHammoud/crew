import { ON, isOn, type AgentSettingField } from '../../shared/llm'
import { acpDialog, CANCELLED, chunkText, makeLanes, str } from './acp'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { acpModels, refreshAcpModels } from './acp-models'
import { activityDetail, fileChanges, stepTodos } from './detail'
import { resultText } from './output'
import { taskCall } from './tasks'
import { usageFrom } from './tokens'
import type { Dialog, ParsedOutput, Provider, RunOptions, RunParser } from './types'

const SUBAGENT_TOOLS = new Set(['task', 'agent', 'subagent', 'spawn_subagent'])
const STARTED = new Set(['pending', 'in_progress'])
const FINISHED = new Set(['completed', 'failed'])

const parseInput = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

const outputText = (msg: any): string | undefined => {
  const raw = msg?.rawOutput
  const direct = typeof raw === 'string' ? raw : str(raw?.output_for_prompt)
  if (direct) return resultText(direct)
  const content = Array.isArray(msg?.content) ? msg.content : []
  return resultText(content.map((part: any) => chunkText(part?.content)).filter(Boolean))
}

export function grokParser(): RunParser {
  const { close, stream } = makeLanes()
  const names = new Map<string, string>()

  const activity = (out: ParsedOutput[], msg: any): void => {
    const id = str(msg?.toolCallId) || str(msg?.id) || str(msg?.call_id) || str(msg?.tool_call_id)
    if (!id) return
    const opening = msg?.type === 'tool_call' || msg?.type === 'tool.call' || str(msg?.sessionUpdate) === 'tool_call'
    const current = str(msg?.toolName) || str(msg?.title) || str(msg?.name) || str(msg?.tool)
    if (opening && current) names.set(id, current)
    const name = names.get(id) || current
    const status = str(msg?.status)
    const running = opening || STARTED.has(status)
    const finished = msg?.type === 'tool.result' || FINISHED.has(status)
    if (!running && !finished) return
    const input = parseInput(msg?.rawInput ?? msg?.arguments ?? msg?.input)
    if (!opening && running && input === undefined) return
    close(out)
    out.push({
      activity: {
        id,
        kind: SUBAGENT_TOOLS.has(name.toLowerCase()) ? 'subagent' : 'tool',
        name,
        status: finished ? 'finished' : 'started',
        detail: input === undefined ? undefined : activityDetail(input),
        files: input === undefined ? undefined : fileChanges(name, input),
        todos: input === undefined ? undefined : stepTodos(input),
        task: input === undefined ? undefined : taskCall(name, input),
        output: finished ? (outputText(msg) ?? resultText(msg?.output ?? msg?.result ?? msg?.content)) : undefined
      }
    })
  }

  const parse = (line: string): ParsedOutput[] => {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return []
    }
    const out: ParsedOutput[] = []
    const update = str(msg?.method) === 'session/update' ? (msg?.params?.update ?? msg?.params) : msg
    const kind = str(update?.sessionUpdate) || str(update?.type)
    const body =
      chunkText(update?.content) || str(update?.data) || str(update?.text) || str(update?.content) || str(update?.delta)
    if (kind === 'thought' || kind === 'model.thinking' || kind === 'agent_thought_chunk') {
      stream(out, 'thinking', body)
    }
    if (kind === 'text' || kind === 'model.message' || kind === 'agent_message_chunk') stream(out, 'text', body)
    if (kind === 'tool_call' || kind === 'tool_call_update' || kind === 'tool.call' || kind === 'tool.result') {
      activity(out, update)
    }
    if (kind === 'error' || (msg?.error && msg?.id !== undefined)) {
      close(out)
      const message = str(update?.message) || str(msg?.error?.message)
      if (message.trim()) out.push({ error: message })
    }
    const meta = msg?.result?._meta
    const model = str(meta?.modelId) || str(update?.model) || Object.keys(update?.modelUsage ?? {})[0]
    const rawUsage = meta?.usage ?? update?.usage
    const acpUsage =
      typeof rawUsage?.inputTokens === 'number' && typeof rawUsage?.cachedReadTokens === 'number'
        ? {
            input_tokens: Math.max(
              0,
              rawUsage.inputTokens -
                rawUsage.cachedReadTokens -
                (typeof rawUsage.cacheCreationTokens === 'number' ? rawUsage.cacheCreationTokens : 0)
            ),
            output_tokens: rawUsage.outputTokens,
            cache_read_input_tokens: rawUsage.cachedReadTokens,
            cache_creation_input_tokens: rawUsage.cacheCreationTokens
          }
        : rawUsage
    const usage = usageFrom(acpUsage, model)
    const stopped = str(msg?.result?.stopReason)
    if (usage) {
      const dollars =
        typeof update?.total_cost_usd === 'number'
          ? update.total_cost_usd
          : typeof rawUsage?.costUsdTicks === 'number'
            ? rawUsage.costUsdTicks / 1_000_000_000
            : undefined
      out.push({
        usage: { ...usage, ...(dollars === undefined ? {} : { cost: dollars }), total: kind === 'end' || !!stopped }
      })
    }
    if (kind === 'end' || stopped) {
      close(out)
      if (kind === 'end' || stopped !== CANCELLED) out.push({ turnEnd: true })
    }
    return out
  }

  return { parse }
}

const MODES = [
  { value: 'anything', label: 'Anything' },
  { value: 'safe', label: 'Safe changes' },
  { value: 'plan', label: 'Read only' }
]

const MEMORY = [
  { value: '', label: 'Default' },
  { value: ON, label: 'On' },
  { value: 'off', label: 'Off' }
]

const SANDBOXES = [
  { value: '', label: 'Default' },
  { value: 'off', label: 'Off' },
  { value: 'workspace', label: 'Project only' },
  { value: 'read-only', label: 'Read only' },
  { value: 'strict', label: 'Strict' }
]

export const grokFields = (): AgentSettingField[] => {
  const models = acpModels('grok')
  const efforts = models.flatMap(model => model.efforts)
  const uniqueEfforts = efforts.filter((effort, index) => efforts.findIndex(one => one.value === effort.value) === index)
  return [
    {
      key: 'model',
      label: 'Model',
      options: [{ value: '', label: 'Default' }, ...models],
      default: '',
      free: true
    },
    {
      key: 'effort',
      label: 'Thinking',
      options: [{ value: '', label: 'Default' }, ...uniqueEfforts],
      optionsWhen: models
        .filter(model => model.efforts.length > 0)
        .map(model => ({
          key: 'model',
          value: model.value,
          options: [{ value: '', label: 'Default' }, ...model.efforts]
        })),
      default: '',
      free: true
    },
  {
    key: 'instructions',
    label: 'Instructions',
    kind: 'paragraph',
    default: '',
    advanced: true,
    placeholder: 'None',
    line: 'Read before every message.'
  },
  {
    key: 'mode',
    label: 'What it may do',
    options: MODES,
    default: 'anything',
    advanced: true,
    section: 'On this computer'
  },
  {
    key: 'sandbox',
    label: 'Sandbox',
    options: SANDBOXES,
    default: '',
    advanced: true,
    section: 'On this computer'
  },
  {
    key: 'web',
    label: 'Web access',
    kind: 'switch',
    default: ON,
    advanced: true,
    section: 'Tools'
  },
  {
    key: 'planning',
    label: 'Planning',
    kind: 'switch',
    default: ON,
    advanced: true,
    section: 'Tools'
  },
  {
    key: 'subagents',
    label: 'Subagents',
    kind: 'switch',
    default: ON,
    advanced: true,
    section: 'Tools'
  },
  {
    key: 'memory',
    label: 'Grok memory',
    options: MEMORY,
    default: '',
    advanced: true,
    section: 'Tools'
  },
  {
    key: 'tools',
    label: 'Only these tools',
    kind: 'text',
    default: '',
    advanced: true,
    section: 'Tools',
    placeholder: 'All',
    line: 'Separated by commas.'
  },
  {
    key: 'disallowedTools',
    label: 'Tools it cannot use',
    kind: 'text',
    default: '',
    advanced: true,
    section: 'Tools',
    placeholder: 'None',
    line: 'Separated by commas.'
  },
  {
    key: 'maxTurns',
    label: 'Most turns per message',
    kind: 'number',
    default: '',
    advanced: true,
    section: 'Limits',
    min: 1,
    unit: 'turns'
    }
  ]
}

const permissionArgs = (mode: string): string[] => {
  if (mode === 'plan') return ['--permission-mode', 'plan']
  if (mode === 'safe') return ['--permission-mode', 'dontAsk']
  return []
}

export const grokArgs = (_prompt: string, get: SettingReader): string[] => [
  ...permissionArgs(get('mode')),
  ...flag('--rules', get('instructions').trim()),
  ...flag('--sandbox', get('sandbox')),
  ...(!isOn(get('web')) ? ['--disable-web-search'] : []),
  ...(!isOn(get('planning')) ? ['--no-plan'] : []),
  ...(!isOn(get('subagents')) ? ['--no-subagents'] : []),
  ...flag('--tools', get('tools').trim()),
  ...flag('--disallowed-tools', get('disallowedTools').trim()),
  ...flag('--max-turns', get('maxTurns')),
  'agent',
  ...(get('mode') === 'anything' ? ['--always-approve'] : []),
  ...flag('--model', get('model')),
  ...flag('--reasoning-effort', get('effort')),
  'stdio'
]

export const grokEnv = (get: SettingReader): NodeJS.ProcessEnv => {
  const memory = get('memory')
  return memory ? { GROK_MEMORY: memory === ON ? '1' : '0' } : {}
}

export const grokDialog = (prompt: string, cwd: string, _get: SettingReader, options: RunOptions = {}): Dialog =>
  acpDialog({ prompt, cwd, run: options, terminal: true })

const INSTALL_SH = 'curl -fsSL https://x.ai/cli/install.sh | bash'

export const grokProvider: Provider = makeCliProvider({
  name: 'grok',
  label: 'Grok',
  command: 'grok',
  fields: grokFields,
  args: grokArgs,
  env: grokEnv,
  makeParser: grokParser,
  dialog: (prompt, cwd, get, run) => grokDialog(prompt, cwd, get, run),
  steerable: true,
  mcp: 'inline',
  discover: () => refreshAcpModels({ provider: 'grok', args: ['agent', '--always-approve', 'stdio'] }),
  install: { darwin: INSTALL_SH, linux: INSTALL_SH, win32: 'irm https://x.ai/cli/install.ps1 | iex' }
})
