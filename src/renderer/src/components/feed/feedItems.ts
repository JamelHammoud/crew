import type { SessionEvent } from '../../../../shared/events'
import type { AgentStep, PooledAgent } from '../../../../shared/llm'
import { messageReactionTarget } from '../../../../shared/reactions'
import type { ThreadMeta } from '../../state/store'
import { huddleRecords, type HuddleRecord } from '../huddle/log'
import { reactionGroups } from '../reactionGroups'
import { sameItem, type ThreadItem, type ThreadState } from '../thread'

export type FeedEntry =
  | { kind: 'msg'; key: string; ts: number; item: ThreadItem }
  | { kind: 'card'; key: string; ts: number; thread: ThreadMeta }
  | { kind: 'huddle'; key: string; ts: number; record: HuddleRecord }

export interface ThreadStatus {
  state: ThreadState
  // What the run is on right now, so the card says the tool it is holding and
  // the file it is on rather than a word for the kind of work.
  step?: AgentStep
  // The line a finished run left behind.
  detail: string
  // The moment a live run started, counted into seconds by the card rather than
  // here, so a working thread does not draw the whole feed again once a second.
  startedAt?: number
  // How long a finished run took.
  ms?: number
  tokens?: number
  cost?: number
  added: number
  removed: number
}

export const RESTING: ThreadStatus = { state: 'ready', detail: '', added: 0, removed: 0 }

export function buildFeed(
  events: SessionEvent[],
  threads: Record<string, ThreadMeta>,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>,
  selfId: string
): FeedEntry[] {
  const list: FeedEntry[] = []
  const reactions = reactionGroups(events, selfId)
  const huddles = huddleRecords(events)
  for (const event of events) {
    if (event.kind === 'message' && !event.threadId) {
      const targetId = messageReactionTarget(event.id)
      list.push({
        kind: 'msg',
        key: event.id,
        ts: event.ts,
        item: {
          key: event.id,
          ts: event.ts,
          kind: event.authorId === 'crew' ? 'note' : 'message',
          author: agents.find(agent => agent.id === event.authorId)?.label ?? event.authorName,
          authorId: event.authorId,
          self: event.authorId === selfId,
          text: event.text,
          streaming: false,
          attachments: event.attachments,
          mentionRefs: event.mentionRefs,
          docMentions: event.docMentions,
          boardMentions: event.boardMentions,
          replyTo: event.replyTo,
          reactionTargetId: event.authorId === 'crew' ? undefined : targetId,
          reactions: event.authorId === 'crew' ? undefined : reactions.get(targetId)
        }
      })
    }
    if (
      event.kind === 'thread.started' &&
      !event.aside &&
      !event.parentThreadId &&
      threads[event.threadId]?.status === 'open'
    ) {
      list.push({ kind: 'card', key: event.id, ts: event.ts, thread: threads[event.threadId] })
    }
    if (event.kind === 'huddle.started') {
      const record = huddles.get(event.huddleId)
      if (record) list.push({ kind: 'huddle', key: event.id, ts: event.ts, record })
    }
  }
  return list
}

export function lastEnds(events: SessionEvent[]): SessionEvent[] {
  const byThread = new Map<string, SessionEvent>()
  for (const event of events) {
    if (event.kind === 'agent.end' && event.threadId) byThread.set(event.threadId, event)
  }
  return [...byThread.values()]
}

export function runStarts(events: SessionEvent[]): Map<string, number> {
  const at = new Map<string, number>()
  for (const event of events) {
    if (event.kind === 'agent.start') at.set(event.promptId, event.ts)
  }
  return at
}

const sameNames = (a: string[], b: string[]): boolean =>
  a === b || (a.length === b.length && a.every((name, index) => name === b[index]))

export const sameHuddleRecord = (a: HuddleRecord, b: HuddleRecord): boolean =>
  a.id === b.id &&
  a.ts === b.ts &&
  a.by === b.by &&
  a.byId === b.byId &&
  a.ms === b.ms &&
  sameNames(a.names, b.names)

export function sameEntry(a: FeedEntry, b: FeedEntry): boolean {
  if (a === b) return true
  if (a.key !== b.key || a.ts !== b.ts) return false
  if (a.kind === 'msg') return b.kind === 'msg' && sameItem(a.item, b.item)
  if (a.kind === 'card') return b.kind === 'card' && a.thread === b.thread
  return b.kind === 'huddle' && sameHuddleRecord(a.record, b.record)
}

export const sameStatus = (a: ThreadStatus, b: ThreadStatus): boolean =>
  a === b || (a.state === b.state && a.detail === b.detail)
