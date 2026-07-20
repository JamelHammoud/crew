import { choices, flag, makeCliProvider, type SettingReader } from './cli'
import { activityDetail, fileChanges } from './detail'
import type { AgentSettingField } from '../../shared/llm'
import type { OutputParser, Provider } from './types'

const SUBAGENT_TOOLS = new Set(['Task'])

export const parseClaudeLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  if (msg?.type === 'stream_event' && msg.event) {
    const event = msg.event
    if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
      return [{ thinkingStart: { index: event.index } }]
    }
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'thinking_delta' &&
      typeof event.delta.thinking === 'string'
    ) {
      return [{ thinkingDelta: { index: event.index, text: event.delta.thinking } }]
    }
    if (event.type === 'content_block_stop') {
      return [{ thinkingStop: { index: event.index } }]
    }
    return []
  }
  if (msg?.type === 'assistant' && Array.isArray(msg.message?.content)) {
    const out = []
    for (const block of msg.message.content) {
      if (block?.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
        out.push({ thinking: block.thinking })
      }
      if (block?.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        out.push({ text: block.text })
      }
      if (block?.type === 'tool_use' && block.id && block.name) {
        out.push({
          activity: {
            id: block.id,
            kind: SUBAGENT_TOOLS.has(block.name) ? ('subagent' as const) : ('tool' as const),
            name: block.name,
            status: 'started' as const,
            detail: activityDetail(block.input),
            files: fileChanges(block.name, block.input)
          }
        })
      }
    }
    const outputTokens = msg.message?.usage?.output_tokens
    if (typeof outputTokens === 'number') out.push({ tokens: outputTokens })
    return out
  }
  if (msg?.type === 'result') {
    const outputTokens = msg?.usage?.output_tokens
    return typeof outputTokens === 'number' ? [{ tokens: outputTokens }] : []
  }
  if (msg?.type === 'user' && Array.isArray(msg.message?.content)) {
    const out = []
    for (const block of msg.message.content) {
      if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        out.push({ activity: { id: block.tool_use_id, kind: 'tool' as const, name: '', status: 'finished' as const } })
      }
    }
    return out
  }
  return []
}

export const claudeFields = (): AgentSettingField[] => [
  { key: 'model', label: 'Model', options: choices(['', 'opus', 'sonnet', 'haiku', 'fable']), default: 'opus' },
  { key: 'effort', label: 'Thinking', options: choices(['low', 'medium', 'high', 'xhigh', 'max']), default: 'high' }
]

export const claudeArgs = (prompt: string, get: SettingReader): string[] => [
  '-p',
  prompt,
  '--output-format',
  'stream-json',
  '--verbose',
  '--include-partial-messages',
  ...flag('--model', get('model')),
  ...flag('--effort', get('effort')),
  '--permission-mode',
  'bypassPermissions',
  '--dangerously-skip-permissions'
]

export const claudeProvider: Provider = makeCliProvider({
  name: 'claude',
  label: 'Claude',
  command: 'claude',
  fields: claudeFields,
  args: claudeArgs,
  parser: parseClaudeLine
})
