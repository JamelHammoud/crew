import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'

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

const old = (steps: AgentStep[] | undefined, step: AgentStep): AgentStep[] =>
  [...(steps ?? []).filter(s => s.id !== step.id), step].sort((a, b) => a.ts - b.ts)

const byTime = (a: AgentStep, b: AgentStep): number => a.ts - b.ts

const next = (steps: AgentStep[] | undefined, step: AgentStep): AgentStep[] => {
  const held = steps ?? []
  const last = held[held.length - 1]
  if (!last) return [step]
  if (last.id === step.id) {
    const out = [...held.slice(0, -1), step]
    return last.ts === step.ts ? out : out.sort(byTime)
  }
  if (step.ts >= last.ts && !held.some(one => one.id === step.id)) return [...held, step]
  return [...held.filter(one => one.id !== step.id), step].sort(byTime)
}

const settle = (gathered: Record<string, AgentStep[]>): Record<string, AgentStep[]> => {
  const steps: Record<string, AgentStep[]> = {}
  for (const [promptId, held] of Object.entries(gathered)) {
    const byId = new Map<string, AgentStep>()
    for (const step of held) {
      byId.delete(step.id)
      byId.set(step.id, step)
    }
    steps[promptId] = [...byId.values()].sort(byTime)
  }
  return steps
}

const time = (label: string, fn: () => unknown): void => {
  const at = performance.now()
  fn()
  console.log(`${label}: ${(performance.now() - at).toFixed(1)}ms`)
}

describe('bench', () => {
  it('measures a session arriving whole', () => {
    const all = load()
    const window = all.slice(-7522)
    const steps = window.filter(e => e.kind === 'agent.step') as Extract<SessionEvent, { kind: 'agent.step' }>[]
    const runs = new Set(steps.map(e => e.promptId))
    console.log(`snapshot window: ${steps.length} steps over ${runs.size} runs`)
    const biggest = [...runs].map(id => steps.filter(e => e.promptId === id).length).sort((a, b) => b - a)[0]
    console.log(`longest run: ${biggest} steps`)

    time('  old  welcome build', () => {
      const out: Record<string, AgentStep[]> = {}
      for (const e of steps) out[e.promptId] = old(out[e.promptId], e.step)
      return out
    })
    time('  new  welcome build', () => {
      const gathered: Record<string, AgentStep[]> = {}
      for (const e of steps) (gathered[e.promptId] ??= []).push(e.step)
      return settle(gathered)
    })

    const one = steps[0].promptId
    const run = steps.filter(e => e.promptId === one).map(e => e.step)
    time(`  old  one run of ${run.length} streaming`, () => {
      let out: AgentStep[] | undefined
      for (const s of run) out = old(out, s)
      return out
    })
    time(`  new  one run of ${run.length} streaming`, () => {
      let out: AgentStep[] | undefined
      for (const s of run) out = next(out, s)
      return out
    })
  }, 300000)
})
