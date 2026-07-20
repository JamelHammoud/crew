import { spawn } from 'node:child_process'
import { resolveSettings, type AgentSettingField, type AgentSettingOption } from '../../shared/llm'
import { crewPath, resolveCommand } from './path'
import type { OutputParser, Provider, RunningPrompt } from './types'

export function commandExists(command: string): boolean {
  return resolveCommand(command) !== null
}

export type SettingReader = (key: string) => string

export function flag(name: string, value: string): string[] {
  return value ? [name, value] : []
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
}

// A run is killed only after this long with no output at all. Reasoning models
// can sit quiet for minutes, so this guards against hangs, not slowness.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000
// Grace period before escalating to SIGKILL for a process ignoring SIGTERM.
const KILL_GRACE_MS = 5000

export function makeCliProvider(opts: CliProviderOptions): Provider {
  const fields = () => opts.fields?.() ?? []
  return {
    name: opts.name,
    label: opts.label,
    fields,
    detect: async () => commandExists(opts.command),
    start: (prompt, cwd, hooks, settings = {}): RunningPrompt => {
      const resolved = resolveSettings(fields(), settings)
      const child = spawn(resolveCommand(opts.command) ?? opts.command, opts.args(prompt, key => resolved[key] ?? ''), {
        cwd,
        env: { ...process.env, PATH: crewPath(), ...opts.env }
      })
      // Codex reads stdin to EOF even when the prompt is an argument, so an open
      // pipe hangs the process before it ever contacts the model.
      child.stdin?.end()
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

      const clearTimers = () => {
        if (idleTimer) clearTimeout(idleTimer)
        if (killTimer) clearTimeout(killTimer)
        idleTimer = killTimer = null
      }

      // SIGTERM first, but a wedged process can ignore it and leave the thread
      // queue blocked forever, so escalate to SIGKILL.
      const terminate = () => {
        child.kill('SIGTERM')
        killTimer = setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS)
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
              status: out.activity.status === 'started' ? 'running' : 'done'
            })
          }
          if (typeof out.tokens === 'number') reported = Math.max(reported, out.tokens)
          if (out.error) parsedError = out.error
        }
        reportTokens()
      }

      child.stdout.on('data', data => {
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
      child.stderr.on('data', data => {
        bump()
        errText += data.toString()
      })

      const done = new Promise<{ text: string }>((resolve, reject) => {
        child.on('error', reject)
        child.on('close', code => {
          if (buffer.trim()) handleLine(buffer)
          if (rawOpen) hooks.onStep({ id: 'b0', kind: 'text', status: 'done' })
          if (killed) {
            reject(new Error('Stopped'))
          } else if (code === 0) {
            resolve({ text: text.trim() || raw.trim() })
          } else {
            reject(new Error(parsedError.trim() || errText.trim() || `${opts.label} exited with code ${code}`))
          }
        })
      })

      return {
        done,
        kill: () => {
          killed = true
          child.kill('SIGTERM')
        }
      }
    }
  }
}
