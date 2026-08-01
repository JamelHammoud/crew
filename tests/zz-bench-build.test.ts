import { describe, it } from 'vitest'
import { buildThread } from '../src/renderer/src/components/thread'
import type { SessionEvent } from '../src/shared/events'
import type { AgentStep } from '../src/shared/llm'

const AGENT = { id: 'ali/claude', label: 'Claude' }

function build(runs: number, perRun: number): { events: SessionEvent[]; steps: Record<string, AgentStep[]> } {
  const events: SessionEvent[] = []
  const steps: Record<string, AgentStep[]> = {}
  for (let r = 0; r < runs; r++) {
    const promptId = `p${r}`
    events.push({
      id: `m${r}`,
      ts: r * 1000,
      kind: 'message',
      authorId: 'ali',
      authorName: 'ALI',
      text: `do the thing ${r}`,
      threadId: 't1'
    } as unknown as SessionEvent)
    events.push({
      id: `s${r}`,
      ts: r * 1000 + 1,
      kind: 'agent.start',
      threadId: 't1',
      promptId,
      agentId: AGENT.id,
      agentLabel: AGENT.label,
      promptText: 'go',
      byName: 'ALI'
    } as unknown as SessionEvent)
    steps[promptId] = Array.from({ length: perRun }, (_, i) => ({
      id: `${promptId}-${i}`,
      ts: r * 1000 + 2 + i,
      kind: 'tool',
      status: 'done',
      name: i % 2 === 0 ? 'Read' : 'Bash',
      detail: `step ${i}`
    })) as AgentStep[]
    if (r < runs - 1) {
      events.push({
        id: `e${r}`,
        ts: r * 1000 + 900,
        kind: 'agent.end',
        threadId: 't1',
        promptId,
        agentId: AGENT.id,
        agentLabel: AGENT.label,
        ok: true,
        text: 'done'
      } as unknown as SessionEvent)
    }
  }
  return { events, steps }
}

describe('buildThread under a live run', () => {
  it('measures', () => {
    for (const [runs, perRun] of [
      [10, 30],
      [40, 30],
      [40, 90]
    ]) {
      const { events, steps } = build(runs, perRun)
      const live = `p${runs - 1}`
      const items = buildThread(events, steps, 'ali', [AGENT])
      const t = performance.now()
      const passes = 40
      for (let i = 0; i < passes; i++) {
        const next = { ...steps, [live]: [...steps[live], { ...steps[live][0], id: `extra-${i}` }] }
        buildThread(events, next, 'ali', [AGENT])
      }
      const each = (performance.now() - t) / passes
      console.log(`${runs} runs x ${perRun} steps, ${items.length} items: ${each.toFixed(3)}ms a step landing`)
    }
  })
})
