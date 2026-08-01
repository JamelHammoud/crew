import { useEffect, useMemo } from 'react'
import { mergeEvents, type SessionEvent } from '../../../shared/events'
import type { AgentStep } from '../../../shared/llm'
import { useCrew } from '../state/store'

// Everything a thread is drawn from: what the window still holds and what it
// read back out of the log for one that has scrolled past. Asking for it is
// part of reading it, so anything that shows a thread gets both halves by
// naming the thread, and the ask is refused where there is nothing to fetch.
// A thread with nothing read back is handed the window's own events and steps
// as they stand, so the one that just ran is drawn again for nothing.
export function useThreadRead(threadId: string): {
  events: SessionEvent[]
  steps: Record<string, AgentStep[]>
} {
  const events = useCrew(state => state.events)
  const steps = useCrew(state => state.steps)
  const readEvents = useCrew(state => state.readEvents)
  const readSteps = useCrew(state => state.readSteps)
  const online = useCrew(state => state.connection === 'online')
  const readThread = useCrew(state => state.readThread)
  useEffect(() => {
    if (online) readThread(threadId)
  }, [online, readThread, threadId])
  // The two halves are held apart because a step lands about once a frame while
  // an agent works, and merged together the log was folded again for every one
  // of them: a fresh array on every flush, which is every memo downstream of it
  // rebuilding a thread that has not changed.
  const merged = useMemo(
    () => (readEvents.length === 0 ? events : mergeEvents(readEvents, events)),
    [events, readEvents]
  )
  const mergedSteps = useMemo(
    () => (readEvents.length === 0 ? steps : { ...readSteps, ...steps }),
    [readEvents, readSteps, steps]
  )
  return useMemo(() => ({ events: merged, steps: mergedSteps }), [merged, mergedSteps])
}
