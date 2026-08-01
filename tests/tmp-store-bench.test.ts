import { describe, it } from 'vitest'
import type { AgentStep } from '../src/shared/llm'

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

const time = (label: string, fn: () => unknown): void => {
  const at = performance.now()
  fn()
  console.log(`${label}: ${(performance.now() - at).toFixed(1)}ms`)
}

const run = (blocks: number, deltasEach: number): AgentStep[] => {
  const out: AgentStep[] = []
  for (let b = 0; b < blocks; b++) {
    for (let d = 0; d < deltasEach; d++) {
      out.push({ id: `b${b}`, kind: 'text', status: 'running', text: 'x'.repeat(d), ts: b })
    }
  }
  return out
}

describe('bench', () => {
  it('measures a long run streaming into the store', () => {
    for (const [blocks, each] of [
      [1000, 1],
      [3000, 1],
      [300, 10],
      [1000, 10]
    ]) {
      const stream = run(blocks, each)
      console.log(`${blocks} blocks x ${each} deltas = ${stream.length} step writes`)
      time('  old ', () => {
        let out: AgentStep[] | undefined
        for (const s of stream) out = old(out, s)
        return out
      })
      time('  new ', () => {
        let out: AgentStep[] | undefined
        for (const s of stream) out = next(out, s)
        return out
      })
    }
  }, 300000)
})
