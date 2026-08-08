import type { SessionEvent } from '../../../../shared/events'
import type { AgentMentionRef, AgentStep, PooledAgent } from '../../../../shared/llm'
import { messageReactionTarget } from '../../../../shared/reactions'
import type { ThreadMeta } from '../../state/store'
import { huddleRecords, type HuddleRecord } from '../huddle/log'
import { reactionGroups, type ReactionGroup } from '../reactionGroups'
import { sameItem, sameReactions, type ThreadItem, type ThreadState } from '../thread'

// The whole of what somebody wrote to open a thread. The title is cut to a line
// on the host, which is right for a rail row and wrong for the feed, so the card
// reads the thread's own first message instead and keeps its mentions with it.
//
// It is that message rather than a copy of it, so it carries what a message
// carries: reacting to the preview and reacting to the same line inside the
// thread is one reaction on one message, and neither place has a record of its
// own to keep in step with the other.
export interface ThreadAsk {
  text: string
  mentionRefs?: AgentMentionRef[]
  targetId?: string
  reactions?: ReactionGroup[]
}

// What somebody wrote, kept as they wrote it. Only the space nobody typed goes:
// the run at the end of a line and the blank rows at either end.
export const askPreview = (text: string): string => text.replace(/[ \t]+$/gm, '').trim()

export type FeedEntry =
  | { kind: 'msg'; key: string; ts: number; item: ThreadItem }
  | { kind: 'card'; key: string; ts: number; thread: ThreadMeta; ask?: ThreadAsk }
  | { kind: 'huddle'; key: string; ts: number; record: HuddleRecord }

export interface ThreadStatus {
  state: ThreadState
  // What the run is on right now, so the strand says the tool it is holding
  // rather than a word for the kind of work.
  step?: AgentStep
  // The moment a live run started, counted into seconds by the strand rather
  // than here, so a working thread does not draw the whole feed again once a
  // second.
  startedAt?: number
  tokens?: number
  cost?: number
  added: number
  removed: number
}

export const RESTING: ThreadStatus = { state: 'ready', added: 0, removed: 0 }

export function buildFeed(
  events: SessionEvent[],
  threads: Record<string, ThreadMeta>,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>,
  selfId: string
): FeedEntry[] {
  const list: FeedEntry[] = []
  const reactions = reactionGroups(events, selfId)
  const huddles = huddleRecords(events)
  const asks = new Map<string, ThreadAsk>()
  const cards: Array<Extract<FeedEntry, { kind: 'card' }>> = []
  for (const event of events) {
    if (event.kind === 'message' && event.threadId && !asks.has(event.threadId)) {
      const targetId = event.authorId === 'crew' ? undefined : messageReactionTarget(event.id)
      asks.set(event.threadId, {
        text: askPreview(event.text),
        mentionRefs: event.mentionRefs,
        targetId,
        reactions: targetId ? reactions.get(targetId) : undefined
      })
    }
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
      const card: Extract<FeedEntry, { kind: 'card' }> = {
        kind: 'card',
        key: event.id,
        ts: event.ts,
        thread: threads[event.threadId]
      }
      cards.push(card)
      list.push(card)
    }
    if (event.kind === 'huddle.started') {
      const record = huddles.get(event.huddleId)
      if (record) list.push({ kind: 'huddle', key: event.id, ts: event.ts, record })
    }
  }
  for (const card of cards) card.ask = asks.get(card.thread.id)
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
  if (a.kind === 'card')
    return (
      b.kind === 'card' &&
      a.thread === b.thread &&
      a.ask?.text === b.ask?.text &&
      a.ask?.mentionRefs === b.ask?.mentionRefs
    )
  return b.kind === 'huddle' && sameHuddleRecord(a.record, b.record)
}

// Every field by name, the way `sameItem` names every one of a message's: one
// left out is a card that quietly stops saying what its run is doing.
export const sameStatus = (a: ThreadStatus, b: ThreadStatus): boolean =>
  a === b ||
  (a.state === b.state &&
    a.step === b.step &&
    a.startedAt === b.startedAt &&
    a.tokens === b.tokens &&
    a.cost === b.cost &&
    a.added === b.added &&
    a.removed === b.removed)
