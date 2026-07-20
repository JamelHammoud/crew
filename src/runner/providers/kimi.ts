import { makeCliProvider } from './cli'
import { activityDetail } from './detail'
import type { OutputParser, Provider } from './types'

const SUBAGENT_TOOLS = new Set(['Agent'])

export const parseKimiLine: OutputParser = line => {
  let msg: any
  try {
    msg = JSON.parse(line)
  } catch {
    return []
  }
  if (msg?.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim()) {
    return [{ text: msg.content }]
  }
  if (msg?.role === 'assistant' && Array.isArray(msg.tool_calls)) {
    const out = []
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
          detail: activityDetail(input)
        }
      })
    }
    return out
  }
  if (msg?.role === 'tool' && typeof msg.tool_call_id === 'string') {
    return [{ activity: { id: msg.tool_call_id, kind: 'tool' as const, name: '', status: 'finished' as const } }]
  }
  return []
}

export const kimiProvider: Provider = makeCliProvider({
  name: 'kimi',
  label: 'Kimi',
  command: 'kimi',
  args: prompt => ['-p', prompt, '--output-format', 'stream-json'],
  parser: parseKimiLine
})
