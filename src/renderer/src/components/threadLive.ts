import type { AgentStep } from '../../../shared/llm'
import { parseFileRef } from './fileLinks'
import { thoughtPreview } from './thread'
import { THINKING, toolAction, type ToolIcon } from './toolActions'

export interface LiveLine {
  label: string
  // What the word is about: the file, the command, the thought so far.
  subject: string
  // The file the subject names, where it names one, so a card can shorten it to
  // where it really sits in the project the way a step in the thread does.
  path?: string
  mono: boolean
  // The three dots, which is what words arriving looks like everywhere else in
  // the app.
  dots: boolean
  icon?: ToolIcon
}

const cut = (text: string): string => text.replace(/\s+/g, ' ').trim()

// What a run is on right now, as one line. A tool that is running says the tool
// and what it is holding, and the gap between two of them is the model
// thinking, which is the same answer `describeStep` gives the foot of a thread.
export function liveLine(step: AgentStep | undefined): LiveLine {
  if (!step) return { label: 'Starting', subject: '', mono: false, dots: true }
  if (step.kind === 'thinking')
    return { label: THINKING.run, subject: thoughtPreview(step.text ?? ''), mono: false, dots: true }
  if (step.kind === 'text') return { label: 'Writing', subject: thoughtPreview(step.text ?? ''), mono: false, dots: true }
  if (step.status !== 'running') return { label: THINKING.run, subject: '', mono: false, dots: true }

  const action = toolAction(step.name, step.kind === 'subagent')
  const files = step.files ?? []
  if (files.length === 1)
    return { label: action.run, subject: files[0].path, path: files[0].path, mono: true, dots: false, icon: action.icon }
  if (files.length > 1)
    return { label: action.run, subject: `${files.length} files`, mono: true, dots: false, icon: action.icon }

  const detail = cut(step.detail ?? '')
  const ref = action.prose ? null : parseFileRef(detail)
  return {
    label: action.run,
    subject: detail,
    path: ref?.path,
    mono: !action.prose,
    dots: false,
    icon: action.icon
  }
}
