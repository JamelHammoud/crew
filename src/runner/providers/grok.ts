import type { AgentSettingField } from '../../shared/llm'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { activityDetail, fileChanges } from './detail'
import type { OutputParser, ParsedOutput, Provider } from './types'

const SUBAGENT_TOOLS = new Set(['Task', 'Agent', 'Subagent'])

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const parseInput = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

// Grok Build streams newline-delimited events: session.start, model.thinking,
// tool.call, tool.result, model.message, session.end, error. Field names are
// matched loosely because a signed-in CLI is needed to observe real payloads;
// unknown lines fall through to cli.ts's raw-output fallback.
export const parseGrokLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  const out: ParsedOutput[] = []
  const body = str(msg?.text) || str(msg?.content) || str(msg?.delta)
  const callId = str(msg?.id) || str(msg?.call_id) || str(msg?.tool_call_id)
  if (msg?.type === 'model.thinking' && body.trim()) {
    out.push({ thinking: body })
  } else if (msg?.type === 'model.message' && body.trim()) {
    out.push({ text: body })
  } else if (msg?.type === 'tool.call') {
    const name = str(msg.name) || str(msg.tool)
    if (callId && name) {
      const input = parseInput(msg.arguments ?? msg.input)
      out.push({
        activity: {
          id: callId,
          kind: SUBAGENT_TOOLS.has(name) ? ('subagent' as const) : ('tool' as const),
          name,
          status: 'started' as const,
          detail: activityDetail(input),
          files: fileChanges(name, input)
        }
      })
    }
  } else if (msg?.type === 'tool.result') {
    if (callId) {
      out.push({ activity: { id: callId, kind: 'tool' as const, name: '', status: 'finished' as const } })
    }
  } else if (msg?.type === 'error') {
    if (str(msg.message).trim()) out.push({ error: msg.message })
  }
  const tokens = msg?.usage?.output_tokens ?? msg?.usage?.completion_tokens
  if (typeof tokens === 'number') out.push({ tokens })
  return out
}

export const grokFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', 'grok-4.5']), default: '' }
]

export const grokArgs = (prompt: string, get: SettingReader): string[] => [
  '-p',
  prompt,
  '--output-format',
  'streaming-json',
  '--always-approve',
  ...flag('--model', get('model'))
]

const INSTALL_SH = 'curl -fsSL https://x.ai/cli/install.sh | bash'

export const grokProvider: Provider = makeCliProvider({
  name: 'grok',
  label: 'Grok',
  command: 'grok',
  fields: grokFields,
  args: grokArgs,
  parser: parseGrokLine,
  install: { darwin: INSTALL_SH, linux: INSTALL_SH, win32: 'irm https://x.ai/cli/install.ps1 | iex' }
})
