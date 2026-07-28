import type { Attachment } from './attachments'
import type { BoardMentionRef } from './design'
import type { DocMentionRef } from './docs'
import type { AgentMentionRef, AgentSettings, AgentStep } from './llm'
import type { MemberMentionRef } from './people'
import type { ReactionEmoji } from './reactions'
import type { ToolAction } from './toolbox'

// 'open' means the thread still wants attention: either an agent is working or
// the result is waiting for someone to look at it. 'done' is an explicit human
// (or agent) sign-off; 'archived' hides the thread without losing it.
export type ThreadStatus = 'open' | 'done' | 'archived'

// A thread in 'plan' mode asks for a plan and nothing else. It becomes 'build'
// the moment someone implements that plan, and stays there.
export type ThreadMode = 'plan' | 'build'

// A todo is a pre-thread: one line of intended work, no run behind it. 'Do'
// turns it into a real thread; checking it off records work done by hand.
export interface Todo {
  id: string
  text: string
  agentId?: string
  createdBy: string
  ts: number
  checked: boolean
  checkedTs?: number
}

export interface MessageReply {
  targetId: string
  authorId: string
  authorName: string
  text: string
  deleted?: boolean
}

export type SessionEvent =
  | {
      id: string
      ts: number
      kind: 'message'
      authorId: string
      authorName: string
      text: string
      mentions: string[]
      // Absent on messages written before mentions carried ids; those fall back
      // to matching on the name as written.
      mentionRefs?: AgentMentionRef[]
      memberMentionRefs?: MemberMentionRef[]
      docMentions?: DocMentionRef[]
      boardMentions?: BoardMentionRef[]
      threadId?: string
      attachments?: Attachment[]
      replyTo?: MessageReply
      editedTs?: number
    }
  | { id: string; ts: number; kind: 'message.deleted'; messageId: string }
  | {
      id: string
      ts: number
      kind: 'message.edited'
      messageId: string
      text: string
      mentionRefs?: AgentMentionRef[]
      memberMentionRefs?: MemberMentionRef[]
      docMentions?: DocMentionRef[]
      boardMentions?: BoardMentionRef[]
    }
  | {
      id: string
      ts: number
      kind: 'message.reaction'
      targetId: string
      targetAuthorId: string
      targetAuthorName: string
      memberId: string
      memberName: string
      emoji: ReactionEmoji
      active: boolean
      threadId?: string
    }
  | {
      id: string
      ts: number
      kind: 'message.route'
      messageId: string
      threadId: string
      promptId: string
      mode: 'queued' | 'steered'
    }
  // 'ghost' says the thread belongs to the one window that opened it. Nothing
  // carrying it is ever written down or sent anywhere else, so it is only ever
  // read live, by that window.
  // 'voice' says the thread was spoken rather than typed. It rides on the
  // thread rather than on each message, because it is what the agent is told
  // about how to answer, and that holds for the whole conversation.
  | { id: string; ts: number; kind: 'thread.started'; threadId: string; agentId: string; agentLabel: string; title: string; titleRefs?: AgentMentionRef[]; byName: string; boardId?: string; mode?: ThreadMode; ghost?: boolean; voice?: boolean }
  | { id: string; ts: number; kind: 'thread.plan'; threadId: string; text: string; agentId: string; agentLabel: string }
  | { id: string; ts: number; kind: 'thread.implement'; threadId: string; byName: string }
  // Superseded by thread.status; still emitted-compatible and replayed so old
  // event logs and old peers keep working.
  | { id: string; ts: number; kind: 'thread.archived'; threadId: string; byName: string }
  | { id: string; ts: number; kind: 'thread.agent'; threadId: string; agentId: string; agentLabel: string; byName: string }
  | { id: string; ts: number; kind: 'thread.status'; threadId: string; status: ThreadStatus; byName: string }
  | { id: string; ts: number; kind: 'todo.added'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.edited'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.removed'; todoId: string; byName: string }
  | { id: string; ts: number; kind: 'todo.checked'; todoId: string; checked: boolean; byName: string }
  | { id: string; ts: number; kind: 'todo.started'; todoId: string; threadId: string; byName: string }
  | { id: string; ts: number; kind: 'tool.added'; toolId: string; name: string; mark: string; action: ToolAction; byName: string }
  | { id: string; ts: number; kind: 'tool.edited'; toolId: string; name: string; mark: string; action: ToolAction; byName: string }
  | { id: string; ts: number; kind: 'tool.removed'; toolId: string; byName: string }
  | {
      id: string
      ts: number
      kind: 'music.added'
      trackId: string
      name: string
      file: string
      seconds: number
      byName: string
    }
  | { id: string; ts: number; kind: 'music.removed'; trackId: string; byName: string }
  | { id: string; ts: number; kind: 'playlist.added'; playlistId: string; name: string; byName: string }
  | { id: string; ts: number; kind: 'playlist.removed'; playlistId: string; byName: string }
  | { id: string; ts: number; kind: 'playlist.renamed'; playlistId: string; name: string; byName: string }
  | {
      id: string
      ts: number
      kind: 'playlist.track'
      playlistId: string
      trackId: string
      // Whether the track went in or came out.
      on: boolean
      byName: string
    }
  // Somebody's best at one of the games, and only ever their best. A round that
  // beat nothing is never written down.
  | { id: string; ts: number; kind: 'game.score'; gameId: string; score: number; byName: string }
  | {
      id: string
      ts: number
      kind: 'agent.start'
      promptId: string
      agentId: string
      agentLabel: string
      promptText: string
      byName: string
      threadId?: string
      reactionIds?: string[]
    }
  | { id: string; ts: number; kind: 'agent.step'; promptId: string; agentId: string; agentLabel: string; step: AgentStep; threadId?: string }
  | { id: string; ts: number; kind: 'agent.end'; promptId: string; agentId: string; agentLabel: string; ok: boolean; text?: string; error?: string; threadId?: string }
  | { id: string; ts: number; kind: 'person.joined'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'person.left'; memberId: string; name: string }
  | { id: string; ts: number; kind: 'agent.online'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.offline'; agentId: string; label: string }
  | { id: string; ts: number; kind: 'agent.updated'; agentId: string; settings: AgentSettings }
  // The record of a call, not the call itself. Who started it, who came, and
  // how long it ran. Nothing about the media or the handshake is ever written.
  | { id: string; ts: number; kind: 'huddle.started'; huddleId: string; byId: string; byName: string }
  | { id: string; ts: number; kind: 'huddle.joined'; huddleId: string; memberId: string; name: string }
  | { id: string; ts: number; kind: 'huddle.ended'; huddleId: string; ms: number }
  | { id: string; ts: number; kind: 'huddle.deleted'; huddleId: string }
  | { id: string; ts: number; kind: 'doc'; page: string; text: string; title?: string; byName: string }
  | { id: string; ts: number; kind: 'doc.titled'; page: string; title: string; byName: string }
  | { id: string; ts: number; kind: 'doc.renamed'; from: string; to: string; title?: string; byName: string }
  | { id: string; ts: number; kind: 'doc.deleted'; page: string; byName: string }

export const SYSTEM_AUTHOR_ID = 'crew'
export const SYSTEM_AUTHOR_NAME = 'crew'

const EPHEMERAL_KINDS = new Set([
  'doc',
  'doc.titled',
  'doc.renamed',
  'doc.deleted',
  'message.edited',
  'person.joined',
  'person.left',
  'agent.online',
  'agent.offline',
  'agent.updated',
  // Todos ride in the snapshot as first-class state (like docs and queues), so
  // their events only matter live; keeping them out of the window also stops a
  // weeks-old pending todo from falling off the end of the trim.
  'todo.added',
  'todo.edited',
  'todo.removed',
  'todo.checked',
  'todo.started',
  // The toolbox rides in the snapshot for the same reason: a tool built weeks
  // ago is still a button, long after its event has fallen off the window.
  'tool.added',
  'tool.edited',
  'tool.removed',
  // A track somebody put on the shelf is the same: it stays on the shelf, and
  // the crew does not need to scroll past the moment it arrived.
  'music.added',
  'music.removed',
  // A playlist rides in the snapshot the same way, so the list somebody wrote
  // months ago is still a list.
  'playlist.added',
  'playlist.removed',
  'playlist.renamed',
  'playlist.track',
  // A high score is a row on a board rather than a moment in the chat, so it
  // rides in the snapshot and nobody scrolls past it.
  'game.score'
])

// The call one event belongs to, for the three that make up the record of a
// call. Deleting a huddle block takes all three out, so every side of it asks
// the same question rather than listing the kinds again.
export function huddleRecordId(event: SessionEvent): string | undefined {
  if (event.kind === 'huddle.started' || event.kind === 'huddle.joined' || event.kind === 'huddle.ended') {
    return event.huddleId
  }
  return undefined
}

// A reply carries the words it was quoting rather than a pointer to them, so a
// message being deleted has to reach every reply that quoted it. The host does
// this as a delete lands and again when the log is read back, and each member
// does it to their own copy, so all three read the same way.
export function markDeletedReplies(events: SessionEvent[], targets: Set<string>): SessionEvent[] {
  if (targets.size === 0) return events
  return events.map(event =>
    event.kind === 'message' && event.replyTo && !event.replyTo.deleted && targets.has(event.replyTo.targetId)
      ? { ...event, replyTo: { ...event.replyTo, deleted: true } }
      : event
  )
}

export function trimEvents(events: SessionEvent[], limit: number): SessionEvent[] {
  const lasting = events.filter(e => !EPHEMERAL_KINDS.has(e.kind))
  let count = 0
  let start = lasting.length
  for (let i = lasting.length - 1; i >= 0; i--) {
    if (lasting[i].kind !== 'agent.step') {
      if (count === limit) break
      count++
    }
    start = i
  }
  const kept = lasting.slice(start)
  const prompts = new Set(kept.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  return kept.filter(e => e.kind !== 'agent.step' || prompts.has(e.promptId))
}
