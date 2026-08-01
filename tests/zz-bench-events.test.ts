import { describe, it } from 'vitest'
import { appendEvent, trimEvents } from '../src/shared/events'
import type { SessionEvent } from '../src/shared/events'

function build(count: number, stepsPerRun: number): SessionEvent[] {
  const events: SessionEvent[] = []
  let n = 0
  while (events.length < count) {
    const promptId = `p${n}`
    events.push({
      id: `e${events.length}`,
      kind: 'agent.start',
      ts: events.length,
      agentId: 'a1',
      promptId,
      threadId: 't1',
      text: 'go'
    } as unknown as SessionEvent)
    for (let i = 0; i < stepsPerRun && events.length < count; i++) {
      events.push({
        id: `e${events.length}`,
        kind: 'agent.step',
        ts: events.length,
        agentId: 'a1',
        promptId,
        step: { id: `s${i}`, kind: 'tool', name: 'Read', text: 'x'.repeat(200) }
      } as unknown as SessionEvent)
    }
    events.push({
      id: `e${events.length}`,
      kind: 'message',
      ts: events.length,
      memberId: 'm1',
      name: 'Jamel',
      text: 'hello'
    } as unknown as SessionEvent)
    n++
  }
  return events
}

function time(label: string, runs: number, fn: () => void): void {
  fn()
  const t = performance.now()
  for (let i = 0; i < runs; i++) fn()
  const each = (performance.now() - t) / runs
  console.log(`${label}: ${each.toFixed(3)}ms`)
}

describe('event path cost', () => {
  it('measures', () => {
    for (const size of [1000, 4000, 7500, 15000]) {
      const events = build(size, 40)
      const step = {
        id: 'live',
        kind: 'agent.step',
        ts: size + 1,
        agentId: 'a1',
        promptId: `p${Math.floor(size / 41) - 1}`,
        step: { id: 'sX', kind: 'tool', name: 'Read', text: 'y' }
      } as unknown as SessionEvent
      const msg = {
        id: 'liveM',
        kind: 'message',
        ts: size + 2,
        memberId: 'm1',
        name: 'Jamel',
        text: 'hi'
      } as unknown as SessionEvent
      console.log(`--- ${events.length} events`)
      time('  appendEvent(step)', 200, () => {
        appendEvent(events, step, 500)
      })
      time('  appendEvent(message)', 200, () => {
        appendEvent(events, msg, 500)
      })
      time('  trimEvents', 50, () => {
        trimEvents(events, 500)
      })
    }
  })
})
