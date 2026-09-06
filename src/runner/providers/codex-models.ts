import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { commandInvocation } from './cli'
import { resolveCommand } from './path'

export interface CodexCatalog {
  models: string[]
  efforts: string[]
}

interface ModelRecord {
  id?: unknown
  model?: unknown
  slug?: unknown
  hidden?: unknown
  visibility?: unknown
  priority?: unknown
  supportedReasoningEfforts?: Array<{ reasoningEffort?: unknown }>
  supported_reasoning_levels?: Array<{ effort?: unknown }>
}

interface RefreshOptions {
  command?: string
  args?: string[]
  home?: string
  timeoutMs?: number
}

const EMPTY: CodexCatalog = { models: [], efforts: [] }
const live = new Map<string, CodexCatalog>()

const nameOf = (model: ModelRecord): string => {
  for (const value of [model.model, model.slug, model.id]) {
    if (typeof value === 'string' && value) return value
  }
  return ''
}

const effortsOf = (model: ModelRecord): string[] => [
  ...(model.supportedReasoningEfforts ?? []).map(level => level.reasoningEffort),
  ...(model.supported_reasoning_levels ?? []).map(level => level.effort)
].filter((effort): effort is string => typeof effort === 'string' && effort.length > 0)

const catalogFrom = (records: unknown, cached: boolean): CodexCatalog | null => {
  if (!Array.isArray(records)) return null
  const visible = records
    .filter((record): record is ModelRecord => {
      if (!record || typeof record !== 'object') return false
      const model = record as ModelRecord
      return Boolean(nameOf(model)) && model.hidden !== true && model.visibility !== 'hide'
    })
    .sort((a, b) => {
      if (!cached) return 0
      return (typeof a.priority === 'number' ? a.priority : 0) - (typeof b.priority === 'number' ? b.priority : 0)
    })
  if (!visible.length) return null
  const efforts: string[] = []
  for (const model of visible) {
    for (const effort of effortsOf(model)) {
      if (!efforts.includes(effort)) efforts.push(effort)
    }
  }
  return { models: visible.map(nameOf), efforts }
}

export function codexModels(home = homedir()): CodexCatalog {
  const current = live.get(home)
  if (current) return current
  try {
    const cached = JSON.parse(readFileSync(join(home, '.codex', 'models_cache.json'), 'utf8'))
    return catalogFrom(cached?.models, true) ?? EMPTY
  } catch {
    return EMPTY
  }
}

export function refreshCodexModels(options: RefreshOptions = {}): Promise<boolean> {
  const home = options.home ?? homedir()
  const command = options.command ?? resolveCommand('codex') ?? 'codex'
  const invocation = commandInvocation(command, options.args ?? ['app-server'])
  const timeoutMs = options.timeoutMs ?? 5000
  return new Promise(resolve => {
    const child = spawn(invocation.command, invocation.args, { stdio: ['pipe', 'pipe', 'ignore'] })
    let settled = false
    let buffer = ''
    let requestId = 2
    const records: ModelRecord[] = []
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(ok)
    }
    const write = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`)
    const timer = setTimeout(() => done(false), timeoutMs)
    child.on('error', () => done(false))
    child.on('close', () => done(false))
    child.stdin.on('error', () => done(false))
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        let message: any
        try {
          message = JSON.parse(line)
        } catch {
          continue
        }
        if (message.id === 1 && message.result) {
          write({ method: 'model/list', id: requestId, params: { includeHidden: false } })
          continue
        }
        if (message.id !== requestId || !Array.isArray(message.result?.data)) continue
        records.push(...message.result.data)
        const cursor = message.result.nextCursor
        if (typeof cursor === 'string' && cursor) {
          requestId += 1
          write({ method: 'model/list', id: requestId, params: { cursor, includeHidden: false } })
          continue
        }
        const catalog = catalogFrom(records, false)
        if (!catalog) {
          done(false)
          continue
        }
        live.set(home, catalog)
        done(true)
      }
    })
    write({
      method: 'initialize',
      id: 1,
      params: { clientInfo: { name: 'crew', title: 'Crew', version: '0.1.0' }, capabilities: null }
    })
  })
}
