import type { McpServer } from '../../shared/plugins'
import { acpDialog, acpServers, CANCELLED, chunkText, makeLanes, str } from './acp'
import type { SettingReader } from './cli'
import { activityDetail, fileChanges, stepTodos } from './detail'
import { kimiUsage, kimiWire } from './kimi-usage'
import { taskCall } from './tasks'
import type { Dialog, ParsedOutput, RunOptions, RunParser } from './types'

const USAGE_MS = 1500

// Everything is approved before the turn starts, which is the posture every
// other CLI here runs under. The permission requests are still answered,
// because a CLI too old to take the setting would otherwise ask, and a request
// nobody answers is a run that hangs forever.
const MODE = 'yolo'

const SUBAGENT_TOOLS = new Set(['Agent', 'Task'])

const STARTED = new Set(['pending', 'in_progress'])

const kimiServers = (servers: Record<string, McpServer>): unknown[] =>
  acpServers(Object.fromEntries(Object.entries(servers).filter(([, server]) => 'url' in server)))

// A stop that is not the end of a turn has a reason, and these are the ones the
// protocol names rather than describes.
const STOPS: Record<string, string> = {
  refusal: 'Kimi declined to answer this one.',
  max_tokens: 'Kimi reached its token limit before it finished.',
  max_turn_requests: 'Kimi reached its limit of steps before it finished.'
}

// There is no flag to start a session on, so what a run is set to is said over
// the wire once the session exists, one setting at a time, before the turn
// starts. A turn sent alongside them would race the settings it is for.
export function kimiDialog(prompt: string, cwd: string, get: SettingReader, options: RunOptions = {}): Dialog {
  const model = get('model')
  const thinking = get('thinking')
  const config: Array<[string, string]> = [['mode', get('mode') || MODE]]
  if (model) config.push(['model', model])
  if (thinking === 'on' || thinking === 'off') config.push(['thinking', thinking])
  return acpDialog({ prompt, cwd, run: options, config, servers: kimiServers })
}

const outputText = (update: any): string => {
  const raw = update?.rawOutput
  if (typeof raw === 'string') return raw
  const list = Array.isArray(update?.content) ? update.content : []
  return list
    .map((part: any) => chunkText(part?.content))
    .filter(Boolean)
    .join('\n')
}

export function kimiParser(): RunParser {
  const { close, stream } = makeLanes()
  let sessionId = ''
  let read = 0
  const names = new Map<string, string>()
  const wire = kimiWire()

  const counted = (out: ParsedOutput[], force: boolean): void => {
    if (!sessionId) return
    const now = Date.now()
    if (!force && now - read < USAGE_MS) return
    read = now
    const text = wire(sessionId)
    const usage = text ? kimiUsage(text) : null
    if (usage) out.push({ usage })
  }

  // The name a tool started under is the one that says what it is. Every update
  // after the first carries a narrated title instead, "Reading math.js" where
  // the tool is Read, so the first one is kept and the rest are read for what
  // they add: the arguments, and what the tool printed.
  const activity = (out: ParsedOutput[], update: any): void => {
    const id = str(update?.toolCallId)
    if (!id) return
    const opening = str(update?.sessionUpdate) === 'tool_call'
    if (opening) names.set(id, str(update?.title))
    const name = names.get(id) ?? ''
    const args = update?.rawInput
    const running = STARTED.has(str(update?.status))
    // One tool beats out a dozen updates saying the same thing while its
    // arguments are still being written, and a step redrawn from one of those
    // is a step whose detail blinks out. Only what opens a step, fills it in,
    // or ends it is worth drawing again.
    if (!opening && !args && running) return
    close(out)
    out.push({
      activity: {
        id,
        kind: SUBAGENT_TOOLS.has(name) ? 'subagent' : 'tool',
        name,
        status: running ? 'started' : 'finished',
        detail: args ? activityDetail(args) : undefined,
        files: args ? fileChanges(name, args) : undefined,
        todos: args ? stepTodos(args) : undefined,
        task: args ? taskCall(name, args) : undefined,
        output: running ? undefined : outputText(update)
      }
    })
  }

  const update = (out: ParsedOutput[], params: any): void => {
    const body = params?.update ?? params
    const kind = str(body?.sessionUpdate)
    if (kind === 'agent_thought_chunk') return stream(out, 'thinking', chunkText(body?.content))
    if (kind === 'agent_message_chunk') return stream(out, 'text', chunkText(body?.content))
    if (kind === 'tool_call' || kind === 'tool_call_update') return activity(out, body)
    if (kind === 'plan') {
      const todos = stepTodos(body)
      if (todos) out.push({ activity: { id: 'plan', kind: 'tool', name: 'TodoWrite', status: 'finished', todos } })
    }
  }

  const parse = (line: string): ParsedOutput[] => {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return []
    }
    const out: ParsedOutput[] = []
    if (str(msg?.method) === 'session/update') {
      update(out, msg.params)
      counted(out, false)
      return out
    }
    if (msg?.error && msg.id !== undefined) {
      close(out)
      const text = str(msg.error?.message)
      if (text) out.push({ error: text })
      if (!sessionId) out.push({ turnEnd: true })
      return out
    }
    const opened = str(msg?.result?.sessionId)
    if (opened) sessionId = opened
    // Only the prompt answers with a stop reason, so it needs no id to be told
    // apart.
    const stop = str(msg?.result?.stopReason)
    if (stop) {
      close(out)
      if (STOPS[stop]) out.push({ error: STOPS[stop] })
      counted(out, true)
      if (stop !== CANCELLED) out.push({ turnEnd: true })
    }
    return out
  }

  // The last call of a turn is written to the log a moment after the turn says
  // it is over, so a run read only at that word is short by the whole of its
  // final answer. This is the read that catches it.
  const finish = (): ParsedOutput[] => {
    const out: ParsedOutput[] = []
    counted(out, true)
    return out
  }

  return { parse, finish }
}
