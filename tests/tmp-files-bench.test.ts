import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { describe, it } from 'vitest'
import type { SessionEvent } from '../src/shared/events'
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

const foldWhole = (steps: AgentStep[]) => {
  const map = new Map<string, { added: number; removed: number; diff: string }>()
  for (const step of steps) {
    for (const file of step.files ?? []) {
      const entry = map.get(file.path) ?? { added: 0, removed: 0, diff: '' }
      entry.added += file.added
      entry.removed += file.removed
      if (file.diff) entry.diff = entry.diff ? `${entry.diff}\n\n${file.diff}` : file.diff
      map.set(file.path, entry)
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

const foldCounts = (steps: AgentStep[]) => {
  const map = new Map<string, { added: number; removed: number }>()
  for (const step of steps) {
    for (const file of step.files ?? []) {
      const entry = map.get(file.path) ?? { added: 0, removed: 0 }
      entry.added += file.added
      entry.removed += file.removed
      map.set(file.path, entry)
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}

const time = (label: string, runs: number, fn: () => unknown): void => {
  fn()
  const at = performance.now()
  for (let i = 0; i < runs; i++) fn()
  console.log(`${label}: ${((performance.now() - at) / runs).toFixed(2)}ms`)
}

describe('bench', () => {
  it('measures the files card', () => {
    const all = load()
    const prompts = new Set(
      all.filter(e => e.kind === 'agent.start' && e.threadId === THREAD).map(e => (e as { promptId: string }).promptId)
    )
    const steps: AgentStep[] = []
    for (const e of all) {
      if (e.kind === 'agent.step' && prompts.has(e.promptId)) steps.push(e.step)
    }
    const files = foldWhole(steps)
    const text = files.reduce((sum, [, file]) => sum + file.diff.length, 0)
    console.log(`${steps.length} steps, ${files.length} files, ${(text / 1e6).toFixed(1)}MB of diff folded`)
    time('fold with the diffs', 10, () => foldWhole(steps))
    time('fold the counts alone', 10, () => foldCounts(steps))
  }, 120000)
})
