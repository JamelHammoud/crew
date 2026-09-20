import type { Attachment } from './attachments'
import type { BoardMentionRef } from './design'
import type { DocMentionRef, DocScope } from './docs'
import type { AgentMentionRef, AgentSettings, AgentStep } from './llm'
import type { MemberMentionRef } from './people'
import type { CrewPlugin } from './plugins'
import type { ReactionEmoji } from './reactions'
import type { Cadence } from './schedules'
import type { TicketEvent } from './tickets'
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
      // 'voice' says this one was said out loud rather than typed. A spoken
      // thread can still be written in, so it is the message that carries it.
      voice?: boolean
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
  // thread as well as on each message, because it is what the agent is told
  // about how to answer, and that holds for the whole conversation.
  // The four subagent fields say a thread was sent out by another one. They are
  // all optional, so a log written before any of this reads back unchanged.
  // aside is the thread a question on the side was asked from. It is always a
  // ghost, so it is never written down, and it answers in the panel rather than
  // as a card in the chat.
  // forkedFrom is the thread this one carried on from, and forkedAt the moment
  // it was carried. The pair is what the run of talk before the fork is folded
  // back out of, so nothing about it is copied and it replays for free.
  | {
      id: string
      ts: number
      kind: 'thread.started'
      threadId: string
      agentId: string
      agentLabel: string
      title: string
      titleRefs?: AgentMentionRef[]
      byName: string
      boardId?: string
      mode?: ThreadMode
      ghost?: boolean
      voice?: boolean
      tickets?: boolean
      aside?: string
      forkedFrom?: string
      forkedAt?: number
      parentThreadId?: string
      parentPromptId?: string
      helper?: string
      subject?: string
      depth?: number
      helperModel?: string
      notify?: boolean
    }
  | { id: string; ts: number; kind: 'thread.plan'; threadId: string; text: string; agentId: string; agentLabel: string }
  | { id: string; ts: number; kind: 'thread.implement'; threadId: string; byName: string }
  // Superseded by thread.status; still emitted-compatible and replayed so old
  // event logs and old peers keep working.
  | { id: string; ts: number; kind: 'thread.archived'; threadId: string; byName: string }
  // A hand-off nobody made carries no name: the thread moved because a run fell
  // over and the fallback took it, so there is no one to say it was them.
  | {
      id: string
      ts: number
      kind: 'thread.agent'
      threadId: string
      agentId: string
      agentLabel: string
      byName?: string
    }
  // Who takes over when a run in this thread ends badly. No agent means it was
  // taken off. Nothing reads it until a run fails, so the thread queues and
  // steers exactly as it did before one was named.
  | {
      id: string
      ts: number
      kind: 'thread.fallback'
      threadId: string
      agentId?: string
      agentLabel?: string
      byName: string
    }
  | { id: string; ts: number; kind: 'thread.status'; threadId: string; status: ThreadStatus; byName: string }
  | { id: string; ts: number; kind: 'thread.renamed'; threadId: string; title: string; byName: string }
  | { id: string; ts: number; kind: 'thread.deleted'; threadId: string; byName: string }
  | { id: string; ts: number; kind: 'todo.added'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.edited'; todoId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'todo.removed'; todoId: string; byName: string }
  | { id: string; ts: number; kind: 'todo.checked'; todoId: string; checked: boolean; byName: string }
  | { id: string; ts: number; kind: 'todo.started'; todoId: string; threadId: string; byName: string }
  | {
      id: string
      ts: number
      kind: 'tool.added'
      toolId: string
      name: string
      mark: string
      action: ToolAction
      byName: string
    }
  | {
      id: string
      ts: number
      kind: 'tool.edited'
      toolId: string
      name: string
      mark: string
      action: ToolAction
      byName: string
    }
  | { id: string; ts: number; kind: 'tool.removed'; toolId: string; byName: string }
  | { id: string; ts: number; kind: 'memory.added'; memoryId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'memory.edited'; memoryId: string; text: string; agentId?: string; byName: string }
  | { id: string; ts: number; kind: 'memory.removed'; memoryId: string; byName: string }
  | { id: string; ts: number; kind: 'memory.setting'; enabled: boolean; byName: string }
  | {
      id: string
      ts: number
      kind: 'plugin.added'
      pluginId: string
      plugin: Omit<CrewPlugin, 'id' | 'by' | 'byAgentId' | 'ts'>
      agentId?: string
      byName: string
    }
  | { id: string; ts: number; kind: 'plugin.removed'; pluginId: string; byName: string }
  | {
      id: string
      ts: number
      kind: 'schedule.added'
      scheduleId: string
      name: string
      mark: string
      when: Cadence
      action: ToolAction
      zone: string
      agentId?: string
      byName: string
    }
  | {
      id: string
      ts: number
      kind: 'schedule.edited'
      scheduleId: string
      name: string
      mark: string
      when: Cadence
      action: ToolAction
      zone: string
      byName: string
    }
  | { id: string; ts: number; kind: 'schedule.removed'; scheduleId: string; byName: string }
  | { id: string; ts: number; kind: 'schedule.paused'; scheduleId: string; paused: boolean; byName: string }
  | { id: string; ts: number; kind: 'schedule.ran'; scheduleId: string; threadId?: string; byName: string }
  // How big a file the crew may send. It is one number for everyone, since the
  // host is what turns a big one away and everything sent lands in the folder
  // they share.
  | { id: string; ts: number; kind: 'attachment.limit'; mb: number; byName: string }
  // A run of a role. These two last, the way agent.start does: they are the
  // record of work, and they are what the chips in a thread are built from.
  // The end carries no text, because the child's answer is already in the log
  // as that thread's own agent.end and writing it twice doubles for nothing.
  | {
      id: string
      ts: number
      kind: 'subagent.started'
      threadId: string
      parentThreadId: string
      parentPromptId: string
      // The name the agent made it up under, and what it is doing, both in its
      // own words. Nothing about a helper is written down before it exists.
      name: string
      subject: string
      agentId: string
      agentLabel: string
      byName: string
    }
  | {
      id: string
      ts: number
      kind: 'subagent.ended'
      threadId: string
      parentThreadId: string
      promptId?: string
      ok: boolean
      ms: number
      stopped?: boolean
    }
  | {
      id: string
      ts: number
      kind: 'subagent.said'
      threadId: string
      parentThreadId: string
      name: string
      text: string
    }
  | {
      id: string
      ts: number
      kind: 'subagent.returned'
      threadId: string
      parentThreadId: string
      endedId: string
    }
  // What an agent asked the app to show. It is written down rather than said
  // once, because the row it draws in the thread is the way back to it after
  // the run that made it has scrolled away.
  | {
      id: string
      ts: number
      kind: 'page.shown'
      // Everything the call named, in the order it named it: a file url for
      // one on the disk, an address for a page.
      pages?: string[]
      // The one a crew wrote down before a call could name several. It is read
      // and never written, so a thread from before this keeps its row.
      url?: string
      promptId?: string
      threadId: string
      // The agent's own line about what it is, or the file's name and the site's
      // host where it said nothing about one page.
      title: string
      agentId: string
      agentLabel: string
    }
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
  // An emoji the crew drew themselves. The picture is kept beside the session and
  // everyone draws their own copy, so what rides here is its name and its file.
  | { id: string; ts: number; kind: 'emoji.added'; emojiId: string; name: string; file: string; byName: string }
  | { id: string; ts: number; kind: 'emoji.renamed'; emojiId: string; name: string; byName: string }
  | { id: string; ts: number; kind: 'emoji.removed'; emojiId: string; byName: string }
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
      messageId?: string
      byName: string
      threadId?: string
      reactionIds?: string[]
    }
  | {
      id: string
      ts: number
      kind: 'agent.step'
      promptId: string
      agentId: string
      agentLabel: string
      step: AgentStep
      threadId?: string
    }
  | {
      id: string
      ts: number
      kind: 'agent.end'
      promptId: string
      agentId: string
      agentLabel: string
      ok: boolean
      text?: string
      error?: string
      // A run somebody stopped, which is not a run that went wrong. The host is
      // the one that asked for it, so it is the one that can say so: what comes
      // back off a killed CLI is whatever that CLI says about being killed, and
      // reading the word out of an error string would be a guess.
      stopped?: boolean
      threadId?: string
      ms?: number
      tokens?: number
      cost?: number
    }
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
  | {
      id: string
      ts: number
      kind: 'doc'
      page: string
      text: string
      title?: string
      scope?: DocScope
      byName: string
    }
  | { id: string; ts: number; kind: 'doc.titled'; page: string; title: string; byName: string }
  | { id: string; ts: number; kind: 'doc.renamed'; from: string; to: string; title?: string; byName: string }
  | { id: string; ts: number; kind: 'doc.deleted'; page: string; byName: string }
  // What an agent said about its own work. The board beside a thread is folded
  // back out of these, so they are ordinary events on the thread rather than
  // state the host keeps, and they replay on every machine for free.
  | TicketEvent

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
  'memory.added',
  'memory.edited',
  'memory.removed',
  'memory.setting',
  'plugin.added',
  'plugin.removed',
  'schedule.added',
  'schedule.edited',
  'schedule.removed',
  'schedule.paused',
  'schedule.ran',
  // The size limit rides in the snapshot the same way, so a number somebody
  // picked months ago is still the number after its event has fallen off the
  // window.
  'attachment.limit',
  // A track somebody put on the shelf is the same: it stays on the shelf, and
  // the crew does not need to scroll past the moment it arrived.
  'music.added',
  'music.removed',
  // An emoji the crew added is theirs from then on, the way a track on the shelf
  // is, so it rides in the snapshot and nobody scrolls past the moment it landed.
  'emoji.added',
  'emoji.renamed',
  'emoji.removed',
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

function lastingEvents(events: SessionEvent[]): SessionEvent[] {
  return events.filter(e => !EPHEMERAL_KINDS.has(e.kind))
}

export function trimEvents(events: SessionEvent[], limit: number): SessionEvent[] {
  const lasting = lastingEvents(events)
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

export function appendEvent(events: SessionEvent[], event: SessionEvent, limit: number): SessionEvent[] {
  if (EPHEMERAL_KINDS.has(event.kind)) return events
  if (event.kind === 'agent.step') return startedIn(events, event.promptId) ? [...events, event] : events
  const cut = events.findIndex(e => e.kind !== 'agent.step')
  if (cut < 0 || countedEvents(events) < limit) return [...events, event]
  const gone = events[cut]
  const rest = events.slice(cut + 1)
  const kept =
    gone.kind === 'agent.start' && !startedIn(rest, gone.promptId)
      ? rest.filter(e => e.kind !== 'agent.step' || e.promptId !== gone.promptId)
      : rest
  kept.push(event)
  return kept
}

function startedIn(events: SessionEvent[], promptId: string): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i]
    if (event.kind === 'agent.start' && event.promptId === promptId) return true
  }
  return false
}

function countedEvents(events: SessionEvent[]): number {
  let count = 0
  for (const event of events) {
    if (event.kind !== 'agent.step') count++
  }
  return count
}

// Two runs of events into one, in the order they happened. A page of the chat
// is older than everything already held and goes on the front, but one thread
// read back out of the log reaches across whatever else has happened since, so
// it is merged by when rather than pushed anywhere. Anything already held wins
// the tie and its own id, since what arrived live is the fresher copy.
export function mergeEvents(older: SessionEvent[], held: SessionEvent[]): SessionEvent[] {
  const ids = new Set(held.map(event => event.id))
  const fresh = older.filter(event => !ids.has(event.id))
  if (fresh.length === 0) return held
  const out: SessionEvent[] = []
  let i = 0
  for (const event of held) {
    while (i < fresh.length && fresh[i].ts <= event.ts) out.push(fresh[i++])
    out.push(event)
  }
  for (; i < fresh.length; i++) out.push(fresh[i])
  return out
}

// The page before the one somebody is holding, and whether anything stands
// behind it. Named with no `before` it is the tail, which is what the snapshot
// carries, so the same rule decides both what arrives first and what arrives
// when the reader scrolls back into it.
export function olderEvents(
  events: SessionEvent[],
  before: string | undefined,
  limit: number
): { events: SessionEvent[]; more: boolean } {
  const end = before ? events.findIndex(e => e.id === before) : events.length
  if (end <= 0) return { events: [], more: false }
  const head = events.slice(0, end)
  const kept = trimEvents(head, limit)
  const first = kept[0]
  const start = first ? head.indexOf(first) : head.length
  return { events: kept, more: lastingEvents(head.slice(0, start)).length > 0 }
}
