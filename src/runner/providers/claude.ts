import { makeCliProvider } from './cli'
import { activityDetail } from './detail'
import type { OutputParser, Provider } from './types'

const SUBAGENT_TOOLS = new Set(['Task'])

export const parseClaudeLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  if (msg?.type === 'assistant' && Array.isArray(msg.message?.content)) {
    const out = []
    for (const block of msg.message.content) {
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
            detail: activityDetail(block.input)
          }
        })
      }
    }
    return out
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

export const claudeProvider: Provider = makeCliProvider({
  name: 'claude',
  label: 'Claude',
  command: 'claude',
  args: prompt => ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
  parser: parseClaudeLine
})
