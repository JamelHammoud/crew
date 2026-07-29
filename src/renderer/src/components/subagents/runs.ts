import { useMemo } from 'react'
import { useCrew } from '../../state/store'
import type { SubagentRun } from '../thread'

// The helpers one thread sent out, read off the log rather than held anywhere.
// The record of a run is two events, and the second one is a fact about the
// first, so they are folded back into one thing here the way the chat block
// folds the three events of a call.
export function useSubagentRuns(parentThreadId: string): SubagentRun[] {
  const events = useCrew(state => state.events)
  return useMemo(() => {
    const ended = new Map<string, { ok: boolean; ms: number }>()
    for (const event of events) {
      if (event.kind === 'subagent.ended') ended.set(event.threadId, { ok: event.ok, ms: event.ms })
    }
    const runs: SubagentRun[] = []
    for (const event of events) {
      if (event.kind !== 'subagent.started' || event.parentThreadId !== parentThreadId) continue
      const home = ended.get(event.threadId)
      runs.push({
        threadId: event.threadId,
        name: event.name,
        subject: event.subject,
        agentId: event.agentId,
        ok: home?.ok,
        ms: home?.ms
      })
    }
    return runs.reverse()
  }, [events, parentThreadId])
}

export type RunState = 'working' | 'done' | 'failed'

export function useRunState(threadId: string): RunState {
  const running = useCrew(state => Boolean(state.threadPrompts[threadId]))
  const queued = useCrew(state => state.queues[threadId]?.length ?? 0)
  const failed = useCrew(state => {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const event = state.events[i]
      if (event.kind === 'agent.end' && event.threadId === threadId) return !event.ok
    }
    return false
  })
  if (running || queued > 0) return 'working'
  return failed ? 'failed' : 'done'
}
