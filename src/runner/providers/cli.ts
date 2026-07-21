import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSettings, type AgentSettingField, type AgentSettingOption, type AgentUsage } from '../../shared/llm'
import { crewPath, resolveCommand } from './path'
import type { OutputParser, Provider, RunningPrompt } from './types'

export function commandExists(command: string): boolean {
  return resolveCommand(command) !== null
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
  fields?: () => AgentSettingField[]
  args: (prompt: string, get: SettingReader) => string[]
  parser?: OutputParser
  env?: NodeJS.ProcessEnv
  idleTimeoutMs?: number
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
        stdio: [opts.streamInput ? 'pipe' : 'ignore', 'pipe', 'pipe']
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
      const thinkingBlocks = new Map<number, string>()
      let streamedThinking = false

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

      const handleLine = (line: string) => {
        if (!line.trim()) return
        raw += (raw ? '\n' : '') + line
        for (const out of opts.parser!(line)) {
          if (out.thinkingStart) {
            thinkingBlocks.set(out.thinkingStart.index, `b${blocks++}`)
          }
          if (out.thinkingDelta) {
            let id = thinkingBlocks.get(out.thinkingDelta.index)
            if (!id) {
              id = `b${blocks++}`
              thinkingBlocks.set(out.thinkingDelta.index, id)
            }
            streamedThinking = true
            written += out.thinkingDelta.text.length
            hooks.onStep({ id, kind: 'thinking', text: out.thinkingDelta.text, status: 'running' })
          }
          if (out.thinkingStop) {
            const id = thinkingBlocks.get(out.thinkingStop.index)
            if (id) {
              thinkingBlocks.delete(out.thinkingStop.index)
              hooks.onStep({ id, kind: 'thinking', status: 'done' })
            }
          }
          if (out.thinking && !streamedThinking) {
            written += out.thinking.length
            hooks.onStep({ id: `b${blocks++}`, kind: 'thinking', text: out.thinking, status: 'done' })
          }
          if (out.text) {
            text += (text ? '\n' : '') + out.text
            written += out.text.length
            hooks.onStep({ id: `b${blocks++}`, kind: 'text', text: out.text, status: 'done' })
          }
          if (out.activity) {
            hooks.onStep({
              id: `t${out.activity.id}`,
              kind: out.activity.kind,
              name: out.activity.name,
              detail: out.activity.detail,
              files: out.activity.files?.map(file => ({
                ...file,
                path: file.path.startsWith(`${cwd}/`) ? file.path.slice(cwd.length + 1) : file.path
              })),
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
        const settle = (code: number | null) => {
          if (settled) return
          settled = true
          clearTimers()
          if (exitTimer) clearTimeout(exitTimer)
          if (buffer.trim()) handleLine(buffer)
          buffer = ''
          if (rawOpen) hooks.onStep({ id: 'b0', kind: 'text', status: 'done' })
          if (killed) {
            reject(new Error('Stopped'))
          } else if (timedOut) {
            const mins = Math.round(idleMs / 60000)
            reject(new Error(parsedError.trim() || errText.trim() || `${opts.label} sent no output for ${mins}m and was stopped.`))
          } else if (code === 0) {
            const result = text.trim() || raw.trim()
            if (!result && errText.trim()) reject(new Error(errText.trim()))
            else resolve({ text: result })
          } else {
            reject(new Error(parsedError.trim() || errText.trim() || `${opts.label} exited with code ${code}`))
          }
        }
        child.on('error', err => {
          if (settled) return
          settled = true
          clearTimers()
          if (exitTimer) clearTimeout(exitTimer)
          reject(err)
        })
        child.on('close', code => settle(code))
        child.on('exit', code => {
          exitTimer = setTimeout(() => settle(code), EXIT_FLUSH_MS)
          exitTimer.unref()
        })
      })

      if (opts.streamInput) {
        writeMessage(prompt)
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
