import type { AgentStep } from '../../../shared/llm'
import { THINKING, toolAction, type ToolIcon } from './toolActions'

export interface LiveLine {
  label: string
  icon?: ToolIcon
}

export function liveLine(step: AgentStep | undefined): LiveLine {
  if (!step) return { label: 'Starting' }
  if (step.kind === 'thinking') return { label: THINKING.run }
  if (step.kind === 'text') return { label: 'Writing' }
  if (step.status !== 'running') return { label: THINKING.run }
  const action = toolAction(step.name, step.kind === 'subagent')
  return { label: action.run, icon: action.icon }
}
