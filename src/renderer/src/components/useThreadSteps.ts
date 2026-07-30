import { useMemo } from 'react'
import type { AgentStep } from '../../../shared/llm'
import { useCrew } from '../state/store'
import { stepsOfFamily, stepsOfThread } from './thread'

// Every step a thread's own turns have taken, in the order they were run. The
// board beside a thread reads these, because the list of work is the thread's
// own and a helper keeps one of its own.
export function useThreadSteps(threadId: string): AgentStep[] {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  return useMemo(() => stepsOfThread(threadId, events, steps), [events, steps, threadId])
}

// The steps of a thread and of everything it sent out, which is what says what
// changed: a helper's edits are the thread's edits.
export function useFamilySteps(threadId: string): AgentStep[] {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  const threads = useCrew(s => s.threads)
  return useMemo(() => stepsOfFamily(threadId, events, steps, threads), [events, steps, threads, threadId])
}
