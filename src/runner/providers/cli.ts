import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { goalBrief, goalCondition } from '../../shared/goal'
import {
  resolveSettings,
  type AgentSettingField,
  type AgentSettingOption,
  type AgentSettings,
  type AgentUsage
} from '../../shared/llm'
import { exitReason, failureText } from './failure'
import { crewPath, resolveCommand } from './path'
import { makeSink } from './run'
import type {
  Dialog,
  InstallCommands,
  McpHandover,
  OutputParser,
  ParsedOutput,
  Provider,
  RunOptions,
  RunParser,
  RunningPrompt
} from './types'

export function commandExists(command: string, dirs?: string[]): boolean {
  return resolveCommand(command, dirs) !== null
}

export function spawnFailure(error: NodeJS.ErrnoException, cwd: string): Error {
  if (error.code === 'ENOENT' && !existsSync(cwd)) {
    return new Error('This project folder is no longer on this computer.')
  }
  return error
}

export type SettingReader = (key: string) => string

export function flag(name: string, value: string): string[] {
  return value ? [name, value] : []
}

export interface CommandInvocation {
  command: string
  args: string[]
}

export function detachCliProcess(platform = process.platform): boolean {
  return platform !== 'win32'
}

export function commandInvocation(
  command: string,
  args: string[],
  platform = process.platform,
  hasFile: (path: string) => boolean = existsSync
): CommandInvocation {
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(command)) return { command, args }
  const script = command.replace(/\.(cmd|bat)$/i, '.ps1')
  if (!hasFile(script)) return { command, args }
  const root = process.env.SystemRoot ?? 'C:\\Windows'
  return {
    command: join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...args]
  }
}

export function choices(values: string[]): AgentSettingOption[] {
  return values.map(value => ({ value, label: value || 'Default' }))
}

interface CliProviderOptions {
  name: string
  label: string
  command: string
  install?: InstallCommands
  fields?: () => AgentSettingField[]
  args: (prompt: string, get: SettingReader, run: RunOptions) => string[]
  parser?: OutputParser
  // A parser that has to remember where it is in a run gets one of its own. A
  // module-level function is shared by every run at once, so a second agent
  // starting would take the first one's place in the stream.
  makeParser?: () => RunParser
  env?: NodeJS.ProcessEnv | ((get: SettingReader) => NodeJS.ProcessEnv)
  idleTimeoutMs?: number
  stdinPrompt?: boolean
  // When set, the prompt is written to stdin as a message the dialog decides the
  // shape of, and stdin stays open so later messages can steer the run.
  dialog?: (prompt: string, cwd: string, get: SettingReader, run: RunOptions) => Dialog
  goalCommand?: boolean
  steerable?: boolean
  mcp?: McpHandover
  usage?: (settings: AgentSettings) => Promise<AgentUsage | null>
  discover?: () => Promise<unknown>
}

// A run is killed only after this long with no output at all. Reasoning models
// can sit quiet for minutes, so this guards against hangs, not slowness.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
// Grace period before escalating to SIGKILL for a process ignoring SIGTERM.
const KILL_GRACE_MS = 5000
const EXIT_FLUSH_MS = 1500
// In streaming-input mode the CLI ends a turn but keeps running, waiting for
// more stdin. We wait this long after a turn ends before closing stdin, so a
// steer already in flight over the socket still lands in the same run.
const TURN_END_GRACE_MS = 750
const RAW_LIMIT = 20000

export function makeCliProvider(opts: CliProviderOptions): Provider {
  const fields = () => opts.fields?.() ?? []
  return {
    name: opts.name,
    label: opts.label,
    install: opts.install,
    steerable: opts.steerable ?? opts.dialog !== undefined,
    mcp: opts.mcp,
    fields,
    detect: async () => {
      const installed = commandExists(opts.command)
      if (installed) {
        try {
          await opts.discover?.()
        } catch {}
      }
      return installed
    },
    usage: opts.usage ? settings => opts.usage!(resolveSettings(fields(), settings ?? {})) : undefined,
    start: (prompt, cwd, hooks, settings = {}, options = {}): RunningPrompt => {
      const resolved = resolveSettings(fields(), settings)
      const read: SettingReader = key => resolved[key] ?? ''
      const condition = options.goal ? goalCondition(options.goal) : ''
      const run: RunOptions = { ...options, goal: condition || undefined }
      const said = opts.goalCommand && opts.dialog !== undefined
      const body = condition && !said ? `${goalBrief(condition)}\n\n${prompt}` : prompt
      const dialog = opts.dialog?.(body, cwd, read, run)
      const made = opts.makeParser?.()
      const parse = made?.parse ?? opts.parser
      const invocation = commandInvocation(resolveCommand(opts.command) ?? opts.command, opts.args(body, read, run))
      const child = spawn(invocation.command, invocation.args, {
        cwd,
        env: {
          ...process.env,
          PATH: crewPath(),
          ...(typeof opts.env === 'function' ? opts.env(read) : opts.env),
          ...run.mcp?.env
        },
        detached: detachCliProcess(),
        stdio: [opts.stdinPrompt || dialog ? 'pipe' : 'ignore', 'pipe', 'pipe']
      })
      const stdout = child.stdout
      const stderr = child.stderr
      if (!stdout || !stderr) throw new Error(`${opts.label} could not open its output streams.`)
      const sink = makeSink(cwd, hooks)
      let errText = ''
      let buffer = ''
      let raw = ''
      let killed = false
      let timedOut = false
      let parsedError = ''

      const idleMs = opts.idleTimeoutMs ?? IDLE_TIMEOUT_MS
      let idleTimer: NodeJS.Timeout | null = null
      let killTimer: NodeJS.Timeout | null = null
      let turnTimer: NodeJS.Timeout | null = null
      let inputClosed = false
      let reopened = false

      const clearTimers = () => {
        if (idleTimer) clearTimeout(idleTimer)
        if (killTimer) clearTimeout(killTimer)
        if (turnTimer) clearTimeout(turnTimer)
        idleTimer = killTimer = turnTimer = null
      }

      // A CLI that exits while a message is being written breaks the pipe. That
      // arrives as a stream error, which is fatal to the process if unhandled;
      // the run's own exit path already reports what went wrong.
      child.stdin?.on('error', () => {})

      // Closing stdin is what tells a streaming-input CLI the conversation is
      // over; it exits and `close` resolves the run.
      const endInput = () => {
        if (inputClosed) return
        inputClosed = true
        child.stdin?.end()
      }

      const write = (body: string): boolean => {
        if (inputClosed || killed || timedOut || !child.stdin?.writable) return false
        if (turnTimer) {
          clearTimeout(turnTimer)
          turnTimer = null
        }
        child.stdin.write(body + '\n')
        return true
      }

      // A turn ended with nothing more queued, so let the process wind down —
      // unless a steer arrives inside the grace window and reopens the run.
      const onTurnEnd = () => {
        if (turnTimer) clearTimeout(turnTimer)
        turnTimer = setTimeout(endInput, TURN_END_GRACE_MS)
        turnTimer.unref()
      }

      const signalTree = (sig: NodeJS.Signals) => {
        if (child.pid) {
          try {
            process.kill(-child.pid, sig)
            return
          } catch {}
        }
        child.kill(sig)
      }

      // SIGTERM first, but a wedged process can ignore it and leave the thread
      // queue blocked forever, so escalate to SIGKILL.
      const terminate = () => {
        dialog?.close?.()
        signalTree('SIGTERM')
        killTimer = setTimeout(() => signalTree('SIGKILL'), KILL_GRACE_MS)
        killTimer.unref()
      }

      // Any byte of output means the process is alive; restart the clock.
      const bump = () => {
        if (idleTimer) clearTimeout(idleTimer)
        if (killed || timedOut) return
        idleTimer = setTimeout(() => {
          timedOut = true
          terminate()
        }, idleMs)
        idleTimer.unref()
      }

      // How a run ended and whether the process may wind down are the
      // transport's, so they stay here while the steps go to the sink.
      const feed = (out: ParsedOutput) => {
        sink.apply(out)
        if (out.error) parsedError = out.error
        if (out.turnEnd && dialog && !reopened) onTurnEnd()
      }

      const handleLine = (line: string) => {
        if (!line.trim()) return
        if (raw.length < RAW_LIMIT) raw += (raw ? '\n' : '') + line
        reopened = false
        if (dialog) for (const body of dialog.answer(line)) reopened = write(body) || reopened
        for (const out of parse!(line)) feed(out)
        sink.report()
        reopened = false
      }

      // A CLI that writes what a turn cost just after it says the turn is over
      // has nothing left to arrive on, so the parser is asked once more when
      // the process has gone and there are no more lines coming.
      const finish = () => {
        for (const out of made?.finish?.() ?? []) feed(out)
        sink.report()
      }

      stdout.on('data', data => {
        bump()
        const chunk = data.toString()
        if (!parse) {
          raw += chunk
          sink.raw(chunk)
          sink.report()
          return
        }
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) handleLine(line)
      })
      stderr.on('data', data => {
        bump()
        errText += data.toString()
      })

      const done = new Promise<{ text: string }>((resolve, reject) => {
        let settled = false
        let exitTimer: NodeJS.Timeout | null = null
        const settle = (code: number | null, signal: NodeJS.Signals | null) => {
          if (settled) return
          settled = true
          clearTimers()
          dialog?.close?.()
          if (exitTimer) clearTimeout(exitTimer)
          if (buffer.trim()) handleLine(buffer)
          buffer = ''
          finish()
          sink.close()
          // What the run itself said comes first, then what it printed on the
          // way out, and only a run that said nothing at all is described.
          const said = () => parsedError.trim() || failureText(errText)
          if (killed) {
            reject(new Error('Stopped'))
          } else if (timedOut) {
            const mins = Math.round(idleMs / 60000)
            reject(new Error(said() || `${opts.label} sent no output for ${mins}m and was stopped.`))
          } else if (code === 0) {
            const result = sink.answer() || raw.trim()
            if (!result && said()) reject(new Error(said()))
            else resolve({ text: result })
          } else {
            reject(new Error(said() || exitReason(opts.label, code, signal)))
          }
        }
        child.on('error', err => {
          if (settled) return
          settled = true
          clearTimers()
          dialog?.close?.()
          if (exitTimer) clearTimeout(exitTimer)
          reject(spawnFailure(err, cwd))
        })
        child.on('close', (code, signal) => settle(code, signal))
        child.on('exit', (code, signal) => {
          exitTimer = setTimeout(() => settle(code, signal), EXIT_FLUSH_MS)
          exitTimer.unref()
        })
      })

      if (dialog) {
        dialog.connect?.(body => {
          write(body)
        })
        for (const body of dialog.begin()) write(body)
      } else if (opts.stdinPrompt) {
        child.stdin?.end(body)
      }

      // Start the clock at spawn: a process that hangs before its first byte
      // (as codex did on stdin) is the case this exists for.
      bump()

      return {
        done,
        kill: () => {
          killed = true
          clearTimers()
          terminate()
        },
        steer: dialog
          ? (body: string) => {
              const line = dialog.steer(body)
              return line !== null && write(line)
            }
          : undefined
      }
    }
  }
}
