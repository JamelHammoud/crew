import type { AgentStep } from '../../../shared/llm'
import { toolAction } from './toolActions'

export type AgentActivity =
  | 'idle'
  | 'thinking'
  | 'reading'
  | 'searching'
  | 'editing'
  | 'designing'
  | 'running'
  | 'planning'
  | 'communicating'
  | 'acting'

const DESIGNING = /(figma|design|canvas|draw|image|video|screenshot|render)/i
const SEARCHING = /^(Searching|Finding|Listing|Checking|Watching)/
const EDITING = /^(Editing|Writing|Reporting)/
const PLANNING = /^(Planning|Writing a plan|Updating tasks)/
const COMMUNICATING = /^(Asking|Sending)/
const RUNNING = /^(Running|Stopping|Setting up)/

export function activityForStep(step: AgentStep | undefined): AgentActivity {
  if (!step || step.status !== 'running' || step.kind === 'thinking') return 'thinking'
  if (step.kind === 'text') return 'editing'
  const label = toolAction(step.name, step.kind === 'subagent').run
  if (DESIGNING.test(`${step.name ?? ''} ${label}`)) return 'designing'
  if (label.startsWith('Reading')) return 'reading'
  if (SEARCHING.test(label)) return 'searching'
  if (PLANNING.test(label)) return 'planning'
  if (COMMUNICATING.test(label)) return 'communicating'
  if (EDITING.test(label)) return 'editing'
  if (RUNNING.test(label)) return 'running'
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
