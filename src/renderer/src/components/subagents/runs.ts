import { useMemo } from 'react'
import type { SessionEvent } from '../../../../shared/events'
import { useCrew } from '../../state/store'
import type { SubagentRun } from '../thread'

export interface SubagentRow extends SubagentRun {
  depth: number
}

type Started = Extract<SessionEvent, { kind: 'subagent.started' }>

// The helpers a thread sent out and the ones those sent out in turn, read off
// the log rather than held anywhere.
// The record of a run is two events, and the second one is a fact about the
// first, so they are folded back into one thing here the way the chat block
// folds the three events of a call.
export function useSubagentRuns(parentThreadId: string): SubagentRow[] {
  const events = useCrew(state => state.events)
  return useMemo(() => {
    const ended = new Map<string, { ok: boolean; ms: number; stopped?: boolean }>()
    const sent = new Map<string, Started[]>()
    for (const event of events) {
      if (event.kind === 'subagent.ended') {
        ended.set(event.threadId, { ok: event.ok, ms: event.ms, stopped: event.stopped })
      }
      if (event.kind === 'subagent.started') {
        const out = sent.get(event.parentThreadId) ?? []
        out.push(event)
        sent.set(event.parentThreadId, out)
      }
    }
    const rows: SubagentRow[] = []
    const seen = new Set([parentThreadId])
    const walk = (threadId: string, depth: number): void => {
      const out = sent.get(threadId) ?? []
      for (let i = out.length - 1; i >= 0; i--) {
        const event = out[i]
        if (seen.has(event.threadId)) continue
        seen.add(event.threadId)
        const home = ended.get(event.threadId)
        rows.push({
          threadId: event.threadId,
          name: event.name,
          subject: event.subject,
          agentId: event.agentId,
          ok: home?.ok,
          ms: home?.ms,
          stopped: home?.stopped,
          depth
        })
        walk(event.threadId, depth + 1)
      }
    }
    walk(parentThreadId, 0)
    return rows
  }, [events, parentThreadId])
}

export type RunState = 'working' | 'done' | 'stopped' | 'failed'

// Stopping a run stops the helpers it sent out, so a stop read as a failure is
// a row of red down a panel for one press somebody made on purpose.
export function useRunState(threadId: string): RunState {
  const running = useCrew(state => Boolean(state.threadPrompts[threadId]))
  const queued = useCrew(state => state.queues[threadId]?.length ?? 0)
  const ended = useCrew(state => {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const event = state.events[i]
      if (event.kind === 'agent.end' && event.threadId === threadId) {
        return event.ok ? 'done' : event.stopped ? 'stopped' : 'failed'
      }
    }
    return 'done' as const
  })
  if (running || queued > 0) return 'working'
  return ended
}
