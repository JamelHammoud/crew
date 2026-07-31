import { readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { usageFrom } from './tokens'
import type { ParsedUsage } from './types'

const SESSIONS = ['.kimi-code', 'sessions']
const WIRE = ['agents', 'main', 'wire.jsonl']
const SCOPE = 'turn'

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

export function kimiUsage(text: string): ParsedUsage | null {
  let model = ''
  let seen = false
  let input = 0
  let output = 0
  let cacheRead = 0
  let cacheWrite = 0
  for (const line of text.split('\n')) {
    if (!line.includes('usage.record')) continue
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg?.type !== 'usage.record' || msg?.usageScope !== SCOPE) continue
    const usage = msg.usage
    if (!usage || typeof usage !== 'object') continue
    seen = true
    if (typeof msg.model === 'string' && msg.model.trim()) model = msg.model
    input += count(usage.inputOther)
    output += count(usage.output)
    cacheRead += count(usage.inputCacheRead)
    cacheWrite += count(usage.inputCacheCreation)
  }
  if (!seen) return null
  const parsed = usageFrom(
    {
      input_tokens: input,
      output_tokens: output,
      cache_read_input_tokens: cacheRead,
      cache_creation_input_tokens: cacheWrite
    },
    model
  )
  return parsed ? { ...parsed, total: true } : null
}

export function kimiWire(home = homedir()) {
  let found = ''
  return (sessionId: string): string | null => {
    if (found) {
      try {
        return readFileSync(found, 'utf8')
      } catch {
        return null
      }
    }
    const root = join(home, ...SESSIONS)
    let dirs: string[]
    try {
      dirs = readdirSync(root)
    } catch {
      return null
    }
    for (const dir of dirs) {
      const path = join(root, dir, sessionId, ...WIRE)
      try {
        const text = readFileSync(path, 'utf8')
        found = path
        return text
      } catch {
        continue
      }
    }
    return null
  }
}
