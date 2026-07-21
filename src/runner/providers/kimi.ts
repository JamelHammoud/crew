import type { AgentSettingField } from '../../shared/llm'
import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { activityDetail, fileChanges } from './detail'
import { kimiModels } from './kimi-models'
import type { OutputParser, Provider } from './types'

const SUBAGENT_TOOLS = new Set(['Agent'])

export const parseKimiLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  const out = []
  if (msg?.role === 'assistant') {
    if (typeof msg.reasoning_content === 'string' && msg.reasoning_content.trim()) {
      out.push({ thinking: msg.reasoning_content })
    }
    if (typeof msg.content === 'string' && msg.content.trim()) {
      out.push({ text: msg.content })
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const call of msg.tool_calls) {
        const name = call?.function?.name
        if (!call?.id || !name) continue
        let input: unknown
        try {
          input = JSON.parse(call.function.arguments ?? '{}')
        } catch {
          input = undefined
        }
        out.push({
          activity: {
            id: call.id,
            kind: SUBAGENT_TOOLS.has(name) ? ('subagent' as const) : ('tool' as const),
            name,
            status: 'started' as const,
            detail: activityDetail(input),
            files: fileChanges(name, input)
          }
        })
      }
    }
  }
  if (msg?.role === 'tool' && typeof msg.tool_call_id === 'string') {
    out.push({ activity: { id: msg.tool_call_id, kind: 'tool' as const, name: '', status: 'finished' as const } })
  }
  const tokens = msg?.usage?.output_tokens ?? msg?.usage?.completion_tokens
  if (typeof tokens === 'number') out.push({ tokens })
  return out
}

export const kimiFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', ...kimiModels()]), default: '' }
]

export const kimiArgs = (prompt: string, get: SettingReader): string[] => [
  '-p',
  prompt,
  '--output-format',
  'stream-json',
  ...flag('--model', get('model'))
]

const INSTALL_SH = 'curl -LsSf https://code.kimi.com/install.sh | bash'

export const kimiProvider: Provider = makeCliProvider({
  name: 'kimi',
  label: 'Kimi',
  command: 'kimi',
  fields: kimiFields,
  args: kimiArgs,
  parser: parseKimiLine,
  install: {
    darwin: INSTALL_SH,
    linux: INSTALL_SH,
    win32: 'Invoke-RestMethod https://code.kimi.com/install.ps1 | Invoke-Expression'
  }
})
