import type { McpServer } from '../../shared/plugins'
import type { Dialog, ParsedOutput, RunOptions } from './types'

export const PROTOCOL = 1

// Crew never reads or writes a file on the agent's behalf. The CLI already runs
// in the project folder and does its own work everywhere else, so the two file
// capabilities are declined and the agent uses the hands it has.
export const CAPABILITIES = { fs: { readTextFile: false, writeTextFile: false }, terminal: false }

export const CANCELLED = 'cancelled'

export const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export const rpc = (body: Record<string, unknown>): string => JSON.stringify({ jsonrpc: '2.0', ...body })

export const promptInput = (text: string) => [{ type: 'text', text }]

export const chunkText = (content: any): string => (str(content?.type) === 'text' ? str(content.text) : '')

// Everything is allowed, the way it is on every other CLI here: an agent in a
// crew is already running with permissions bypassed. Nothing is rejected, and a
// request offering no way to say yes is cancelled rather than left unanswered,
// since a request nobody answers is a run that hangs forever.
export const allowed = (options: unknown): string => {
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

type Stage = 'init' | 'session' | 'config' | 'turn'

export interface AcpDialogOptions {
  prompt: string
  cwd: string
  run?: RunOptions
  servers?: (servers: Record<string, McpServer>) => unknown[]
  // Said over the wire once the session exists, one at a time, for a CLI whose
  // run is set up that way. A CLI that takes the same answers as flags passes
  // none, and the walk goes straight from the session to the turn.
  config?: Array<[string, string]>
}

export function acpDialog({ prompt, cwd, run = {}, config = [], servers = acpServers }: AcpDialogOptions): Dialog {
  const pending = new Map<number, Stage>()
  const settings = [...config]
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
    return ask('turn', 'session/prompt', { sessionId, prompt: promptInput(text) })
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
    if (stage === 'init') return [ask('session', 'session/new', { cwd, mcpServers: servers(run.mcp?.servers ?? {}) })]
    if (stage === 'session') {
      sessionId = str(result?.sessionId)
      return sessionId ? [step()] : []
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

export type Lane = 'thinking' | 'text'

// The words arrive as a plain run of chunks with no block number on them, so
// the lanes are counted here. A block is a stretch of one kind, and switching
// kind or reaching a tool closes the one that was open. Nothing reuses a
// number, because closing a block closes every kind standing at that index.
export function makeLanes(): {
  close: (out: ParsedOutput[]) => void
  stream: (out: ParsedOutput[], kind: Lane, text: string) => void
} {
  let lane = 0
  let open: Lane | null = null

  const close = (out: ParsedOutput[]): void => {
    if (open === null) return
    out.push({ blockStop: { index: lane } })
    open = null
  }

  const stream = (out: ParsedOutput[], kind: Lane, text: string): void => {
    if (!text) return
    if (open !== kind) {
      close(out)
      lane += 1
      out.push(kind === 'thinking' ? { thinkingStart: { index: lane } } : { textStart: { index: lane } })
      open = kind
    }
    out.push(kind === 'thinking' ? { thinkingDelta: { index: lane, text } } : { textDelta: { index: lane, text } })
  }

  return { close, stream }
}
