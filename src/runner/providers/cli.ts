import { spawn } from 'node:child_process'
import { resolveSettings, type AgentSettingField, type AgentSettingOption } from '../../shared/llm'
import { crewPath, resolveCommand } from './path'
import type { OutputParser, Provider, RunningPrompt, RunProgress } from './types'

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
      let thinking = ''
      let reportedTokens = 0
      let sentTokens = 0
      let killed = false

      const emitProgress = (thinkingDelta?: string) => {
        if (!hooks.onProgress) return
        const estimate = Math.ceil((text.length + thinking.length) / 4)
        const tokens = Math.max(reportedTokens, estimate)
        if (!thinkingDelta && tokens === sentTokens) return
        sentTokens = tokens
        const progress: RunProgress = { tokens }
        if (thinkingDelta) progress.thinking = thinkingDelta
        hooks.onProgress(progress)
      }

      const handleLine = (line: string) => {
        if (!line.trim()) return
        raw += (raw ? '\n' : '') + line
        let thinkingDelta = ''
        for (const out of opts.parser!(line)) {
          if (out.text) {
            text += (text ? '\n' : '') + out.text
            hooks.onChunk(out.text)
          }
          if (out.activity) hooks.onActivity(out.activity)
          if (out.thinking) thinkingDelta += (thinkingDelta ? '\n' : '') + out.thinking
          if (typeof out.tokens === 'number') reportedTokens = Math.max(reportedTokens, out.tokens)
        }
        if (thinkingDelta) thinking += (thinking ? '\n' : '') + thinkingDelta
        emitProgress(thinkingDelta || undefined)
      }

      child.stdout.on('data', data => {
        const chunk = data.toString()
        if (!opts.parser) {
          text += chunk
          raw += chunk
          hooks.onChunk(chunk)
          emitProgress()
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
