import type { Attachment } from '../../../shared/attachments'
import type { BoardMentionRef } from '../../../shared/design'
import type { DocMentionRef } from '../../../shared/docs'
import type { MessageReply, SessionEvent } from '../../../shared/events'
import type { AgentMentionRef, AgentStep, FileChange, PooledAgent } from '../../../shared/llm'
import { agentEndReactionTarget, agentStepReactionTarget, messageReactionTarget } from '../../../shared/reactions'
import type { ThreadMeta } from '../state/store'
import { reactionGroups, type ReactionGroup } from './reactionGroups'
import { isNewDay } from './time'
import { toolAction } from './toolActions'

// A thread's standing as a task. 'done' and 'archived' record explicit calls a
// person made; 'working', 'ready', and 'failed' are read off the run history.
// 'ready' is finished work waiting for someone to look at it.
export type ThreadState = 'working' | 'ready' | 'failed' | 'done' | 'archived'

export const THREAD_STATE_LABELS: Record<ThreadState, string> = {
  working: 'Working',
  ready: 'Ready for review',
  failed: 'Failed',
  done: 'Done',
  archived: 'Archived'
}

export const threadWorking = (
  threadId: string,
  threadPrompts: Record<string, string>,
  queues: Record<string, unknown[]>
): boolean => Boolean(threadPrompts[threadId]) || (queues[threadId]?.length ?? 0) > 0

export function threadState(thread: ThreadMeta, events: SessionEvent[], running: boolean): ThreadState {
  if (running) return 'working'
  if (thread.status !== 'open') return thread.status
  const end = lastEnd(thread.id, events)
  return end && !end.ok ? 'failed' : 'ready'
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const stripMention = (text: string, label: string): string =>
  text
    .replace(new RegExp(`@${escapeRegExp(label)}(?![\\w-])`, 'i'), ' ')
    .replace(/\s+/g, ' ')
    .trim()

export function lastEnd(
  threadId: string,
  events: SessionEvent[]
): Extract<SessionEvent, { kind: 'agent.end' }> | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.kind === 'agent.end' && e.threadId === threadId) return e
  }
  return undefined
}

export function endPreview(end: Extract<SessionEvent, { kind: 'agent.end' }> | undefined): string {
  if (!end) return ''
  const reply = end.ok ? (end.text ?? '') : (end.error ?? '')
  return reply.replace(/\s+/g, ' ').trim().slice(0, 70)
}

export interface ThreadItem {
  key: string
  ts: number
  kind: 'message' | 'reply' | 'note' | 'thinking' | 'tool'
  author: string
  authorId?: string
  self: boolean
  text: string
  streaming: boolean
  promptId?: string
  agentId?: string
  error?: string
  name?: string
  detail?: string
  output?: string
  subagent?: boolean
  files?: FileChange[]
  attachments?: Attachment[]
  mentionRefs?: AgentMentionRef[]
  docMentions?: DocMentionRef[]
  boardMentions?: BoardMentionRef[]
  route?: MessageRoute
  reactionTargetId?: string
  reactions?: ReactionGroup[]
  replyTo?: MessageReply
  editedTs?: number
  voice?: boolean
}

// How a message reached the agent, shown on the message itself: it was folded
// into a run already in flight ('steering' while that run lasts, then
// 'steered'), or it is still waiting for a turn of its own ('queued').
export type MessageRoute = 'queued' | 'steering' | 'steered'

// A run of the same tool over and over is one line of news, not ten. Only a run
// long enough to be clutter is folded up; a pair stays where a reader can see it.
const GROUP_MIN = 3

export interface StepBlock {
  key: string
  ts: number
  items: ThreadItem[]
}

const sameStep = (a: ThreadItem, b: ThreadItem): boolean => {
  if (a.kind !== 'tool' || b.kind !== 'tool' || a.promptId !== b.promptId) return false
  const one = toolAction(a.name, a.subagent)
  const two = toolAction(b.name, b.subagent)
  return one.icon === two.icon && one.done === two.done
}

export function stepBlocks(items: ThreadItem[]): StepBlock[] {
  const runs: ThreadItem[][] = []
  for (const item of items) {
    const last = runs[runs.length - 1]
    if (last && sameStep(last[last.length - 1], item)) last.push(item)
    else runs.push([item])
  }
  return runs.flatMap(run =>
    run.length >= GROUP_MIN
      ? [{ key: run[0].key, ts: run[0].ts, items: run }]
      : run.map(item => ({ key: item.key, ts: item.ts, items: [item] }))
  )
}

export function describeStep(step: AgentStep | undefined): string {
  if (!step) return 'Starting'
  if (step.kind === 'thinking') return 'Thinking'
  if (step.kind === 'text') return 'Writing'
  if (step.status === 'running') return toolAction(step.name, step.kind === 'subagent').run
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
      output: step.output,
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
    promptId,
    reactionTargetId: agentStepReactionTarget(promptId, step.id)
  }
}

// A queued message stops being newsworthy the moment its own run starts, but a
// steered one keeps its badge for good: nothing else in the thread records that
// it was answered inside someone else's run.
const routeBadge = (
  route: Extract<SessionEvent, { kind: 'message.route' }> | undefined,
  started: Set<string>,
  ended: Set<string>
): MessageRoute | undefined => {
  if (!route) return undefined
  if (route.mode === 'steered') return ended.has(route.promptId) ? 'steered' : 'steering'
  return started.has(route.promptId) ? undefined : 'queued'
}

// Every name an agent wrote under is read back off its id, so a rename shows on
// work it did before the rename instead of leaving the old name behind.
export function buildThread(
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  selfId: string,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>> = []
): ThreadItem[] {
  const labelOf = (agentId: string, written: string) => agents.find(a => a.id === agentId)?.label ?? written
  const ended = new Set(events.filter(e => e.kind === 'agent.end').map(e => e.promptId))
  const started = new Set(events.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  // The last route wins: a steer the agent turned down is re-emitted as queued.
  const routes = new Map<string, Extract<SessionEvent, { kind: 'message.route' }>>()
  for (const event of events) {
    if (event.kind === 'message.route') routes.set(event.messageId, event)
  }
  const reactions = reactionGroups(events, selfId)
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'message') {
      const route = routes.get(event.id)
      items.push({
        key: event.id,
        ts: event.ts,
        kind: event.authorId === 'crew' ? 'note' : 'message',
        author: labelOf(event.authorId, event.authorName),
        authorId: event.authorId,
        self: event.authorId === selfId,
        text: event.text,
        streaming: false,
        attachments: event.attachments,
        mentionRefs: event.mentionRefs,
        docMentions: event.docMentions,
        boardMentions: event.boardMentions,
        replyTo: event.replyTo,
        editedTs: event.editedTs,
        voice: event.voice,
        route: routeBadge(route, started, ended),
        reactionTargetId: event.authorId === 'crew' ? undefined : messageReactionTarget(event.id),
        reactions: event.authorId === 'crew' ? undefined : reactions.get(messageReactionTarget(event.id))
      })
    }
    if (event.kind === 'thread.agent') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'note',
        author: 'crew',
        self: false,
        text: `${event.byName} handed this thread to ${labelOf(event.agentId, event.agentLabel)}`,
        streaming: false
      })
    }
    if (event.kind === 'agent.start') {
      const live = !ended.has(event.promptId)
      const runSteps = steps[event.promptId] ?? []
      for (const step of runSteps) {
        const item = stepItem(step, labelOf(event.agentId, event.agentLabel), event.promptId, live)
        if (item) items.push({ ...item, agentId: event.agentId, authorId: event.agentId })
      }
    }
    if (event.kind === 'agent.end') {
      const wrote = (steps[event.promptId] ?? []).some(step => step.kind === 'text' && step.text)
      if (!event.ok || !wrote) {
        items.push({
          key: event.id,
          ts: event.ts,
          kind: 'reply',
          author: labelOf(event.agentId, event.agentLabel),
          authorId: event.agentId,
          agentId: event.agentId,
          self: false,
          text: event.ok ? (event.text ?? '') : (event.error ?? 'Something went wrong.'),
          streaming: false,
          error: event.ok ? undefined : (event.error ?? 'error'),
          reactionTargetId: agentEndReactionTarget(event.promptId),
          reactions: reactions.get(agentEndReactionTarget(event.promptId))
        })
      }
    }
  }
  for (const item of items) {
    if (item.reactionTargetId && item.reactions === undefined) {
      item.reactions = reactions.get(item.reactionTargetId)
    }
  }
  // Steps render under their run's agent.start event, so a message steered
  // into a live run would otherwise sit below steps that happened after it.
  // A stable sort by time puts every item where it actually happened while
  // keeping event-log order for same-millisecond neighbours.
  return items.sort((a, b) => a.ts - b.ts)
}
