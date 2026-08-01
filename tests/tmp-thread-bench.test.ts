import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, it } from 'vitest'
import { trimEvents, type SessionEvent } from '../src/shared/events'

const CHAT = join(homedir(), 'Library/Application Support/crew/projects/8fe5a6ed2108672a/.crew/chat')

const load = (): SessionEvent[] => {
  const out: SessionEvent[] = []
  for (const name of readdirSync(CHAT).sort()) {
    if (!name.endsWith('.jsonl')) continue
    for (const line of readFileSync(join(CHAT, name), 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        out.push(JSON.parse(line) as SessionEvent)
      } catch {
        /* */
      }
    }
  }
  return out
}

const time = (label: string, runs: number, fn: () => unknown): void => {
  fn()
  const at = performance.now()
  for (let i = 0; i < runs; i++) fn()
  console.log(`${label}: ${((performance.now() - at) / runs).toFixed(2)}ms`)
}

describe('bench', () => {
  it('measures one event landing in the store', () => {
    const all = load()
    const step = all.find(e => e.kind === 'agent.step') as SessionEvent
    for (const limit of [500, 2000, 8000]) {
      const held = trimEvents(all, limit)
      const lasting = held.filter(e => e.kind !== 'agent.step').length
      console.log(`limit ${limit}: holds ${held.length} events (${lasting} not steps)`)
      time(`  copy + trim at limit ${limit}`, 20, () => trimEvents([...held, step], limit))
    }
  }, 120000)
})
