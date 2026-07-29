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
// the same rule: open, with nothing running or queued behind it. A helper is
// not a task of its own, or six of them finishing puts six rows on the list and
// six on the badge for one piece of work. A question asked on the side is not
// one either: it was answered where it was asked, and there is nothing to review.
export const reviewCount = (state: ReviewState): number =>
  Object.values(state.threads).filter(
    thread =>
      thread.status === 'open' &&
      !thread.parentThreadId &&
      !thread.aside &&
      !threadWorking(thread.id, state.threadPrompts, state.queues, state.threads)
  ).length

// A turn ending is not a thread finishing, and this is the one place that tells
// the two apart. Everything that says a thread is done reads it: the row, the
// system banner and the sound, so a chime can never say a thread landed where
// the app itself says nothing landed.
export function threadFinished(event: SessionEvent, state: ReviewState): boolean {
  if (event.kind !== 'agent.end') return false
  const thread = event.threadId ? state.threads[event.threadId] : undefined
  if (thread && thread.status !== 'open') return false
  if (event.threadId && (state.queues[event.threadId]?.length ?? 0) > 0) return false
  // A question on the side lands in the panel that opened to answer it, which is
  // already on the screen, so a row about it says the same thing twice.
  if (thread?.aside) return false
  // A helper coming home is the parent's news, and the parent says it in its
  // own thread. The one exception is one that stopped after its parent was
  // already done, which nobody would otherwise ever see.
  if (thread?.parentThreadId && (event.ok || state.threadPrompts[thread.parentThreadId])) return false
  // Nor is a thread with helpers still out finished: its own turn ended, but
  // the work it sent out is its work.
  if (event.threadId && threadWorking(event.threadId, {}, state.queues, state.threads)) return false
  return true
}

// Nothing is said about the thread somebody already has open, since it says it
// there. That is the row's own clause and not the rule's: a sound is not on the
// screen, so it still plays for the thread being read. Whether anybody is
// looking at the window is not part of this either: the app says it every time,
// and only the system banner waits for the window to be in the background.
export function finishedAlert(event: SessionEvent, state: AlertState): AgentAlert | null {
  if (event.kind !== 'agent.end') return null
  if (!threadFinished(event, state)) return null
  if (event.threadId && state.openThreadId === event.threadId) return null
  const thread = event.threadId ? state.threads[event.threadId] : undefined
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
