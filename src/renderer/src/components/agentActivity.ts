import type { AgentStep } from '../../../shared/llm'
import { toolAction } from './toolActions'

export type AgentActivity = 'idle' | 'thinking' | 'reading' | 'writing' | 'acting'

const READING = /^(Reading|Searching|Finding|Listing|Checking|Watching)/
const WRITING = /^(Editing|Writing|Reporting|Sending|Making|Updating)/
const THINKING = /^(Planning|Asking)/

export function activityForStep(step: AgentStep | undefined): AgentActivity {
  if (!step || step.status !== 'running' || step.kind === 'thinking') return 'thinking'
  if (step.kind === 'text') return 'writing'
  const label = toolAction(step.name, step.kind === 'subagent').run
  if (READING.test(label)) return 'reading'
  if (WRITING.test(label)) return 'writing'
  if (THINKING.test(label)) return 'thinking'
  return 'acting'
}

export function activityForAgent(
  promptIds: readonly string[] | undefined,
  steps: Record<string, AgentStep[]>
): AgentActivity {
  if (!promptIds?.length) return 'idle'
  let latest: AgentStep | undefined
  for (const promptId of promptIds) {
    const step = steps[promptId]?.at(-1)
    if (step && (!latest || step.ts > latest.ts)) latest = step
  }
  return activityForStep(latest)
}
