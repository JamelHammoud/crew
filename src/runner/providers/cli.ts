import { spawn, spawnSync } from 'node:child_process'
import type { OutputParser, Provider, RunningPrompt } from './types'

export function commandExists(command: string): boolean {
  return spawnSync('which', [command], { stdio: 'ignore' }).status === 0
}

interface CliProviderOptions {
  name: string
  label: string
  command: string
  args: (prompt: string) => string[]
  parser?: OutputParser
  env?: NodeJS.ProcessEnv
}

export function makeCliProvider(opts: CliProviderOptions): Provider {
  return {
    name: opts.name,
    label: opts.label,
    detect: async () => commandExists(opts.command),
    start: (prompt, cwd, hooks): RunningPrompt => {
      const child = spawn(opts.command, opts.args(prompt), {
        cwd,
        env: { ...process.env, ...opts.env }
      })
      let text = ''
      let errText = ''
      let buffer = ''
      let raw = ''
      let killed = false

      const handleLine = (line: string) => {
        if (!line.trim()) return
        raw += (raw ? '\n' : '') + line
        for (const out of opts.parser!(line)) {
          if (out.text) {
            text += (text ? '\n' : '') + out.text
            hooks.onChunk(out.text)
          }
          if (out.activity) hooks.onActivity(out.activity)
        }
      }

      child.stdout.on('data', data => {
        const chunk = data.toString()
        if (!opts.parser) {
          text += chunk
          raw += chunk
          hooks.onChunk(chunk)
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
