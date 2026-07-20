import type { Attachment } from '../../../shared/attachments'
import type { SessionEvent } from '../../../shared/events'
import type { AgentStep, FileChange } from '../../../shared/llm'

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
  files?: FileChange[]
  attachments?: Attachment[]
  route?: MessageRoute
}

// How a message reached the agent, shown on the message itself: it was folded
// into a run already in flight ('steering' while that run lasts, then
// 'steered'), or it is still waiting for a turn of its own ('queued').
export type MessageRoute = 'queued' | 'steering' | 'steered'

export function describeStep(step: AgentStep | undefined): string {
  if (!step) return 'Starting'
  if (step.kind === 'thinking') return 'Thinking'
  if (step.kind === 'text') return 'Writing'
  if (step.status === 'running') return step.kind === 'subagent' ? `${step.name} (agent)` : (step.name ?? 'Working')
  return 'Thinking'
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
      files: step.files,
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

// A queued message stops being newsworthy the moment its own run starts, but a
// steered one keeps its badge: nothing else in the thread shows where it went.
const routeBadge = (
  route: Extract<SessionEvent, { kind: 'message.route' }> | undefined,
  started: Set<string>,
  ended: Set<string>
): MessageRoute | undefined => {
  if (!route) return undefined
  if (route.mode === 'steered') return ended.has(route.promptId) ? undefined : 'steered'
  return started.has(route.promptId) ? undefined : 'queued'
}

export function buildThread(
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  selfId: string
): ThreadItem[] {
  const ended = new Set(events.filter(e => e.kind === 'agent.end').map(e => e.promptId))
  const started = new Set(events.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  // The last route wins: a steer the agent turned down is re-emitted as queued.
  const routes = new Map<string, Extract<SessionEvent, { kind: 'message.route' }>>()
  for (const event of events) {
    if (event.kind === 'message.route') routes.set(event.messageId, event)
  }
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'message') {
      const route = routes.get(event.id)
      items.push({
        key: event.id,
        ts: event.ts,
        kind: event.authorId === 'crew' ? 'note' : 'message',
        author: event.authorName,
        self: event.authorId === selfId,
        text: event.text,
        streaming: false,
        attachments: event.attachments,
        route: routeBadge(route, started, ended)
      })
    }
    if (event.kind === 'agent.start') {
      const live = !ended.has(event.promptId)
      const runSteps = steps[event.promptId] ?? []
      for (const step of runSteps) {
        const item = stepItem(step, event.agentLabel, event.promptId, live)
        if (item) items.push({ ...item, agentId: event.agentId })
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
