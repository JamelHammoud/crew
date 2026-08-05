import type { McpServer } from '../../shared/plugins'
import type { SettingReader } from './cli'
import { activityDetail, fileChanges, stepTodos } from './detail'
import { kimiUsage, kimiWire } from './kimi-usage'
import { taskCall } from './tasks'
import type { Dialog, ParsedOutput, RunOptions, RunParser } from './types'

const PROTOCOL = 1

const USAGE_MS = 1500

// Crew never reads or writes a file on the agent's behalf. The CLI already runs
// in the project folder and does its own work everywhere else, so the two file
// capabilities are declined and the agent uses the hands it has.
const CAPABILITIES = { fs: { readTextFile: false, writeTextFile: false }, terminal: false }

// Everything is approved before the turn starts, which is the posture every
// other CLI here runs under. The permission requests below are still answered,
// because a CLI too old to take the setting would otherwise ask, and a request
// nobody answers is a run that hangs forever.
const MODE = 'yolo'

const SUBAGENT_TOOLS = new Set(['Agent', 'Task'])

const STARTED = new Set(['pending', 'in_progress'])

const CANCELLED = 'cancelled'

// A stop that is not the end of a turn has a reason, and these are the ones the
// protocol names rather than describes.
const STOPS: Record<string, string> = {
  refusal: 'Kimi declined to answer this one.',
  max_tokens: 'Kimi reached its token limit before it finished.',
  max_turn_requests: 'Kimi reached its limit of steps before it finished.'
}

type Stage = 'init' | 'session' | 'config' | 'turn'

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const rpc = (body: Record<string, unknown>): string => JSON.stringify({ jsonrpc: '2.0', ...body })

const input = (text: string) => [{ type: 'text', text }]

// Everything is allowed, the way it is on every other CLI here: an agent in a
// crew is already running with permissions bypassed. Nothing is rejected, and a
// request offering no way to say yes is cancelled rather than left unanswered,
// since a request nobody answers is a run that hangs forever.
const allowed = (options: unknown): string => {
  const list = Array.isArray(options) ? options : []
  const kind = (option: any): string => str(option?.kind)
  const pick =
    list.find(option => kind(option) === 'allow_always') ??
    list.find(option => kind(option) === 'allow_once') ??
    list.find(option => !kind(option).startsWith('reject'))
  return str((pick as any)?.optionId)
}

export const acpServers = (servers: Record<string, McpServer> = {}): unknown[] =>
  Object.entries(servers).map(([name, server]) =>
    'url' in server
      ? { name, type: 'http', url: server.url, headers: [] }
      : {
          name,
          command: server.command,
          args: server.args ?? [],
          env: Object.entries(server.env ?? {}).map(([key, value]) => ({ name: key, value }))
        }
  )

export function kimiDialog(prompt: string, cwd: string, get: SettingReader, options: RunOptions = {}): Dialog {
  const model = get('model')
  const pending = new Map<number, Stage>()
  // There is no flag to start a session on, so what a run is set to is said
  // over the wire once the session exists, one setting at a time, before the
  // turn starts. A turn sent alongside them would race the settings it is for.
  const settings: Array<[string, string]> = []
  const steers: string[] = []
  let next = 0
  let sessionId = ''
  let turning = false

  const ask = (stage: Stage, method: string, params: unknown): string => {
    const id = ++next
    pending.set(id, stage)
    return rpc({ id, method, params })
  }

  const turn = (text: string): string => {
    turning = true
    return ask('turn', 'session/prompt', { sessionId, prompt: input(text) })
  }

  const step = (): string => {
    const setting = settings.shift()
    if (!setting) return turn(prompt)
    const [configId, value] = setting
    return ask('config', 'session/set_config_option', { sessionId, configId, value })
  }

  const resume = (): string[] => {
    turning = false
    if (!steers.length) return []
    return [turn(steers.splice(0).join('\n'))]
  }

  const answered = (stage: Stage, result: any): string[] => {
    if (stage === 'init') return [ask('session', 'session/new', { cwd, mcpServers: [] })]
    if (stage === 'session') {
      sessionId = str(result?.sessionId)
      if (!sessionId) return []
      settings.push(['mode', MODE])
      if (model) settings.push(['model', model])
      return [step()]
    }
    if (stage === 'config') return [step()]
    return resume()
  }

  const served = (id: unknown, method: string, params: any): string[] => {
    if (method === 'session/request_permission') {
      const optionId = allowed(params?.options)
      const outcome = optionId ? { outcome: 'selected', optionId } : { outcome: 'cancelled' }
      return [rpc({ id, result: { outcome } })]
    }
    return [rpc({ id, error: { code: -32601, message: `Crew does not answer ${method}.` } })]
  }

  return {
    begin: () => [ask('init', 'initialize', { protocolVersion: PROTOCOL, clientCapabilities: CAPABILITIES })],
    answer: line => {
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        return []
      }
      if (typeof msg?.method === 'string') {
        if (msg.id !== undefined && msg.id !== null) return served(msg.id, msg.method, msg.params)
        return []
      }
      const stage = typeof msg?.id === 'number' ? pending.get(msg.id) : undefined
      if (!stage) return []
      pending.delete(msg.id)
      // A setting the CLI will not take is not worth stalling a run over. A
      // model that has left the config and a CLI too old to be told either way
      // carry on to the turn, which runs on whatever it was already set to.
      if (msg.error) {
        if (stage === 'config') return [step()]
        return stage === 'turn' ? resume() : []
      }
      return answered(stage, msg.result)
    },
    steer: text => {
      if (!sessionId || !turning) return null
      steers.push(text)
      return rpc({ method: 'session/cancel', params: { sessionId } })
    }
  }
}

const chunkText = (content: any): string => (str(content?.type) === 'text' ? str(content.text) : '')

const outputText = (update: any): string => {
  const raw = update?.rawOutput
  if (typeof raw === 'string') return raw
  const list = Array.isArray(update?.content) ? update.content : []
  return list
    .map((part: any) => chunkText(part?.content))
    .filter(Boolean)
    .join('\n')
}

// The words arrive as a plain run of chunks with no block number on them, so
// the lanes are counted here. A block is a stretch of one kind, and switching
// kind or reaching a tool closes the one that was open. Nothing reuses a
// number, because closing a block closes every kind standing at that index.
export function kimiParser(): RunParser {
  let lane = 0
  let open: 'thinking' | 'text' | null = null
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

  const close = (out: ParsedOutput[]): void => {
    if (open === null) return
    out.push({ blockStop: { index: lane } })
    open = null
  }

  const stream = (out: ParsedOutput[], kind: 'thinking' | 'text', text: string): void => {
    if (!text) return
    if (open !== kind) {
      close(out)
      lane += 1
      out.push(kind === 'thinking' ? { thinkingStart: { index: lane } } : { textStart: { index: lane } })
      open = kind
    }
    out.push(
      kind === 'thinking' ? { thinkingDelta: { index: lane, text } } : { textDelta: { index: lane, text } }
    )
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
