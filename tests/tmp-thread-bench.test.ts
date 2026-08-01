import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, it } from 'vitest'
import { buildThread, eventsOfThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/protocol'

const CHAT = join(homedir(), 'Library/Application Support/crew/projects/8fe5a6ed2108672a/.crew/chat')
const THREAD = 'd1b34c9c-bd2f-47fd-bbd6-aaee4288bdfe'

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
  const each = (performance.now() - at) / runs
  console.log(`${label}: ${each.toFixed(2)}ms`)
}

describe('bench', () => {
  it('measures the thread build', () => {
    const all = load()
    console.log(`whole log: ${all.length} events`)
    const steps: Record<string, unknown[]> = {}
    for (const e of all) {
      if (e.kind === 'agent.step') {
        const list = (steps[e.promptId] ??= [])
        list.push(e.step)
      }
    }
    const mine = eventsOfThread(all, THREAD)
    console.log(`thread: ${mine.length} events`)
    time('eventsOfThread over whole log', 20, () => eventsOfThread(all, THREAD))
    const built = buildThread(mine, steps as never, 'x', [])
    console.log(`items: ${built.length}`)
    time('buildThread', 20, () => buildThread(mine, steps as never, 'x', []))
  }, 120000)
})
