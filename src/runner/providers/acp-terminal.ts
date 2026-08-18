import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { commandInvocation, detachCliProcess } from './cli'

interface ExitStatus {
  exitCode: number | null
  signal: string | null
}

interface Terminal {
  child: ChildProcessWithoutNullStreams
  output: string
  bytes: number
  limit: number
  truncated: boolean
  exit: ExitStatus | null
  waiters: Array<(status: ExitStatus) => void>
  stdout: StringDecoder
  stderr: StringDecoder
}

type Send = (body: string) => void

const DEFAULT_OUTPUT_LIMIT = 4 * 1024 * 1024

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

const rpc = (body: Record<string, unknown>): string => JSON.stringify({ jsonrpc: '2.0', ...body })

const pairs = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!Array.isArray(raw)) return out
  for (const one of raw) {
    const name = str(one?.name)
    const value = str(one?.value)
    if (name) out[name] = value
  }
  return out
}

const argsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter(one => typeof one === 'string') : [])

const limitOf = (raw: unknown): number =>
  Number.isSafeInteger(raw) && Number(raw) >= 0 ? Number(raw) : DEFAULT_OUTPUT_LIMIT

const trim = (terminal: Terminal): void => {
  if (terminal.bytes <= terminal.limit) return
  let offset = 0
  let removed = 0
  const wanted = terminal.bytes - terminal.limit
  while (offset < terminal.output.length && removed < wanted) {
    const point = terminal.output.codePointAt(offset)
    if (point === undefined) break
    const character = String.fromCodePoint(point)
    offset += character.length
    removed += Buffer.byteLength(character)
  }
  terminal.output = terminal.output.slice(offset)
  terminal.bytes -= removed
  terminal.truncated = true
}

const append = (terminal: Terminal, text: string): void => {
  if (!text) return
  terminal.output += text
  terminal.bytes += Buffer.byteLength(text)
  trim(terminal)
}

const signal = (terminal: Terminal, name: NodeJS.Signals): void => {
  const pid = terminal.child.pid
  if (pid && detachCliProcess()) {
    try {
      process.kill(-pid, name)
      return
    } catch {}
  }
  terminal.child.kill(name)
}

const result = (id: unknown, body: unknown): string => rpc({ id, result: body })

const error = (id: unknown, message: string): string => rpc({ id, error: { code: -32602, message } })

export class AcpTerminalHost {
  private readonly terminals = new Map<string, Terminal>()
  private send: Send = () => {}

  constructor(private readonly cwd: string) {}

  connect(send: Send): void {
    this.send = send
  }

  serve(id: unknown, method: string, params: any): string | null {
    if (method === 'terminal/create') return this.create(id, params)
    const terminalId = str(params?.terminalId)
    const terminal = this.terminals.get(terminalId)
    if (!terminal) return error(id, `Terminal ${terminalId || 'unknown'} is not available.`)
    if (method === 'terminal/output') return result(id, this.output(terminal))
    if (method === 'terminal/wait_for_exit') {
      this.wait(id, terminal)
      return null
    }
    if (method === 'terminal/kill') {
      signal(terminal, 'SIGKILL')
      return result(id, {})
    }
    if (method === 'terminal/release') {
      if (!terminal.exit) signal(terminal, 'SIGKILL')
      this.terminals.delete(terminalId)
      return result(id, {})
    }
    return error(id, `Crew does not answer ${method}.`)
  }

  close(): void {
    for (const terminal of this.terminals.values()) {
      if (!terminal.exit) signal(terminal, 'SIGKILL')
    }
    this.terminals.clear()
  }

  private create(id: unknown, params: any): string {
    const command = str(params?.command)
    if (!command) return error(id, 'The terminal command is missing.')
    const invocation = commandInvocation(command, argsOf(params?.args))
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(invocation.command, invocation.args, {
        cwd: str(params?.cwd) || this.cwd,
        env: { ...process.env, ...pairs(params?.env) },
        detached: detachCliProcess(),
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (cause) {
      return error(id, cause instanceof Error ? cause.message : 'The terminal could not start.')
    }
    child.stdin.end()
    const terminalId = randomUUID()
    const terminal: Terminal = {
      child,
      output: '',
      bytes: 0,
      limit: limitOf(params?.outputByteLimit),
      truncated: false,
      exit: null,
      waiters: [],
      stdout: new StringDecoder('utf8'),
      stderr: new StringDecoder('utf8')
    }
    this.terminals.set(terminalId, terminal)
    child.stdout.on('data', data => append(terminal, terminal.stdout.write(data)))
    child.stderr.on('data', data => append(terminal, terminal.stderr.write(data)))
    child.on('error', cause => {
      append(terminal, cause.message)
      this.finish(terminal, { exitCode: 1, signal: null })
    })
    child.on('close', (code, name) => {
      append(terminal, terminal.stdout.end())
      append(terminal, terminal.stderr.end())
      this.finish(terminal, { exitCode: code, signal: name })
    })
    return result(id, { terminalId })
  }

  private output(terminal: Terminal): Record<string, unknown> {
    return {
      output: terminal.output,
      truncated: terminal.truncated,
      exitStatus: terminal.exit
    }
  }

  private wait(id: unknown, terminal: Terminal): void {
    if (terminal.exit) {
      this.send(result(id, terminal.exit))
      return
    }
    terminal.waiters.push(status => this.send(result(id, status)))
  }

  private finish(terminal: Terminal, status: ExitStatus): void {
    if (terminal.exit) return
    terminal.exit = status
    for (const waiter of terminal.waiters.splice(0)) waiter(status)
  }
}
