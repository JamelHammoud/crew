import { useMemo } from 'react'
import type { AgentStep } from '../../../shared/llm'
import { useCrew } from '../state/store'

// Every step a thread has taken, in the order its turns were run. Steps are held
// per prompt, so anything that wants the whole of a thread has to gather them,
// and the thread and the board beside it both do.
export function useThreadSteps(threadId: string): AgentStep[] {
  const events = useCrew(s => s.events)
  const steps = useCrew(s => s.steps)
  return useMemo(() => {
    const promptIds = events
      .filter(event => event.kind === 'agent.start' && 'threadId' in event && event.threadId === threadId)
      .map(event => (event as { promptId: string }).promptId)
    return promptIds.flatMap(promptId => steps[promptId] ?? [])
  }, [events, steps, threadId])
}
