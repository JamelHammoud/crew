import type { Attachment } from '../../../shared/attachments'
import type { BoardMentionRef } from '../../../shared/design'
import type { DocMentionRef } from '../../../shared/docs'
import type { MessageReply, SessionEvent } from '../../../shared/events'
import type { AgentMentionRef, AgentStep, FileChange, PooledAgent } from '../../../shared/llm'
import { relabelMentions, stripMention } from '../../../shared/llm'
import { agentEndReactionTarget, agentStepReactionTarget, messageReactionTarget } from '../../../shared/reactions'
import type { ThreadMeta } from '../state/store'
import { shownPages } from '../../../shared/showPage'
import { reactionGroups, type ReactionGroup } from './reactionGroups'
import { isNewDay } from './time'
import { toolAction } from './toolActions'

// A thread's standing as a task. 'done' and 'archived' record explicit calls a
// person made; 'working', 'ready', 'stopped' and 'failed' are read off the run
// history. 'ready' is finished work waiting for someone to look at it, and
// 'stopped' is a run somebody ended themselves, which is a decision rather than
// a fault and is drawn as quietly as one.
export type ThreadState = 'working' | 'ready' | 'stopped' | 'failed' | 'done' | 'archived'

export const THREAD_STATE_LABELS: Record<ThreadState, string> = {
  working: 'Working',
  ready: 'Ready for review',
  stopped: 'Stopped',
  failed: 'Failed',
  done: 'Done',
  archived: 'Archived'
}

// A thread with helpers still out is not ready for review. Its own turn may
// have ended, but the work it sent out is its work, so counting only its own
// run would land it on the badge and raise a finished toast while three
// agents are still going on its behalf.
export const threadWorking = (
  threadId: string,
  threadPrompts: Record<string, string>,
  queues: Record<string, unknown[]>,
  threads: Record<string, Pick<ThreadMeta, 'id' | 'parentThreadId'>> = {}
): boolean => {
  if (Boolean(threadPrompts[threadId]) || (queues[threadId]?.length ?? 0) > 0) return true
  return Object.values(threads).some(
    thread =>
      thread.parentThreadId === threadId && (Boolean(threadPrompts[thread.id]) || (queues[thread.id]?.length ?? 0) > 0)
  )
}

export { eventsOfThread } from '../../../shared/threads'

// Steps are held per run, so anything that wants a thread's own are gathered off
// the runs that thread started, in the order they were started.
const stepsOfRuns = (ids: Set<string>, events: SessionEvent[], steps: Record<string, AgentStep[]>): AgentStep[] => {
  const out: AgentStep[] = []
  for (const event of events) {
    if (event.kind !== 'agent.start' || !event.threadId || !ids.has(event.threadId)) continue
    out.push(...(steps[event.promptId] ?? []))
  }
  return out
}

// A thread and everything it sent out. A helper can send one out itself, so it
// is walked all the way down, and the set is grown until it stops growing rather
// than each chain being followed, so a parent named in a circle settles rather
// than locking the window.
export function threadFamily(
  threadId: string,
  threads: Record<string, Pick<ThreadMeta, 'id' | 'parentThreadId'>>
): Set<string> {
  const family = new Set([threadId])
  for (let grew = true; grew; ) {
    grew = false
    for (const thread of Object.values(threads)) {
      if (family.has(thread.id)) continue
      if (!thread.parentThreadId || !family.has(thread.parentThreadId)) continue
      family.add(thread.id)
      grew = true
    }
  }
  return family
}

export function rootThread(
  threadId: string,
  threads: Record<string, Pick<ThreadMeta, 'id' | 'parentThreadId'>>
): string {
  const seen = new Set([threadId])
  let at = threadId
  for (;;) {
    const parent = threads[at]?.parentThreadId
    if (!parent || seen.has(parent)) return at
    seen.add(parent)
    at = parent
  }
}

// The steps of a thread's own turns, and nothing a helper took. What a run is
// narrating and what its list of work says are read off these, and a helper
// keeps a list of its own: folded in, whichever of them wrote last would take
// the columns over, which is the same mistake as letting a CLI's own list run
// beside tickets the agent put up.
export const stepsOfThread = (
  threadId: string,
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>
): AgentStep[] => stepsOfRuns(new Set([threadId]), events, steps)

// What a thread changed is what it changed and what it sent out. A helper's
// edits are the thread's edits, the same reason a thread with helpers still out
// is not ready for review, so a run that split every file off to helpers would
// say nothing changed at all read the plain way.
export const stepsOfFamily = (
  threadId: string,
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  threads: Record<string, Pick<ThreadMeta, 'id' | 'parentThreadId'>>
): AgentStep[] => stepsOfRuns(threadFamily(threadId, threads), events, steps)

export function threadState(thread: ThreadMeta, events: SessionEvent[], running: boolean): ThreadState {
  if (running) return 'working'
  if (thread.status !== 'open') return thread.status
  const end = lastEnd(thread.id, events)
  if (!end || end.ok) return 'ready'
  return end.stopped ? 'stopped' : 'failed'
}

// What a thread is about, as it reads inside the thread. The card in the feed
// puts the agent's name in front of the ask, since the feed has to say where it
// went. Inside, the name is on the row already, so the mention comes out rather
// than being read twice, and a thread opened on nothing but a mention is
// nothing rather than a blank line under the name.
export const threadAsk = (
  thread: Pick<ThreadMeta, 'title' | 'titleRefs' | 'agentLabel'>,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>>
): string => stripMention(relabelMentions(thread.title, thread.titleRefs, agents), thread.agentLabel)

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

export function lastStart(
  events: SessionEvent[],
  promptId: string | undefined
): Extract<SessionEvent, { kind: 'agent.start' }> | undefined {
  if (!promptId) return undefined
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.kind === 'agent.start' && e.promptId === promptId) return e
  }
  return undefined
}

export function endPreview(end: Extract<SessionEvent, { kind: 'agent.end' }> | undefined): string {
  if (!end) return ''
  const reply = end.ok ? (end.text ?? '') : (end.error ?? '')
  return reply.replace(/\s+/g, ' ').trim().slice(0, 70)
}

export function thoughtPreview(text: string): string {
  const first = text.split('\n').find(line => line.trim()) ?? ''
  return first
    .replace(/^\s*(?:#{1,6}|>|[-+])\s+/, '')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// One helper a thread sent out, as it reads in the thread that sent it. The
// chip is truth and does not need the parent to say anything: it reads its own
// thread's state and its own latest step, so it reports whether or not the
// agent that sent it ever mentions it.
export interface SubagentRun {
  threadId: string
  // The name the agent made it up under, and what it is doing. Both are that
  // agent's own words, written the moment it sent the work out.
  name: string
  subject: string
  agentId: string
  ok?: boolean
  ms?: number
  // Stopping a run stops the helpers it sent out, so this is the ordinary way a
  // helper ends rather than an edge of it.
  stopped?: boolean
}

// What an agent put on the screen, as it reads in the thread afterwards. The
// row is the way back to it once the run that made it has scrolled away, so it
// carries the addresses rather than tabs that may have been closed since.
export interface Shown {
  pages: string[]
  title: string
}

export interface ThreadItem {
  key: string
  ts: number
  kind: 'message' | 'reply' | 'note' | 'thinking' | 'tool' | 'subagent' | 'page'
  author: string
  authorId?: string
  self: boolean
  text: string
  streaming: boolean
  promptId?: string
  agentId?: string
  error?: string
  // A run somebody ended. It reads as the record it is rather than in the color
  // a failure wears, since nothing went wrong and somebody already knows.
  stopped?: boolean
  // The mark this reads under, in place of the pet. A helper's own thread is
  // the one place an agent's words are not the agent's: they are the helper's,
  // so they stand under the name it was made up with and the mark drawn from
  // its id.
  helperSeed?: string
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
  runs?: SubagentRun[]
  shown?: Shown
}

const sameList = <T>(
  a: T[] | undefined,
  b: T[] | undefined,
  same: (one: T, two: T) => boolean
): boolean => {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((one, index) => same(one, b[index]))
}

const sameText = (a: string, b: string): boolean => a === b

export const sameShown = (a: Shown | undefined, b: Shown | undefined): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  return a.title === b.title && sameList(a.pages, b.pages, sameText)
}

const sameSubagentRun = (a: SubagentRun, b: SubagentRun): boolean =>
  a.threadId === b.threadId &&
  a.name === b.name &&
  a.subject === b.subject &&
  a.agentId === b.agentId &&
  a.ok === b.ok &&
  a.ms === b.ms &&
  a.stopped === b.stopped

const sameReaction = (a: ReactionGroup, b: ReactionGroup): boolean =>
  a.emoji === b.emoji && a.count === b.count && a.self === b.self && sameList(a.names, b.names, sameText)

export function sameItem(a: ThreadItem, b: ThreadItem): boolean {
  if (a === b) return true
  return (
    a.key === b.key &&
    a.ts === b.ts &&
    a.kind === b.kind &&
    a.author === b.author &&
    a.authorId === b.authorId &&
    a.self === b.self &&
    a.text === b.text &&
    a.streaming === b.streaming &&
    a.promptId === b.promptId &&
    a.agentId === b.agentId &&
    a.error === b.error &&
    a.stopped === b.stopped &&
    a.helperSeed === b.helperSeed &&
    a.name === b.name &&
    a.detail === b.detail &&
    a.output === b.output &&
    a.subagent === b.subagent &&
    a.route === b.route &&
    a.reactionTargetId === b.reactionTargetId &&
    a.editedTs === b.editedTs &&
    a.voice === b.voice &&
    a.files === b.files &&
    a.attachments === b.attachments &&
    a.mentionRefs === b.mentionRefs &&
    a.docMentions === b.docMentions &&
    a.boardMentions === b.boardMentions &&
    a.replyTo === b.replyTo &&
    sameShown(a.shown, b.shown) &&
    sameList(a.runs, b.runs, sameSubagentRun) &&
    sameList(a.reactions, b.reactions, sameReaction)
  )
}

export const sameItems = (a: ThreadItem[], b: ThreadItem[]): boolean => sameList(a, b, sameItem)

export const sameSubagentRuns = (a: SubagentRun[], b: SubagentRun[]): boolean => sameList(a, b, sameSubagentRun)

// Somebody typing three lines in a row is one person talking, so the lines
// after the first drop the face and the name and close up under it. Seven
// minutes is where the run breaks, long enough to hold a train of thought and
// short enough that coming back after lunch says the time again. A message with
// something of its own to say keeps its head: a reply names what it answers,
// and a spoken one says it was spoken.
const RUN_GAP = 7 * 60 * 1000

export function sameRun(before: ThreadItem | undefined, item: ThreadItem): boolean {
  if (!before || before.kind !== 'message' || item.kind !== 'message') return false
  if (item.replyTo || item.voice) return false
  if ((before.authorId ?? before.author) !== (item.authorId ?? item.author)) return false
  if (isNewDay(before.ts, item.ts)) return false
  return item.ts - before.ts < RUN_GAP
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
  if (a.promptId !== b.promptId) return false
  if (a.kind === 'thinking' && b.kind === 'thinking') return true
  if (a.kind !== 'tool' || b.kind !== 'tool') return false
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
  const written = step.text
  return {
    key: `${promptId}:${step.id}`,
    ts: step.ts,
    kind: step.kind === 'thinking' ? 'thinking' : 'reply',
    author,
    self: false,
    text: written,
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

const runOfPages = (events: SessionEvent[]): Map<string, string> => {
  const runs = new Map<string, string>()
  let open: string | undefined
  for (const event of events) {
    if (event.kind === 'agent.start') open = event.promptId
    if (event.kind === 'agent.end' && event.promptId === open) open = undefined
    if (event.kind === 'page.shown') {
      const run = event.promptId ?? open
      if (run) runs.set(event.id, run)
    }
  }
  return runs
}

// Every name an agent wrote under is read back off its id, so a rename shows on
// work it did before the rename instead of leaving the old name behind.
export function buildThread(
  events: SessionEvent[],
  steps: Record<string, AgentStep[]>,
  selfId: string,
  agents: Array<Pick<PooledAgent, 'id' | 'label'>> = [],
  // Who the agent's own words read under here. Inside a helper's own thread the
  // work is the helper's, so it carries no agent id at all: nothing looks it up
  // as a member or as an agent, which is what leaves it standing under its own
  // name and its own mark rather than under the machine that ran it.
  as?: { name: string; seed: string }
): ThreadItem[] {
  const labelOf = (agentId: string, written: string) => agents.find(a => a.id === agentId)?.label ?? written
  const wroteIt = (agentId: string, written: string) =>
    as ? { author: as.name, helperSeed: as.seed } : { author: labelOf(agentId, written), authorId: agentId }
  const { ended, started, routes, pageRuns, reactions, returned } = threadIndex(events, selfId)
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'subagent.started') {
      const home = returned.get(event.threadId)
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'subagent',
        author: labelOf(event.agentId, event.agentLabel),
        authorId: event.agentId,
        self: false,
        text: '',
        streaming: false,
        runs: [
          {
            threadId: event.threadId,
            name: event.name,
            subject: event.subject,
            agentId: event.agentId,
            ok: home?.ok,
            ms: home?.ms,
            stopped: home?.stopped
          }
        ]
      })
    }
    if (event.kind === 'page.shown') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'page',
        ...wroteIt(event.agentId, event.agentLabel),
        agentId: event.agentId,
        self: false,
        text: '',
        streaming: false,
        promptId: pageRuns.get(event.id),
        shown: { pages: shownPages(event), title: event.title }
      })
    }
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
      const said = wroteIt(event.agentId, event.agentLabel)
      for (const step of runSteps) {
        const item = stepItem(step, said.author, event.promptId, live)
        if (item) items.push({ ...item, agentId: event.agentId, ...said })
      }
    }
    if (event.kind === 'agent.end') {
      const wrote = (steps[event.promptId] ?? []).some(step => step.kind === 'text' && step.text)
      if (!event.ok || !wrote) {
        items.push({
          key: event.id,
          ts: event.ts,
          kind: 'reply',
          ...wroteIt(event.agentId, event.agentLabel),
          agentId: event.agentId,
          self: false,
          text: event.ok ? (event.text ?? '') : (event.error ?? 'Something went wrong.'),
          streaming: false,
          error: event.ok ? undefined : (event.error ?? 'error'),
          stopped: event.stopped,
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
  return foldRuns(items.sort((a, b) => a.ts - b.ts))
}

// Four helpers sent out in one breath are one line and not four. The chips are
// a way in rather than a report, so they close up the way a run of the same
// tool does.
function foldRuns(items: ThreadItem[]): ThreadItem[] {
  const out: ThreadItem[] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (item.kind === 'subagent' && last?.kind === 'subagent') {
      out[out.length - 1] = { ...last, runs: [...(last.runs ?? []), ...(item.runs ?? [])] }
      continue
    }
    out.push(item)
  }
  return out
}
