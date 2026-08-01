import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { appendEvent, trimEvents, type SessionEvent } from '../src/shared/events'

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
  console.log(`${label}: ${((performance.now() - at) / runs).toFixed(3)}ms`)
}

describe('bench', () => {
  it('measures one event landing in the store', () => {
    const all = load()
    console.log(`log holds ${all.length} events`)
    const step = all.find(e => e.kind === 'agent.step') as SessionEvent
    const message = all.find(e => e.kind === 'message') as SessionEvent
    for (const limit of [500, 2000, 8000]) {
      const held = trimEvents(all, limit)
      const lasting = held.filter(e => e.kind !== 'agent.step').length
      console.log(`limit ${limit}: holds ${held.length} events (${lasting} not steps)`)
      time(`  old  step   `, 20, () => trimEvents([...held, step], limit))
      time(`  new  step   `, 20, () => appendEvent(held, step, limit))
      time(`  old  message`, 20, () => trimEvents([...held, message], limit))
      time(`  new  message`, 20, () => appendEvent(held, message, limit))
    }
  }, 300000)

  it('lands what trimming the whole real log again lands', () => {
    const all = load()
    for (const limit of [200, 500]) {
      let held: SessionEvent[] = []
      let whole: SessionEvent[] = []
      for (const event of all.slice(0, 6000)) {
        held = appendEvent(held, event, limit)
        whole = trimEvents([...whole, event], limit)
        expect(held.map(e => e.id)).toEqual(whole.map(e => e.id))
      }
      console.log(`limit ${limit}: agreed over 6000 real events, window ${held.length}`)
    }
  }, 300000)
})
