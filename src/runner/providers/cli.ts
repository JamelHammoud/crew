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
}

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
      let text = ''
      let errText = ''
      let buffer = ''
      let raw = ''
      let blocks = 0
      let rawOpen = false
      let killed = false
      let written = 0
      let reported = 0
      let sent = 0

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
          if (out.thinking) {
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
        }
        reportTokens()
      }

      child.stdout.on('data', data => {
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
            reject(new Error(errText.trim() || `${opts.label} exited with code ${code}`))
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
