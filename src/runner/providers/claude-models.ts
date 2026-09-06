import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgentSettingOption } from '../../shared/llm'
import { commandInvocation } from './cli'
import { resolveCommand } from './path'

interface ClaudeRefreshOptions {
  command?: string
  args?: string[]
  home?: string
  timeoutMs?: number
}

const live = new Map<string, AgentSettingOption[]>()

const optionFrom = (value: unknown): AgentSettingOption | null => {
  if (typeof value === 'string' && value) return { value, label: value }
  if (!value || typeof value !== 'object') return null
  const entry = value as { value?: unknown; model?: unknown; label?: unknown; name?: unknown; disabled?: unknown }
  if (entry.disabled === true) return null
  const model = typeof entry.value === 'string' ? entry.value : typeof entry.model === 'string' ? entry.model : ''
  if (!model) return null
  const label = typeof entry.label === 'string' ? entry.label : typeof entry.name === 'string' ? entry.name : model
  return { value: model, label }
}

const unique = (groups: AgentSettingOption[][]): AgentSettingOption[] => {
  const seen = new Set<string>()
  return groups.flat().filter(option => {
    if (seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
}

const readJson = (path: string): any => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const configured = (home: string): AgentSettingOption[] => {
  const state = readJson(join(home, '.claude.json'))
  const settings = readJson(join(home, '.claude', 'settings.json'))
  const values = [
    ...(Array.isArray(settings?.modelPicker) ? settings.modelPicker : []),
    ...(Array.isArray(settings?.availableModels) ? settings.availableModels : []),
    ...(Array.isArray(state?.additionalModelOptionsCache) ? state.additionalModelOptionsCache : [])
  ]
  return values.map(optionFrom).filter((option): option is AgentSettingOption => option !== null)
}

const fromHelp = (output: string): AgentSettingOption[] => {
  const lines = output.split('\n')
  const start = lines.findIndex(line => /--model\s+<[^>]+>/i.test(line))
  if (start < 0) return []
  const block = lines.slice(start, start + 8).join('\n')
  return [...block.matchAll(/['"]([^'"]+)['"]/g)]
    .map(match => match[1])
    .filter(value => value.length > 0 && !/\s/.test(value))
    .map(value => ({ value, label: value }))
}

export const claudeModels = (home = homedir()): AgentSettingOption[] =>
  unique([live.get(home) ?? [], configured(home)])

export function refreshClaudeModels(options: ClaudeRefreshOptions = {}): Promise<boolean> {
  const home = options.home ?? homedir()
  const command = options.command ?? resolveCommand('claude') ?? 'claude'
  const invocation = commandInvocation(command, options.args ?? ['--help'])
  return new Promise(resolve => {
    const child = spawn(invocation.command, invocation.args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), options.timeoutMs ?? 5000)
    child.on('error', () => done(false))
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('close', () => {
      const models = fromHelp(output)
      if (models.length) live.set(home, models)
      done(models.length > 0)
    })
  })
}
