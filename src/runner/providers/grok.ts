import { ON, isOn, type AgentSettingField } from '../../shared/llm'
import { chunkText, makeLanes, str } from './acp'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { activityDetail, fileChanges, stepTodos } from './detail'
import { resultText } from './output'
import { taskCall } from './tasks'
import { usageFrom } from './tokens'
import type { ParsedOutput, Provider, RunParser } from './types'

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
    const opening = msg?.type === 'tool_call' || msg?.type === 'tool.call'
    const current = str(msg?.toolName) || str(msg?.name) || str(msg?.tool)
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
        output: finished ? outputText(msg) ?? resultText(msg?.output ?? msg?.result ?? msg?.content) : undefined
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
    const body = str(msg?.data) || str(msg?.text) || str(msg?.content) || str(msg?.delta)
    if (msg?.type === 'thought' || msg?.type === 'model.thinking') stream(out, 'thinking', body)
    if (msg?.type === 'text' || msg?.type === 'model.message') stream(out, 'text', body)
    if (msg?.type === 'tool_call' || msg?.type === 'tool_call_update' || msg?.type === 'tool.call' || msg?.type === 'tool.result') {
      activity(out, msg)
    }
    if (msg?.type === 'error') {
      close(out)
      if (str(msg?.message).trim()) out.push({ error: msg.message })
    }
    const model = str(msg?.model) || Object.keys(msg?.modelUsage ?? {})[0]
    const usage = usageFrom(msg?.usage, model)
    if (usage) {
      const cost = typeof msg?.total_cost_usd === 'number' ? msg.total_cost_usd : undefined
      out.push({ usage: { ...usage, ...(cost === undefined ? {} : { cost }), total: msg?.type === 'end' } })
    }
    if (msg?.type === 'end') {
      close(out)
      out.push({ turnEnd: true })
    }
    return out
  }

  return { parse }
}

const EFFORTS = [
  { value: '', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra high' }
]

const EFFORTS_45 = EFFORTS.filter(option => option.value !== 'xhigh')

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

export const grokFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', 'grok-4.6', 'grok-4.5']), default: '' },
  {
    key: 'effort',
    label: 'Thinking',
    options: EFFORTS,
    optionsWhen: [{ key: 'model', value: 'grok-4.5', options: EFFORTS_45 }],
    default: ''
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
    min: 2,
    unit: 'turns'
  }
]

const permissionArgs = (mode: string): string[] => {
  if (mode === 'plan') return ['--permission-mode', 'plan']
  if (mode === 'safe') return ['--permission-mode', 'dontAsk']
  return ['--always-approve']
}

export const grokArgs = (prompt: string, get: SettingReader): string[] => [
  '-p',
  prompt,
  '--output-format',
  'streaming-json',
  ...permissionArgs(get('mode')),
  ...flag('--model', get('model')),
  ...flag('--reasoning-effort', get('effort')),
  ...flag('--rules', get('instructions').trim()),
  ...flag('--sandbox', get('sandbox')),
  ...(!isOn(get('web')) ? ['--disable-web-search'] : []),
  ...(!isOn(get('planning')) ? ['--no-plan'] : []),
  ...(!isOn(get('subagents')) ? ['--no-subagents'] : []),
  ...flag('--tools', get('tools').trim()),
  ...flag('--disallowed-tools', get('disallowedTools').trim()),
  ...flag('--max-turns', get('maxTurns'))
]

export const grokEnv = (get: SettingReader): NodeJS.ProcessEnv => {
  const memory = get('memory')
  return memory ? { GROK_MEMORY: memory === ON ? '1' : '0' } : {}
}

const INSTALL_SH = 'curl -fsSL https://x.ai/cli/install.sh | bash'

export const grokProvider: Provider = makeCliProvider({
  name: 'grok',
  label: 'Grok',
  command: 'grok',
  fields: grokFields,
  args: grokArgs,
  env: grokEnv,
  makeParser: grokParser,
  install: { darwin: INSTALL_SH, linux: INSTALL_SH, win32: 'irm https://x.ai/cli/install.ps1 | iex' }
})
