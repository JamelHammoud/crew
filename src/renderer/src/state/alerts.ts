import type { AgentAlert } from '../../../shared/alerts'
import type { SessionEvent } from '../../../shared/events'
import { relabelMentions, type PooledAgent } from '../../../shared/llm'
import type { QueuedItem } from '../../../shared/protocol'
import { stripMention, threadWorking } from '../components/thread'
import type { ThreadMeta } from './store'

export interface ReviewState {
  threads: Record<string, ThreadMeta>
  threadPrompts: Record<string, string>
  queues: Record<string, QueuedItem[]>
}

export interface AlertState extends ReviewState {
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>
  openThreadId: string | null
}

// The badge is the count of the tasks panel's "Needs review" list, so both read
// the same rule: open, with nothing running or queued behind it.
export const reviewCount = (state: ReviewState): number =>
  Object.values(state.threads).filter(
    thread => thread.status === 'open' && !threadWorking(thread.id, state.threadPrompts, state.queues)
  ).length

// Nothing is said about the thread somebody already has open, since it says it
// there, and a run with more waiting behind it has not finished yet. Whether
// anybody is looking at the window is not part of this: the app says it either
// way, and only the system banner waits for the window to be in the background.
export function finishedAlert(event: SessionEvent, state: AlertState): AgentAlert | null {
  if (event.kind !== 'agent.end') return null
  if (event.threadId && state.openThreadId === event.threadId) return null
  const thread = event.threadId ? state.threads[event.threadId] : undefined
  if (thread && thread.status !== 'open') return null
  if (event.threadId && (state.queues[event.threadId]?.length ?? 0) > 0) return null
  const label = state.agents.find(agent => agent.id === event.agentId)?.label ?? event.agentLabel
  const title = relabelMentions(thread?.title ?? '', thread?.titleRefs, state.agents)
  return {
    title: event.ok ? `${label} finished` : `${label} stopped`,
    body: stripMention(title, label) || title,
    threadId: event.threadId,
    agentId: event.agentId,
    stopped: !event.ok
  }
}

export function memberMentionAlert(event: SessionEvent, selfId: string, openThreadId: string | null): AgentAlert | null {
  if (event.kind !== 'message' || event.authorId === selfId) return null
  if (event.threadId && event.threadId === openThreadId) return null
  if (!event.memberMentionRefs?.some(ref => ref.id === selfId)) return null
  return {
    title: `${event.authorName} mentioned you`,
    body: event.text,
    threadId: event.threadId,
    from: event.authorName
  }
}
