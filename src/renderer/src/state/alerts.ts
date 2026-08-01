import type { AgentAlert } from '../../../shared/alerts'
import type { SessionEvent } from '../../../shared/events'
import { relabelMentions, stripMention, type PooledAgent } from '../../../shared/llm'
import type { QueuedItem } from '../../../shared/protocol'
import { threadWorking, workingThreads } from '../components/thread'
import type { ThreadMeta } from './store'

export interface ReviewState {
  threads: Record<string, ThreadMeta>
  threadPrompts: Record<string, string>
  queues: Record<string, QueuedItem[]>
}

export interface AlertState extends ReviewState {
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>
  openThreadIds: string[]
}

// The badge is the count of the tasks panel's "Needs review" list, so both read
// the same rule: open, with nothing running or queued behind it. A helper is
// not a task of its own, or six of them finishing puts six rows on the list and
// six on the badge for one piece of work. A question asked on the side is not
// one either: it was answered where it was asked, and there is nothing to review.
export const reviewCount = (state: ReviewState): number => {
  const working = workingThreads(state.threadPrompts, state.queues, state.threads)
  let count = 0
  for (const thread of Object.values(state.threads)) {
    if (thread.status === 'open' && !thread.parentThreadId && !thread.aside && !working.has(thread.id)) count += 1
  }
  return count
}

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
  // the work it sent out is its work. Only its own run is left out of that, and
  // it has to be left out by name: the turn that just ended is still standing in
  // the map when this lands, so reading it back says the thread is working. An
  // empty map was what did that once, and it took the helpers out with it, so a
  // parent chimed while four of them were still going.
  const others = Object.fromEntries(Object.entries(state.threadPrompts).filter(([id]) => id !== event.threadId))
  if (event.threadId && threadWorking(event.threadId, others, state.queues, state.threads)) return false
  return true
}

// Nothing is said about the thread somebody already has open, since it says it
// there. That is the row's own clause and not the rule's: a sound is not on the
// screen, so it still plays for the thread being read. Whether anybody is
// looking at the window is not part of this either, and nothing downstream asks:
// the row and the system banner both go out every time.
export function finishedAlert(event: SessionEvent, state: AlertState): AgentAlert | null {
  if (event.kind !== 'agent.end') return null
  if (!threadFinished(event, state)) return null
  if (event.threadId && state.openThreadIds.includes(event.threadId)) return null
  const thread = event.threadId ? state.threads[event.threadId] : undefined
  const label = state.agents.find(agent => agent.id === event.agentId)?.label ?? event.agentLabel
  const title = relabelMentions(thread?.title ?? '', thread?.titleRefs, state.agents)
  const failed = !event.ok && !event.stopped
  return {
    title: event.ok ? `${label} finished` : event.stopped ? `${label} was stopped` : `${label} could not finish`,
    body: stripMention(title, label) || title,
    threadId: event.threadId,
    agentId: event.agentId,
    failed
  }
}

// A question the agent raised and answered for itself. It reads on the board
// and nowhere else, so nothing anywhere would say it while you are working in
// another thread, and what it costs to answer late only grows. Which board is
// on screen is the store's line, the way focus is: the rule is handed it.
export function questionAlert(event: SessionEvent, state: AlertState, boardOnScreen: string | null): AgentAlert | null {
  if (event.kind !== 'ticket.asked') return null
  if (event.threadId === boardOnScreen) return null
  const thread = state.threads[event.threadId]
  const label = state.agents.find(agent => agent.id === thread?.agentId)?.label ?? thread?.agentLabel ?? ''
  return {
    title: label ? `${label} has a question` : 'A question on the board',
    body: event.ask,
    threadId: event.threadId,
    agentId: thread?.agentId,
    board: true
  }
}

type ChatMessage = Extract<SessionEvent, { kind: 'message' }>

const wordToYou = (event: SessionEvent, selfId: string, openThreadIds: string[]): ChatMessage | null => {
  if (event.kind !== 'message' || event.authorId === selfId) return null
  if (event.threadId && openThreadIds.includes(event.threadId)) return null
  return event
}

const wordFrom = (message: ChatMessage, did: string): AgentAlert => ({
  title: `${message.authorName} ${did} you`,
  body: message.text,
  threadId: message.threadId,
  from: message.authorName
})

export function memberMentionAlert(event: SessionEvent, selfId: string, openThreadIds: string[]): AgentAlert | null {
  const message = wordToYou(event, selfId, openThreadIds)
  if (!message?.memberMentionRefs?.some(ref => ref.id === selfId)) return null
  return wordFrom(message, 'mentioned')
}

export function memberReplyAlert(event: SessionEvent, selfId: string, openThreadIds: string[]): AgentAlert | null {
  const message = wordToYou(event, selfId, openThreadIds)
  if (!message || message.replyTo?.authorId !== selfId) return null
  return wordFrom(message, 'replied to')
}
