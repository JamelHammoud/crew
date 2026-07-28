import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { stripRoot, stripRootFromText } from '../../shared/files'
import { isShellTool } from '../../shared/tools'
import { resolveSettings, type AgentSettingField, type AgentSettingOption, type AgentUsage } from '../../shared/llm'
import { exitReason, failureText } from './failure'
import { crewPath, resolveCommand } from './path'
import type { InstallCommands, OutputParser, Provider, RunningPrompt } from './types'

export function commandExists(command: string, dirs?: string[]): boolean {
  return resolveCommand(command, dirs) !== null
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
  args: (prompt: string, get: SettingReader) => string[]
  parser?: OutputParser
  env?: NodeJS.ProcessEnv
  idleTimeoutMs?: number
  stdinPrompt?: boolean
  // When set, the prompt is written to stdin as a JSON message instead of being
  // passed in argv, and stdin stays open so later messages can steer the run.
  streamInput?: boolean
  usage?: () => Promise<AgentUsage | null>
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

export function makeCliProvider(opts: CliProviderOptions): Provider {
  const fields = () => opts.fields?.() ?? []
  return {
    name: opts.name,
    label: opts.label,
    install: opts.install,
    steerable: opts.streamInput === true,
    fields,
    detect: async () => commandExists(opts.command),
    usage: opts.usage,
    start: (prompt, cwd, hooks, settings = {}): RunningPrompt => {
      const resolved = resolveSettings(fields(), settings)
      const invocation = commandInvocation(
        resolveCommand(opts.command) ?? opts.command,
        opts.args(prompt, key => resolved[key] ?? '')
      )
      const child = spawn(invocation.command, invocation.args, {
        cwd,
        env: { ...process.env, PATH: crewPath(), ...opts.env },
        detached: detachCliProcess(),
        stdio: [opts.stdinPrompt || opts.streamInput ? 'pipe' : 'ignore', 'pipe', 'pipe']
      })
      const stdout = child.stdout
      const stderr = child.stderr
      if (!stdout || !stderr) throw new Error(`${opts.label} could not open its output streams.`)
      let text = ''
      let errText = ''
      let buffer = ''
      let raw = ''
      let blocks = 0
      let rawOpen = false
      let killed = false
      let timedOut = false
      let parsedError = ''
      let written = 0
      let reported = 0
      let sent = 0
      const streams = {
        thinking: { ids: new Map<number, string>(), open: new Set<string>(), streamed: false },
        text: { ids: new Map<number, string>(), open: new Set<string>(), streamed: false }
      }
      const toolNames = new Map<string, string>()

      const idleMs = opts.idleTimeoutMs ?? IDLE_TIMEOUT_MS
      let idleTimer: NodeJS.Timeout | null = null
      let killTimer: NodeJS.Timeout | null = null
      let turnTimer: NodeJS.Timeout | null = null
      let inputClosed = false

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

      const writeMessage = (body: string): boolean => {
        if (inputClosed || killed || timedOut || !child.stdin?.writable) return false
        if (turnTimer) {
          clearTimeout(turnTimer)
          turnTimer = null
        }
        child.stdin.write(
          JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: body }] } }) + '\n'
        )
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

      const reportTokens = () => {
        if (!hooks.onTokens) return
        const tokens = Math.max(reported, Math.ceil(written / 4))
        if (tokens === sent) return
        sent = tokens
        hooks.onTokens(tokens)
      }

      const openBlock = (kind: 'thinking' | 'text', index: number) => {
        streams[kind].ids.set(index, `b${blocks++}`)
      }

      const streamBlock = (kind: 'thinking' | 'text', index: number, chunk: string) => {
        const stream = streams[kind]
        let id = stream.ids.get(index)
        if (!id) {
          id = `b${blocks++}`
          stream.ids.set(index, id)
        }
        if (kind === 'text') text += (text && !stream.open.has(id) ? '\n' : '') + chunk
        stream.streamed = true
        stream.open.add(id)
        written += chunk.length
        hooks.onStep({ id, kind, text: chunk, status: 'running' })
      }

      const closeBlock = (index: number) => {
        for (const kind of ['thinking', 'text'] as const) {
          const stream = streams[kind]
          const id = stream.ids.get(index)
          if (!id) continue
          stream.ids.delete(index)
          if (stream.open.delete(id)) hooks.onStep({ id, kind, status: 'done' })
        }
      }

      const handleLine = (line: string) => {
        if (!line.trim()) return
        raw += (raw ? '\n' : '') + line
        for (const out of opts.parser!(line)) {
          if (out.thinkingStart) openBlock('thinking', out.thinkingStart.index)
          if (out.textStart) openBlock('text', out.textStart.index)
          // A model that is asked not to show its reasoning still sends the
          // blocks, with an empty string where the words would be. Those are
          // not steps: a run that thinks in silence should look like it is
          // working, not open an empty card. Waiting for text is also what
          // leaves the complete block at the end of the message free to stand
          // in, on a CLI that only ever sends it that way.
          if (out.thinkingDelta?.text) streamBlock('thinking', out.thinkingDelta.index, out.thinkingDelta.text)
          if (out.textDelta?.text) streamBlock('text', out.textDelta.index, out.textDelta.text)
          if (out.blockStop) closeBlock(out.blockStop.index)
          if (out.thinking && !streams.thinking.streamed) {
            written += out.thinking.length
            hooks.onStep({ id: `b${blocks++}`, kind: 'thinking', text: out.thinking, status: 'done' })
          }
          if (out.text && !streams.text.streamed) {
            text += (text ? '\n' : '') + out.text
            written += out.text.length
            hooks.onStep({ id: `b${blocks++}`, kind: 'text', text: out.text, status: 'done' })
          }
          if (out.activity) {
            // Most tools hand back their whole result, and a file read or a
            // search would fill the log the whole crew syncs. Only a command
            // keeps what it printed, and the name it started under is what
            // says so, since the result arrives unnamed.
            const name = out.activity.name || toolNames.get(out.activity.id) || ''
            if (out.activity.name) toolNames.set(out.activity.id, out.activity.name)
            const output = isShellTool(name) ? out.activity.output : undefined
            hooks.onStep({
              id: `t${out.activity.id}`,
              kind: out.activity.kind,
              name: out.activity.name,
              detail: out.activity.detail ? stripRootFromText(cwd, out.activity.detail) : undefined,
              output: output ? stripRootFromText(cwd, output) : undefined,
              files: out.activity.files?.map(file => ({ ...file, path: stripRoot(cwd, file.path) })),
              status: out.activity.status === 'started' ? 'running' : 'done'
            })
          }
          if (typeof out.tokens === 'number') reported = Math.max(reported, out.tokens)
          if (out.error) parsedError = out.error
          if (out.turnEnd && opts.streamInput) onTurnEnd()
        }
        reportTokens()
      }

      stdout.on('data', data => {
        bump()
        const chunk = data.toString()
        if (!opts.parser) {
          text += chunk
          raw += chunk
          written += chunk.length
          rawOpen = true
          hooks.onStep({ id: 'b0', kind: 'text', text: chunk, status: 'running' })
          reportTokens()
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
          if (exitTimer) clearTimeout(exitTimer)
          if (buffer.trim()) handleLine(buffer)
          buffer = ''
          if (rawOpen) hooks.onStep({ id: 'b0', kind: 'text', status: 'done' })
          // What the run itself said comes first, then what it printed on the
          // way out, and only a run that said nothing at all is described.
          const said = () => parsedError.trim() || failureText(errText)
          if (killed) {
            reject(new Error('Stopped'))
          } else if (timedOut) {
            const mins = Math.round(idleMs / 60000)
            reject(new Error(said() || `${opts.label} sent no output for ${mins}m and was stopped.`))
          } else if (code === 0) {
            const result = text.trim() || raw.trim()
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
          if (exitTimer) clearTimeout(exitTimer)
          reject(err)
        })
        child.on('close', (code, signal) => settle(code, signal))
        child.on('exit', (code, signal) => {
          exitTimer = setTimeout(() => settle(code, signal), EXIT_FLUSH_MS)
          exitTimer.unref()
        })
      })

      if (opts.streamInput) {
        writeMessage(prompt)
      } else if (opts.stdinPrompt) {
        child.stdin?.end(prompt)
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
        steer: opts.streamInput ? (body: string) => writeMessage(body) : undefined
      }
    }
  }
}
