import type { SessionEvent } from '../../../shared/events'
import type { AgentStep } from '../../../shared/llm'

export interface ThreadItem {
  key: string
  ts: number
  kind: 'message' | 'reply' | 'note' | 'thinking' | 'tool'
  author: string
  self: boolean
  text: string
  streaming: boolean
  promptId?: string
  agentId?: string
  error?: string
  name?: string
  detail?: string
  subagent?: boolean
}

const stepItem = (step: AgentStep, author: string, promptId: string, live: boolean): ThreadItem | null => {
  const streaming = live && step.status === 'running'
  if (step.kind === 'tool' || step.kind === 'subagent') {
    return {
      key: `${promptId}:${step.id}`,
      ts: step.ts,
      kind: 'tool',
      author,
      self: false,
      text: '',
      streaming,
      promptId,
      name: step.name || 'Working',
      detail: step.detail,
      subagent: step.kind === 'subagent'
    }
  }
  if (!step.text) return null
  return {
    key: `${promptId}:${step.id}`,
    ts: step.ts,
    kind: step.kind === 'thinking' ? 'thinking' : 'reply',
    author,
    self: false,
    text: step.text,
    streaming,
    promptId
  }
}

export function buildThread(
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  selfId: string
): ThreadItem[] {
  const ended = new Set(events.filter(e => e.kind === 'agent.end').map(e => e.promptId))
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'message') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: event.authorId === 'crew' ? 'note' : 'message',
        author: event.authorName,
        self: event.authorId === selfId,
        text: event.text,
        streaming: false
      })
    }
    if (event.kind === 'agent.start') {
      const live = !ended.has(event.promptId)
      const runSteps = steps[event.promptId] ?? []
      for (const step of runSteps) {
        const item = stepItem(step, event.agentLabel, event.promptId, live)
        if (item) items.push({ ...item, agentId: event.agentId })
      }
      if (live && runSteps.length === 0) {
        items.push({
          key: event.id,
          ts: event.ts,
          kind: 'reply',
          author: event.agentLabel,
          self: false,
          text: '',
          streaming: true,
          promptId: event.promptId,
          agentId: event.agentId
        })
      }
    }
    if (event.kind === 'agent.end') {
      const wrote = (steps[event.promptId] ?? []).some(step => step.kind === 'text' && step.text)
      if (!event.ok || !wrote) {
        items.push({
          key: event.id,
          ts: event.ts,
          kind: 'reply',
          author: event.agentLabel,
          self: false,
          text: event.ok ? (event.text ?? '') : (event.error ?? 'Something went wrong.'),
          streaming: false,
          error: event.ok ? undefined : (event.error ?? 'error')
        })
      }
    }
  }
  return items
}
