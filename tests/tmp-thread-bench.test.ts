import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, it } from 'vitest'
import { buildThread, eventsOfThread } from '../src/renderer/src/components/thread'
import { trimEvents, type SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'

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

describe('bench', () => {
  it('says how many rows a fresh window draws', () => {
    const all = load()
    const held = trimEvents(all, 500)
    const steps: Record<string, AgentStep[]> = {}
    for (const e of held) {
      if (e.kind === 'agent.step') (steps[e.promptId] ??= []).push(e.step)
    }
    const mine = eventsOfThread(held, THREAD)
    const items = buildThread(mine, steps, 'x', [])
    console.log(`window holds ${held.length} events, ${mine.length} of them this thread`)
    console.log(`the thread builds ${items.length} items, and now draws 400 of them`)
  }, 120000)
})
