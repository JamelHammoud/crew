import { randomBytes, randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import {
  extensionFor,
  isImageType,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type OutgoingAttachment
} from '../shared/attachments'
import {
  docMentionRefsIn,
  docMentionsIn,
  fallbackTitle,
  pageCode,
  pageCodeOf,
  resolveDocRef,
  type DocMentionRef,
  type DocPage
} from '../shared/docs'
import {
  SYSTEM_AUTHOR_ID,
  SYSTEM_AUTHOR_NAME,
  trimEvents,
  type SessionEvent,
  type ThreadStatus,
  type Todo
} from '../shared/events'
import {
  agentId,
  resolveSettings,
  type AgentStatus,
  type AgentSettings,
  type AgentStep,
  type AgentUsage,
  type LiveRun,
  type PooledAgent,
  type RunStep
} from '../shared/llm'
import {
  agentEndReactionTarget,
  agentStepReactionTarget,
  isReactionEmoji,
  messageReactionTarget
} from '../shared/reactions'
import type { ClientMessage, QueuedItem, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
import {
  BOARD_ID,
  type DesignBoardMeta,
  type DesignDocument,
  type DesignOp,
  type DesignOpResult,
  type DesignPresence
} from '../shared/design'
import { applyDesignOps, boardSummary, type AppliedOps } from './designops'
import { Store } from './store'

interface Member {
  id: string
  name: string
  connections: Set<WebSocket>
}

interface AgentState extends Omit<PooledAgent, 'runs' | 'status'> {
  runner: WebSocket | null
  running: Set<string>
  runs: Map<string, RunState>
  dropTimer: NodeJS.Timeout | null
}

interface RunState {
  steps: Map<string, StepEntry>
  tokens: number
  startedAt: number
  entry?: QueuedPrompt
}

interface StepEntry {
  step: AgentStep
  persisted: boolean
}

interface QueuedPrompt {
  promptId: string
  agentId: string
  text: string
  byName: string
  authorId: string
  threadId: string
  mentions: string[]
  docMentions: DocMentionRef[]
  attachments: Attachment[]
  messageId: string
}

// A steer sent to a runner but not yet acknowledged. Kept so it can be turned
// back into a normal queued prompt if the run refuses it.
interface PendingSteer {
  messageId: string
  text: string
  byName: string
  authorId?: string
  threadId: string
  attachments: Attachment[]
}

interface Thread {
  id: string
  agentId: string
  agentLabel: string
  title: string
  createdBy: string
  status: ThreadStatus
  queue: QueuedPrompt[]
  running: string | null
  boardId?: string
}

interface DesignBoard {
  id: string
  name: string
  document: DesignDocument | null
  presence: Map<string, DesignPresence>
  saveTimer: NodeJS.Timeout | null
}

const THREAD_STATUSES = new Set<ThreadStatus>(['open', 'done', 'archived'])

interface PromptRef {
  agentId: string
  threadId: string
  messageId: string
}

interface ConnMeta {
  role: 'ui' | 'runner'
  memberKey: string
  agentIds: string[]
}

interface ReactionTarget {
  authorId: string
  authorName: string
  text: string
  threadId?: string
}

type ReactionEvent = Extract<SessionEvent, { kind: 'message.reaction' }>

const SNAPSHOT_EVENT_LIMIT = 500
const CONTEXT_EVENT_LIMIT = 20
const MAX_DOC_PROMPT_CHARS = 8000
const TITLE_LIMIT = 80
const CANCEL_REPORT_TIMEOUT_MS = 15000
const RESUME_GRACE_MS = 60000
const STEP_FLUSH_MS = 80
const DESIGN_SAVE_MS = 500
const DESIGN_CURSOR_STEP_MS = 140
const DESIGN_CURSOR_STEPS_MAX = 25

export class CrewSession {
  readonly code: string
  private createdAt: number
  private members = new Map<string, Member>()
  private agents = new Map<string, AgentState>()
  private threads = new Map<string, Thread>()
  private todos = new Map<string, Todo>()
  private events: SessionEvent[] = []
  private docs = new Map<string, DocPage>()
  private designs = new Map<string, DesignBoard>()
  private designCursorTimers = new Map<string, NodeJS.Timeout[]>()
  private docTitles = new Map<string, string>()
  private docRenames = new Map<string, { to: string; ts: number }>()
  private meta = new Map<WebSocket, ConnMeta>()
  private prompts = new Map<string, PromptRef>()
  private steers = new Map<string, PendingSteer[]>()
  private emittedMessages = new Set<string>()
  private cancelTimeoutMs: number
  private resumeGraceMs: number
  private stepFlushMs: number
  private stepFlushes = new Map<string, { timer: NodeJS.Timeout; dirty: boolean }>()
  onSyncNeeded: (() => void) | null = null

  constructor(
    private store: Store,
    opts: { cancelTimeoutMs?: number; resumeGraceMs?: number; stepFlushMs?: number } = {}
  ) {
    this.cancelTimeoutMs = opts.cancelTimeoutMs ?? CANCEL_REPORT_TIMEOUT_MS
    this.resumeGraceMs = opts.resumeGraceMs ?? RESUME_GRACE_MS
    this.stepFlushMs = opts.stepFlushMs ?? STEP_FLUSH_MS
    const persisted = store.loadSession()
    this.code = persisted?.code ?? randomBytes(3).toString('hex')
    this.createdAt = persisted?.createdAt ?? Date.now()
    for (const m of persisted?.members ?? []) {
      this.members.set(m.name.toLowerCase(), { id: m.id, name: m.name, connections: new Set() })
    }
    for (const a of persisted?.agents ?? []) {
      this.agents.set(a.id, {
        ...a,
        settings: a.settings ?? {},
        fields: a.fields ?? [],
        runner: null,
        running: new Set(),
        runs: new Map(),
        dropTimer: null
      })
    }
    const loaded = store.loadEvents()
    const deleted = new Set(loaded.filter(e => e.kind === 'message.deleted').map(e => e.messageId))
    const deletedTargets = new Set([...deleted].map(messageReactionTarget))
    const edits = new Map<string, Extract<SessionEvent, { kind: 'message.edited' }>>()
    for (const event of loaded) {
      if (event.kind === 'message.edited') edits.set(event.messageId, event)
    }
    this.events = loaded
      .filter(
        e =>
          e.kind !== 'message.deleted' &&
          e.kind !== 'message.edited' &&
          !(e.kind === 'message' && deleted.has(e.id)) &&
          !(e.kind === 'message.reaction' && deletedTargets.has(e.targetId))
      )
      .map(e => {
        if (e.kind !== 'message') return e
        const edit = edits.get(e.id)
        return edit ? { ...e, text: edit.text, docMentions: edit.docMentions ?? e.docMentions } : e
      })
    for (const event of this.events) {
      if (event.kind === 'thread.started') {
        this.threads.set(event.threadId, {
          id: event.threadId,
          agentId: event.agentId,
          agentLabel: event.agentLabel,
          title: event.title,
          createdBy: event.byName,
          status: 'open',
          queue: [],
          running: null,
          boardId: event.boardId
        })
      }
      if (event.kind === 'thread.archived') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.status = 'archived'
      }
      if (event.kind === 'thread.status') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.status = event.status
      }
      if (event.kind === 'todo.added') {
        this.todos.set(event.todoId, {
          id: event.todoId,
          text: event.text,
          agentId: event.agentId,
          createdBy: event.byName,
          ts: event.ts,
          checked: false
        })
      }
      if (event.kind === 'todo.edited') {
        const todo = this.todos.get(event.todoId)
        if (todo) {
          todo.text = event.text
          todo.agentId = event.agentId
        }
      }
      if (event.kind === 'todo.checked') {
        const todo = this.todos.get(event.todoId)
        if (todo) todo.checked = event.checked
      }
      if (event.kind === 'todo.removed' || event.kind === 'todo.started') {
        this.todos.delete(event.todoId)
      }
      if (event.kind === 'thread.agent') {
        const thread = this.threads.get(event.threadId)
        if (thread) {
          thread.agentId = event.agentId
          thread.agentLabel = event.agentLabel
        }
      }
    }
    const ended = new Set<string>()
    for (const event of this.events) {
      if (event.kind === 'agent.end') ended.add(event.promptId)
    }
    for (const event of [...this.events]) {
      if (event.kind !== 'agent.start' || ended.has(event.promptId)) continue
      const close: SessionEvent = {
        id: randomUUID(),
        ts: Date.now(),
        kind: 'agent.end',
        promptId: event.promptId,
        agentId: event.agentId,
        agentLabel: event.agentLabel,
        threadId: event.threadId,
        ok: false,
        error: 'Interrupted by a restart'
      }
      this.events.push(close)
      store.appendEvent(close)
    }
    for (const [page, doc] of Object.entries(store.loadDocs())) this.docs.set(page, doc)
    for (const [id, design] of Object.entries(store.loadDesigns())) {
      this.designs.set(id, { id, name: design.name, document: design.document, presence: new Map(), saveTimer: null })
    }
    for (const [page, title] of Object.entries(store.loadTitles())) {
      this.docTitles.set(page, title)
      const doc = this.docs.get(page)
      if (doc) this.docs.set(page, { title, text: doc.text })
    }
    this.assignPageCodes()
    this.persistMeta()
  }

  attach(ws: WebSocket): void {
    let greeted = false
    ws.on('message', raw => {
      let msg: ClientMessage
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!greeted) {
        if (msg.type !== 'hello' || msg.code !== this.code) {
          this.send(ws, { type: 'error', message: 'Wrong session code' })
          ws.close()
          return
        }
        greeted = true
        this.handleHello(ws, msg)
        return
      }
      this.handleMessage(ws, msg)
    })
    ws.on('close', code => this.detach(ws, code))
  }

  snapshot(): SessionSnapshot {
    return {
      code: this.code,
      members: [...this.members.values()].map(m => ({
        id: m.id,
        name: m.name,
        connected: m.connections.size > 0
      })),
      agents: [...this.agents.values()].map(agent => this.pooled(agent)),
      events: trimEvents(this.events, SNAPSHOT_EVENT_LIMIT),
      docs: Object.fromEntries(this.docs),
      queues: Object.fromEntries(
        [...this.threads.values()]
          .filter(thread => thread.queue.length > 0)
          .map(thread => [thread.id, this.queueItems(thread)])
      ),
      todos: [...this.todos.values()],
      boards: this.boardList()
    }
  }

  private handleHello(ws: WebSocket, msg: Extract<ClientMessage, { type: 'hello' }>): void {
    const member = this.memberFor(msg.name)
    const wasOffline = member.connections.size === 0
    member.connections.add(ws)
    this.meta.set(ws, { role: msg.role, memberKey: member.name.toLowerCase(), agentIds: [] })
    this.send(ws, { type: 'welcome', selfId: member.id, snapshot: this.snapshot() })
    if (msg.role === 'runner') {
      for (const llm of msg.llms) this.registerAgent(ws, member, llm)
      this.reconcileRuns(this.meta.get(ws)?.agentIds ?? [], new Set(msg.running ?? []))
    }
    if (wasOffline) {
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'person.joined', memberId: member.id, name: member.name })
    }
    this.persistMeta()
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    const meta = this.meta.get(ws)
    if (!meta) return
    const member = this.members.get(meta.memberKey)
    if (!member) return
    switch (msg.type) {
      case 'chat.send':
        if (meta.role === 'ui') this.handleChat(member, msg.text, msg.mentions, msg.threadId, msg.attachments, msg.boardId)
        break
      case 'chat.delete':
        if (meta.role === 'ui') this.handleDeleteMessage(member, msg.messageId)
        break
      case 'chat.react':
        if (meta.role === 'ui') this.handleReaction(member, msg.targetId, msg.emoji)
        break
      case 'thread.archive':
        if (meta.role === 'ui') this.handleThreadStatus(member, msg.threadId, 'archived')
        break
      case 'thread.status':
        if (meta.role === 'ui') this.handleThreadStatus(member, msg.threadId, msg.status)
        break
      case 'todo.add':
        if (meta.role === 'ui') this.handleTodoAdd(member, msg.text, msg.agentId)
        break
      case 'todo.edit':
        if (meta.role === 'ui') this.handleTodoEdit(member, msg.todoId, msg.text, msg.agentId)
        break
      case 'todo.remove':
        if (meta.role === 'ui') this.handleTodoRemove(member, msg.todoId)
        break
      case 'todo.check':
        if (meta.role === 'ui') this.handleTodoCheck(member, msg.todoId, msg.checked)
        break
      case 'todo.do':
        if (meta.role === 'ui') this.handleTodoDo(member, msg.todoId, msg.agentId)
        break
      case 'doc.update':
        if (meta.role === 'ui') this.handleDoc(member, msg.page, msg.text, msg.title)
        break
      case 'doc.retitle':
        if (meta.role === 'ui') this.handleDocRetitle(member, msg.page, msg.title)
        break
      case 'doc.title':
        if (meta.role === 'ui') this.handleDocTitle(member, msg.page, msg.title)
        break
      case 'doc.rename':
        if (meta.role === 'ui') this.handleDocRename(member, msg.from, msg.to, msg.title)
        break
      case 'doc.delete':
        if (meta.role === 'ui') this.handleDocDelete(member, msg.page)
        break
      case 'design.create':
        if (meta.role === 'ui') this.handleDesignCreate(msg.boardId, msg.name)
        break
      case 'design.rename':
        if (meta.role === 'ui') this.handleDesignRename(msg.boardId, msg.name)
        break
      case 'design.delete':
        if (meta.role === 'ui') this.handleDesignDelete(msg.boardId)
        break
      case 'design.open':
        if (meta.role === 'ui') this.handleDesignOpen(ws, msg.boardId)
        break
      case 'design.init':
        if (meta.role === 'ui') this.handleDesignInit(msg.boardId, msg.document)
        break
      case 'design.apply':
        if (meta.role === 'ui') this.handleDesignApply(ws, msg.boardId, msg.put, msg.remove)
        break
      case 'design.presence':
        if (meta.role === 'ui') {
          this.handleDesignPresence(ws, member, msg.boardId, msg.cursor, msg.selection, msg.pageId)
        }
        break
      case 'queue.edit':
        if (meta.role === 'ui') this.handleQueueEdit(member, msg.promptId, msg.text)
        break
      case 'queue.remove':
        if (meta.role === 'ui') this.handleQueueRemove(member, msg.promptId)
        break
      case 'prompt.cancel':
        if (meta.role === 'ui') this.handleCancel(msg.promptId)
        break
      case 'agent.settings':
        if (meta.role === 'ui') this.handleSettings(msg.agentId, msg.settings)
        break
      case 'agent.register':
        if (meta.role === 'runner') this.registerAgent(ws, member, msg.llm)
        break
      case 'agent.deregister':
        if (meta.role === 'runner') this.deregisterAgent(ws, member, msg.instanceId)
        break
      case 'agent.step':
        if (this.promptGone(ws, meta, msg.promptId)) break
        this.handleStep(meta, msg.promptId, msg.step)
        break
      case 'agent.usage':
        if (meta.role === 'runner') this.handleUsage(meta, member, msg.instanceId, msg.usage)
        break
      case 'agent.tokens':
        if (this.promptGone(ws, meta, msg.promptId)) break
        this.handleTokens(meta, msg.promptId, msg.tokens)
        break
      case 'agent.steered':
        this.handleSteered(meta, msg.promptId, msg.ok)
        break
      case 'agent.done':
        this.handleDone(meta, msg.promptId, msg.text)
        break
      case 'agent.error':
        this.handleError(meta, msg.promptId, msg.message)
        break
    }
  }

  private handleChat(
    member: Member,
    text: string,
    mentions: string[],
    threadId?: string,
    incoming?: OutgoingAttachment[],
    boardId?: string
  ): void {
    const trimmed = text.trim()
    const attachments = this.saveAttachments(incoming)
    if (!trimmed && attachments.length === 0) return
    if (threadId) {
      const thread = this.threads.get(threadId)
      if (!thread) return
      if (thread.status !== 'open') this.handleThreadStatus(member, threadId, 'open')
      const targets = [...new Set(mentions)].filter(id => this.agents.has(id))
      if (targets.length === 0) targets.push(thread.agentId)
      const messageId = randomUUID()
      if (!targets.includes(thread.agentId)) this.switchThreadAgent(thread, targets[0], member)
      for (const id of targets) {
        const agent = this.agents.get(id)
        if (!agent) continue
        this.enqueuePrompt(agent, member, trimmed, threadId, attachments, { messageId, mentions: targets })
      }
      return
    }
    const ids = [...new Set(mentions)].filter(id => this.agents.has(id))
    if (ids.length === 0) {
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'message',
        authorId: member.id,
        authorName: member.name,
        text: trimmed,
        mentions,
        docMentions: this.docMentionRefs(trimmed),
        attachments
      })
      return
    }
    for (const id of ids) this.startThread(member, this.agents.get(id)!, trimmed, attachments, boardId)
  }

  private switchThreadAgent(thread: Thread, id: string, member: Member): void {
    const agent = this.agents.get(id)
    if (!agent) return
    thread.agentId = id
    thread.agentLabel = agent.label
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'thread.agent',
      threadId: thread.id,
      agentId: id,
      agentLabel: agent.label,
      byName: member.name
    })
  }

  private startThread(
    member: Member,
    agent: AgentState,
    text: string,
    attachments: Attachment[],
    boardId?: string
  ): string {
    const threadId = randomUUID()
    const thread: Thread = {
      id: threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: this.titleFrom(text || attachments.map(a => a.name).join(', ')),
      createdBy: member.name,
      status: 'open',
      queue: [],
      running: null,
      boardId: boardId && this.designs.has(boardId) ? boardId : undefined
    }
    this.threads.set(threadId, thread)
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'thread.started',
      threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: thread.title,
      byName: member.name,
      boardId: thread.boardId
    })
    this.enqueuePrompt(agent, member, text, threadId, attachments)
    return threadId
  }

  private handleTodoAdd(member: Member, text: string, agentId?: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const todo: Todo = {
      id: randomUUID(),
      text: trimmed,
      agentId,
      createdBy: member.name,
      ts: Date.now(),
      checked: false
    }
    this.todos.set(todo.id, todo)
    this.emit({
      id: randomUUID(),
      ts: todo.ts,
      kind: 'todo.added',
      todoId: todo.id,
      text: todo.text,
      agentId,
      byName: member.name
    })
  }

  private handleTodoEdit(member: Member, todoId: string, text: string, agentId?: string): void {
    const todo = this.todos.get(todoId)
    const trimmed = text.trim()
    if (!todo || !trimmed) return
    if (todo.text === trimmed && todo.agentId === agentId) return
    todo.text = trimmed
    todo.agentId = agentId
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'todo.edited', todoId, text: trimmed, agentId, byName: member.name })
  }

  private handleTodoRemove(member: Member, todoId: string): void {
    if (!this.todos.delete(todoId)) return
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'todo.removed', todoId, byName: member.name })
  }

  private handleTodoCheck(member: Member, todoId: string, checked: boolean): void {
    const todo = this.todos.get(todoId)
    if (!todo || todo.checked === checked) return
    todo.checked = checked
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'todo.checked', todoId, checked, byName: member.name })
  }

  // 'Do' is the moment a todo becomes real work: a thread starts with the
  // todo's text as its first prompt, and the todo itself is gone.
  private handleTodoDo(member: Member, todoId: string, agentId?: string): void {
    const todo = this.todos.get(todoId)
    if (!todo || todo.checked) return
    const agent = this.agents.get(agentId ?? todo.agentId ?? '')
    if (!agent) return
    this.todos.delete(todoId)
    const threadId = this.startThread(member, agent, todo.text, [])
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'todo.started', todoId, threadId, byName: member.name })
  }

  // Two prompts can share one message when it mentioned several agents, so
  // emission is tracked by message, not by queue entry.
  private emitThreadMessage(entry: QueuedPrompt): void {
    if (this.emittedMessages.has(entry.messageId)) return
    this.emittedMessages.add(entry.messageId)
    this.emit({
      id: entry.messageId,
      ts: Date.now(),
      kind: 'message',
      authorId: entry.authorId,
      authorName: entry.byName,
      text: entry.text,
      mentions: entry.mentions,
      docMentions: entry.docMentions,
      threadId: entry.threadId,
      attachments: entry.attachments
    })
  }

  private docMentionRefs(text: string): DocMentionRef[] {
    return docMentionRefsIn(text, Object.fromEntries(this.docs))
  }

  private handleDeleteMessage(member: Member, messageId: string): void {
    const index = this.events.findIndex(e => e.kind === 'message' && e.id === messageId)
    if (index === -1) return
    const event = this.events[index]
    if (event.kind !== 'message' || event.authorId !== member.id) return
    this.events.splice(index, 1)
    const targetId = messageReactionTarget(messageId)
    this.events = this.events.filter(e => e.kind !== 'message.reaction' || e.targetId !== targetId)
    const tombstone: SessionEvent = { id: randomUUID(), ts: Date.now(), kind: 'message.deleted', messageId }
    this.store.appendEvent(tombstone)
    this.broadcast({ type: 'event', event: tombstone })
    this.onSyncNeeded?.()
  }

  private handleReaction(member: Member, targetId: string, emoji: string): void {
    if (!isReactionEmoji(emoji)) return
    const target = this.reactionTarget(targetId)
    if (!target) return
    let previous: ReactionEvent | undefined
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]
      if (
        event.kind === 'message.reaction' &&
        event.targetId === targetId &&
        event.memberId === member.id &&
        event.emoji === emoji
      ) {
        previous = event
        break
      }
    }
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'message.reaction',
      targetId,
      targetAuthorId: target.authorId,
      targetAuthorName: target.authorName,
      memberId: member.id,
      memberName: member.name,
      emoji,
      active: !previous?.active,
      threadId: target.threadId
    })
  }

  private reactionTarget(targetId: string): ReactionTarget | null {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]
      if (event.kind === 'message' && messageReactionTarget(event.id) === targetId) {
        return {
          authorId: event.authorId,
          authorName: event.authorName,
          text: event.text,
          threadId: event.threadId
        }
      }
      if (
        event.kind === 'agent.step' &&
        event.step.kind === 'text' &&
        agentStepReactionTarget(event.promptId, event.step.id) === targetId
      ) {
        return {
          authorId: event.agentId,
          authorName: event.agentLabel,
          text: event.step.text ?? '',
          threadId: event.threadId
        }
      }
      if (event.kind === 'agent.end' && agentEndReactionTarget(event.promptId) === targetId) {
        return {
          authorId: event.agentId,
          authorName: event.agentLabel,
          text: event.ok ? (event.text ?? '') : (event.error ?? ''),
          threadId: event.threadId
        }
      }
    }
    for (const agent of this.agents.values()) {
      for (const [promptId, run] of agent.runs) {
        for (const entry of run.steps.values()) {
          if (
            entry.step.kind !== 'text' ||
            agentStepReactionTarget(promptId, entry.step.id) !== targetId
          ) {
            continue
          }
          return {
            authorId: agent.id,
            authorName: agent.label,
            text: entry.step.text ?? '',
            threadId: this.prompts.get(promptId)?.threadId ?? run.entry?.threadId
          }
        }
      }
    }
    return null
  }

  private handleThreadStatus(member: Member, threadId: string, status: ThreadStatus): void {
    const thread = this.threads.get(threadId)
    if (!thread || !THREAD_STATUSES.has(status) || thread.status === status) return
    thread.status = status
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.status', threadId, status, byName: member.name })
  }

  private saveAttachments(incoming?: OutgoingAttachment[]): Attachment[] {
    const saved: Attachment[] = []
    for (const item of (incoming ?? []).slice(0, MAX_ATTACHMENTS)) {
      const one = this.saveAttachment(item.mime, item.name, Buffer.from(item.data, 'base64'))
      if (one) saved.push(one)
    }
    return saved
  }

  saveAttachment(mime: string, name: string, data: Buffer): Attachment | null {
    if (!isImageType(mime)) return null
    if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) return null
    const id = randomUUID()
    const file = `${id}.${extensionFor(mime)}`
    try {
      this.store.saveAttachment(file, data)
    } catch {
      return null
    }
    return { id, name: this.safeName(name), mime, size: data.length, file }
  }

  private safeName(name: string): string {
    const flat = name.replace(/[\r\n]+/g, ' ').trim()
    return flat.slice(0, 120) || 'image'
  }

  attachmentPath(file: string): string | null {
    return this.store.attachmentPath(file)
  }

  private assignPageCodes(): void {
    const taken = new Set([...this.docs.keys()].map(pageCodeOf))
    const pending = [...this.docs.keys()]
      .filter(page => page !== 'main' && !pageCodeOf(page))
      .sort((a, b) => b.split('/').length - a.split('/').length)
    let titlesChanged = false
    for (const from of pending) {
      let code = pageCode()
      while (taken.has(code)) code = pageCode()
      taken.add(code)
      const to = `${from}-${code}`
      try {
        this.store.renameDoc(from, to)
      } catch {
        continue
      }
      for (const [page, doc] of [...this.docs.entries()]) {
        if (page !== from && !page.startsWith(`${from}/`)) continue
        this.docs.delete(page)
        this.docs.set(to + page.slice(from.length), doc)
      }
      for (const [page, title] of [...this.docTitles.entries()]) {
        if (page !== from && !page.startsWith(`${from}/`)) continue
        this.docTitles.delete(page)
        this.docTitles.set(to + page.slice(from.length), title)
        titlesChanged = true
      }
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
  }

  private followRenames(page: string): string {
    for (let hops = 0; hops < 5; hops++) {
      if (this.docs.has(page)) return page
      const hit = [...this.docRenames.entries()].find(
        ([from, move]) => Date.now() - move.ts <= 10000 && (page === from || page.startsWith(`${from}/`))
      )
      if (!hit) return page
      page = hit[1].to + page.slice(hit[0].length)
    }
    return page
  }

  private handleDoc(member: Member, page: string, text: string, title?: string): void {
    page = this.followRenames(page)
    const doc: DocPage = { title: title ?? this.docs.get(page)?.title ?? fallbackTitle(page), text }
    try {
      this.store.saveDoc(page, doc)
    } catch {
      return
    }
    this.docs.set(page, doc)
    if (title !== undefined && this.docTitles.delete(page)) {
      this.store.saveTitles(Object.fromEntries(this.docTitles))
    }
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc', page, text, title: doc.title, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private handleDocRetitle(member: Member, page: string, title: string): void {
    page = this.followRenames(page)
    const existing = this.docs.get(page)
    if (!existing || existing.title === title) return
    const doc: DocPage = { title, text: existing.text }
    try {
      this.store.saveDoc(page, doc)
    } catch {
      return
    }
    this.docs.set(page, doc)
    if (this.docTitles.delete(page)) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc', page, text: doc.text, title, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private handleDocTitle(member: Member, page: string, title: string): void {
    page = this.followRenames(page)
    const existing = this.docs.get(page)
    if (!existing) return
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
    const doc: DocPage = { title: clean || fallbackTitle(page), text: existing.text }
    try {
      this.store.saveDoc(page, doc)
    } catch {
      return
    }
    this.docs.set(page, doc)
    if (clean) this.docTitles.set(page, clean)
    else this.docTitles.delete(page)
    this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.titled', page, title: clean, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private handleDocDelete(member: Member, page: string): void {
    if (page === 'main' || !this.docs.has(page)) return
    try {
      this.store.deleteDoc(page)
    } catch {
      return
    }
    for (const key of [...this.docs.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) this.docs.delete(key)
    }
    let titlesChanged = false
    for (const key of [...this.docTitles.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) {
        this.docTitles.delete(key)
        titlesChanged = true
      }
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.deleted', page, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private boardList(): DesignBoardMeta[] {
    return [...this.designs.values()]
      .map(board => ({ id: board.id, name: board.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private broadcastBoards(): void {
    this.broadcast({ type: 'design.boards', boards: this.boardList() })
  }

  private handleDesignCreate(boardId: string, name: string): void {
    if (!BOARD_ID.test(boardId) || this.designs.has(boardId)) return
    const clean = this.titleFrom(name) || 'Untitled'
    try {
      this.store.saveDesign(boardId, { name: clean, document: null })
    } catch {
      return
    }
    this.designs.set(boardId, { id: boardId, name: clean, document: null, presence: new Map(), saveTimer: null })
    this.broadcastBoards()
    this.onSyncNeeded?.()
  }

  private handleDesignRename(boardId: string, name: string): void {
    const board = this.designs.get(boardId)
    const clean = this.titleFrom(name)
    if (!board || !clean || board.name === clean) return
    board.name = clean
    this.scheduleDesignSave(board)
    this.broadcastBoards()
  }

  private handleDesignDelete(boardId: string): void {
    const board = this.designs.get(boardId)
    if (!board) return
    if (board.saveTimer) clearTimeout(board.saveTimer)
    this.designs.delete(boardId)
    try {
      this.store.deleteDesign(boardId)
    } catch {
      // The board is gone from the session either way.
    }
    this.broadcastBoards()
    this.onSyncNeeded?.()
  }

  private handleDesignOpen(ws: WebSocket, boardId: string): void {
    const board = this.designs.get(boardId)
    if (!board) return
    this.send(ws, {
      type: 'design.snapshot',
      boardId,
      name: board.name,
      document: board.document,
      presence: [...board.presence.values()]
    })
  }

  // The first person to open a fresh board sends the starting document, so the
  // server never has to know how to build one. Everyone else loads it from the
  // snapshot broadcast here.
  private handleDesignInit(boardId: string, document: DesignDocument): void {
    const board = this.designs.get(boardId)
    if (!board || board.document !== null) return
    if (!document || typeof document !== 'object') return
    if (typeof document.store !== 'object' || document.store === null || Array.isArray(document.store)) return
    board.document = { store: { ...document.store }, schema: document.schema ?? null }
    this.scheduleDesignSave(board)
    this.broadcast({
      type: 'design.snapshot',
      boardId,
      name: board.name,
      document: board.document,
      presence: [...board.presence.values()]
    })
  }

  private handleDesignApply(ws: WebSocket, boardId: string, put?: unknown[], remove?: string[]): void {
    const board = this.designs.get(boardId)
    if (!board?.document) return
    const putRecords = (Array.isArray(put) ? put : []).filter(
      (record): record is { id: string } =>
        typeof record === 'object' && record !== null && typeof (record as { id?: unknown }).id === 'string'
    )
    const removeIds = (Array.isArray(remove) ? remove : []).filter((id): id is string => typeof id === 'string')
    if (putRecords.length === 0 && removeIds.length === 0) return
    for (const record of putRecords) board.document.store[record.id] = record
    for (const id of removeIds) delete board.document.store[id]
    this.scheduleDesignSave(board)
    this.broadcastExcept(ws, { type: 'design.changes', boardId, put: putRecords, remove: removeIds })
  }

  private handleDesignPresence(
    ws: WebSocket,
    member: Member,
    boardId: string,
    cursor: { x: number; y: number } | null,
    selection: string[],
    pageId: string | null
  ): void {
    const board = this.designs.get(boardId)
    if (!board) return
    const valid =
      cursor !== null &&
      typeof cursor === 'object' &&
      typeof cursor.x === 'number' &&
      typeof cursor.y === 'number' &&
      isFinite(cursor.x) &&
      isFinite(cursor.y)
    const presence: DesignPresence = {
      userId: member.id,
      name: member.name,
      kind: 'human',
      cursor: valid ? { x: cursor.x, y: cursor.y } : null,
      selection: (Array.isArray(selection) ? selection : []).filter(id => typeof id === 'string').slice(0, 100),
      pageId: typeof pageId === 'string' ? pageId : null,
      ts: Date.now()
    }
    if (presence.pageId === null) board.presence.delete(member.id)
    else board.presence.set(member.id, presence)
    this.broadcastExcept(ws, { type: 'design.presence', boardId, presence })
  }

  private dropDesignPresence(member: Member): void {
    const stillHere = [...this.meta.values()].some(
      m => m.role === 'ui' && m.memberKey === member.name.toLowerCase()
    )
    if (stillHere) return
    for (const board of this.designs.values()) {
      if (!board.presence.delete(member.id)) continue
      this.broadcast({
        type: 'design.presence',
        boardId: board.id,
        presence: {
          userId: member.id,
          name: member.name,
          kind: 'human',
          cursor: null,
          selection: [],
          pageId: null,
          ts: Date.now()
        }
      })
    }
  }

  private scheduleDesignSave(board: DesignBoard): void {
    if (board.saveTimer) return
    board.saveTimer = setTimeout(() => {
      board.saveTimer = null
      try {
        this.store.saveDesign(board.id, { name: board.name, document: board.document })
      } catch {
        return
      }
      this.onSyncNeeded?.()
    }, DESIGN_SAVE_MS)
    board.saveTimer.unref?.()
  }

  designBoardSummary(boardId: string): unknown | null {
    const board = this.designs.get(boardId)
    if (!board) return null
    return boardSummary(board.id, board.name, board.document)
  }

  runDesignOps(boardId: string, byAgent: string, ops: DesignOp[]): DesignOpResult[] | null {
    const board = this.designs.get(boardId)
    if (!board) return null
    if (!board.document) {
      return ops.map(() => ({ error: 'This board has never been opened in the app, so it has no page yet.' }))
    }
    const applied = applyDesignOps(board.document, ops)
    if (applied.put.length > 0 || applied.remove.length > 0) {
      this.broadcast({ type: 'design.changes', boardId, put: applied.put, remove: applied.remove })
      this.scheduleDesignSave(board)
    }
    this.walkAgentCursor(board, byAgent, applied)
    return applied.results
  }

  // The agent's cursor hops from shape to shape a beat behind the edits, so
  // people watching the board see the work land where it happened.
  private walkAgentCursor(board: DesignBoard, agentKey: string, applied: AppliedOps): void {
    const key = `${board.id}:${agentKey}`
    for (const timer of this.designCursorTimers.get(key) ?? []) clearTimeout(timer)
    const steps = applied.cursors.slice(0, DESIGN_CURSOR_STEPS_MAX)
    if (steps.length === 0) return
    const label = this.agents.get(agentKey)?.label ?? agentKey
    const pageId = Object.keys(board.document?.store ?? {}).find(id => id.startsWith('page:')) ?? null
    const touched = applied.results.flatMap(result => (result.id ? [result.id] : [])).slice(0, 50)
    const timers: NodeJS.Timeout[] = []
    steps.forEach((cursor, i) => {
      const timer = setTimeout(() => {
        const presence: DesignPresence = {
          userId: agentKey,
          name: label,
          kind: 'agent',
          cursor,
          selection: touched,
          pageId,
          ts: Date.now()
        }
        board.presence.set(agentKey, presence)
        this.broadcast({ type: 'design.presence', boardId: board.id, presence })
      }, i * DESIGN_CURSOR_STEP_MS)
      timer.unref?.()
      timers.push(timer)
    })
    const done = setTimeout(() => {
      board.presence.delete(agentKey)
      this.designCursorTimers.delete(key)
      this.broadcast({
        type: 'design.presence',
        boardId: board.id,
        presence: { userId: agentKey, name: label, kind: 'agent', cursor: null, selection: [], pageId: null, ts: Date.now() }
      })
    }, steps.length * DESIGN_CURSOR_STEP_MS + 6000)
    done.unref?.()
    timers.push(done)
    this.designCursorTimers.set(key, timers)
  }

  private queuedEntry(promptId: string): { thread: Thread; entry: QueuedPrompt } | null {
    for (const thread of this.threads.values()) {
      const entry = thread.queue.find(q => q.promptId === promptId)
      if (entry) return { thread, entry }
    }
    return null
  }

  private handleQueueEdit(member: Member, promptId: string, text: string): void {
    const found = this.queuedEntry(promptId)
    const trimmed = text.trim()
    if (!found || !trimmed || found.entry.authorId !== member.id) return
    const docMentions = this.docMentionRefs(trimmed)
    for (const entry of found.thread.queue) {
      if (entry.messageId === found.entry.messageId) {
        entry.text = trimmed
        entry.docMentions = docMentions
      }
    }
    if (this.emittedMessages.has(found.entry.messageId)) {
      const message = this.events.find(e => e.kind === 'message' && e.id === found.entry.messageId)
      if (message && message.kind === 'message') {
        message.text = trimmed
        message.docMentions = docMentions
        this.emit({
          id: randomUUID(),
          ts: Date.now(),
          kind: 'message.edited',
          messageId: message.id,
          text: trimmed,
          docMentions
        })
      }
    }
    this.broadcastQueue(found.thread)
  }

  private handleQueueRemove(member: Member, promptId: string): void {
    const found = this.queuedEntry(promptId)
    if (!found || found.entry.authorId !== member.id) return
    found.thread.queue = found.thread.queue.filter(q => q.promptId !== promptId)
    // The message stays if a sibling prompt for another mentioned agent is
    // still queued or already running off it.
    const shared =
      found.thread.queue.some(q => q.messageId === found.entry.messageId) ||
      [...this.prompts.values()].some(ref => ref.messageId === found.entry.messageId)
    if (this.emittedMessages.has(found.entry.messageId) && !shared) {
      this.handleDeleteMessage(member, found.entry.messageId)
    }
    this.broadcastQueue(found.thread)
  }

  private handleDocRename(member: Member, from: string, to: string, title?: string): void {
    if (from === to || from === 'main' || !this.docs.has(from)) return
    if (to === from || to.startsWith(`${from}/`)) return
    try {
      this.store.renameDoc(from, to)
    } catch {
      return
    }
    for (const [page, doc] of [...this.docs.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue
      this.docs.delete(page)
      this.docs.set(to + page.slice(from.length), doc)
    }
    const moved = this.docs.get(to)
    if (title !== undefined && moved && moved.title !== title) {
      const doc: DocPage = { title, text: moved.text }
      try {
        this.store.saveDoc(to, doc)
        this.docs.set(to, doc)
      } catch {
        title = moved.title
      }
    }
    let titlesChanged = false
    for (const [page, legacyTitle] of [...this.docTitles.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue
      this.docTitles.delete(page)
      this.docTitles.set(to + page.slice(from.length), legacyTitle)
      titlesChanged = true
    }
    if (title !== undefined && this.docTitles.delete(to)) titlesChanged = true
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.docRenames.set(from, { to, ts: Date.now() })
    for (const [key, move] of this.docRenames) {
      if (Date.now() - move.ts > 10000) this.docRenames.delete(key)
    }
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.renamed', from, to, title, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private handleUsage(meta: ConnMeta, member: Member, instanceId: string, usage: AgentUsage): void {
    const id = agentId(member.name, instanceId)
    const agent = this.agents.get(id)
    if (!agent || !meta.agentIds.includes(id)) return
    agent.usage = usage
    this.broadcast({ type: 'agent.usage', agentId: id, usage })
    // Kept in session.json so the last known limits still show while the
    // owner's machine is offline.
    this.persistMeta()
  }

  private handleTokens(meta: ConnMeta, promptId: string, tokens: number): void {
    const agent = this.ownedAgent(meta, promptId)
    const ref = this.prompts.get(promptId)
    const run = agent?.runs.get(promptId)
    if (!agent || !ref || !run) return
    run.tokens = Math.max(run.tokens, tokens)
    this.broadcast({ type: 'agent.tokens', promptId, agentId: agent.id, threadId: ref.threadId, tokens: run.tokens })
  }

  private handleStep(meta: ConnMeta, promptId: string, step: RunStep): void {
    const agent = this.ownedAgent(meta, promptId)
    const ref = this.prompts.get(promptId)
    const run = agent?.runs.get(promptId)
    if (!agent || !ref || !run) return
    const existing = run.steps.get(step.id)?.step
    const merged: AgentStep = {
      id: step.id,
      ts: existing?.ts ?? Date.now(),
      kind: existing?.kind ?? step.kind,
      status: step.status,
      name: step.name || existing?.name,
      detail: step.detail ?? existing?.detail,
      files: step.files ?? existing?.files,
      text: (existing?.text ?? '') + (step.text ?? '') || undefined
    }
    run.steps.set(step.id, { step: merged, persisted: false })
    if (merged.status === 'done') {
      const pending = this.stepFlushes.get(`${promptId}:${step.id}`)
      if (pending) {
        clearTimeout(pending.timer)
        this.stepFlushes.delete(`${promptId}:${step.id}`)
      }
      this.broadcast({ type: 'agent.step', promptId, agentId: agent.id, threadId: ref.threadId, step: merged })
      this.persistStep(agent, promptId, ref.threadId, step.id)
      return
    }
    this.broadcastStep(agent, promptId, ref.threadId, step.id, merged)
  }

  private broadcastStep(agent: AgentState, promptId: string, threadId: string, stepId: string, step: AgentStep): void {
    const key = `${promptId}:${stepId}`
    const pending = this.stepFlushes.get(key)
    if (pending) {
      pending.dirty = true
      return
    }
    this.broadcast({ type: 'agent.step', promptId, agentId: agent.id, threadId, step })
    const timer = setTimeout(() => {
      const entry = this.stepFlushes.get(key)
      this.stepFlushes.delete(key)
      const latest = agent.runs.get(promptId)?.steps.get(stepId)?.step
      if (!entry?.dirty || !latest || latest.status === 'done') return
      this.broadcast({ type: 'agent.step', promptId, agentId: agent.id, threadId, step: latest })
    }, this.stepFlushMs)
    timer.unref?.()
    this.stepFlushes.set(key, { timer, dirty: false })
  }

  private persistStep(agent: AgentState, promptId: string, threadId: string, stepId: string): void {
    const entry = agent.runs.get(promptId)?.steps.get(stepId)
    if (!entry || entry.persisted) return
    entry.persisted = true
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.step',
      promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      threadId,
      step: entry.step
    })
  }

  private handleCancel(promptId: string): void {
    const ref = this.prompts.get(promptId)
    if (!ref) {
      this.closeOrphanRun(promptId)
      return
    }
    const agent = this.agents.get(ref.agentId)
    if (!agent) return
    if (!agent.runner) {
      this.finishPrompt(agent, promptId, { ok: false, error: 'Stopped' })
      return
    }
    this.send(agent.runner, { type: 'cancel', promptId })
    const timer = setTimeout(() => {
      if (this.prompts.has(promptId)) this.finishPrompt(agent, promptId, { ok: false, error: 'Stopped' })
    }, this.cancelTimeoutMs)
    timer.unref?.()
  }

  private closeOrphanRun(promptId: string): void {
    let start: Extract<SessionEvent, { kind: 'agent.start' }> | null = null
    for (const event of this.events) {
      if (event.kind === 'agent.start' && event.promptId === promptId) start = event
      if (event.kind === 'agent.end' && event.promptId === promptId) return
    }
    if (!start) return
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.end',
      promptId,
      agentId: start.agentId,
      agentLabel: start.agentLabel,
      threadId: start.threadId,
      ok: false,
      error: 'Stopped'
    })
  }

  private handleDone(meta: ConnMeta, promptId: string, text: string): void {
    const agent = this.ownedAgent(meta, promptId)
    if (!agent) return
    this.finishPrompt(agent, promptId, { ok: true, text })
  }

  private handleError(meta: ConnMeta, promptId: string, message: string): void {
    const agent = this.ownedAgent(meta, promptId)
    if (!agent) return
    this.finishPrompt(agent, promptId, { ok: false, error: message })
  }

  private reconcileRuns(agentIds: string[], running: Set<string>): void {
    for (const id of agentIds) {
      const agent = this.agents.get(id)
      if (!agent) continue
      for (const promptId of [...agent.running]) {
        if (running.has(promptId)) continue
        const ref = this.prompts.get(promptId)
        const entry = agent.runs.get(promptId)?.entry
        if (!ref || !entry || !agent.runner) {
          this.finishPrompt(agent, promptId, { ok: false, error: `${agent.label} lost this prompt.` })
          continue
        }
        this.send(agent.runner, {
          type: 'prompt',
          promptId,
          agentId: agent.id,
          threadId: ref.threadId,
          text: this.buildPrompt(agent, entry),
          settings: agent.settings,
          attachments: entry.attachments,
          designBoard: this.boardOf(this.threads.get(ref.threadId))
        })
      }
    }
  }

  private boardOf(thread: Thread | undefined): DesignBoardMeta | undefined {
    if (!thread?.boardId) return undefined
    const board = this.designs.get(thread.boardId)
    return board ? { id: board.id, name: board.name } : undefined
  }

  private promptGone(ws: WebSocket, meta: ConnMeta, promptId: string): boolean {
    if (meta.role !== 'runner' || this.prompts.has(promptId)) return false
    this.send(ws, { type: 'cancel', promptId })
    return true
  }

  private ownedAgent(meta: ConnMeta, promptId: string): AgentState | null {
    const ref = this.prompts.get(promptId)
    if (!ref) return null
    const agent = this.agents.get(ref.agentId)
    if (!agent || !meta.agentIds.includes(agent.id)) return null
    return agent
  }

  private enqueuePrompt(
    agent: AgentState,
    member: Member,
    text: string,
    threadId: string,
    attachments: Attachment[],
    route?: { messageId: string; mentions: string[] }
  ): void {
    const thread = this.threads.get(threadId)
    if (!thread) return
    const entry: QueuedPrompt = {
      promptId: randomUUID(),
      agentId: agent.id,
      text,
      byName: member.name,
      authorId: member.id,
      threadId,
      mentions: route?.mentions ?? [agent.id],
      docMentions: this.docMentionRefs(text),
      attachments,
      messageId: route?.messageId ?? randomUUID()
    }
    if (!agent.runner && !agent.dropTimer) {
      this.emitThreadMessage(entry)
      this.systemMessage(`${agent.label} is not here right now.`, threadId)
      return
    }
    // A message that arrives mid-run goes straight into the run when it is for
    // the agent doing the running and that agent can take it, so it steers the
    // work in progress instead of waiting.
    const runningAgentId = thread.running ? this.prompts.get(thread.running)?.agentId : undefined
    if (agent.runner && thread.running && runningAgentId === agent.id && agent.steerable) {
      this.emitThreadMessage(entry)
      this.sendSteer(agent, thread.running, {
        messageId: entry.messageId,
        text,
        byName: member.name,
        authorId: member.id,
        threadId,
        attachments
      })
      return
    }
    thread.queue.push(entry)
    if (this.emittedMessages.has(entry.messageId)) this.routed(entry.messageId, threadId, entry.promptId, 'queued')
    this.broadcastQueue(thread)
    this.runThread(thread)
  }

  private queueItems(thread: Thread): QueuedItem[] {
    return thread.queue.map(({ promptId, authorId, byName, text, agentId }) => ({
      promptId,
      authorId,
      authorName: byName,
      text,
      agentId,
      agentLabel: this.agents.get(agentId)?.label ?? ''
    }))
  }

  private broadcastQueue(thread: Thread): void {
    this.broadcast({ type: 'queue.state', threadId: thread.id, items: this.queueItems(thread) })
  }

  private sendSteer(agent: AgentState, promptId: string, steer: PendingSteer): void {
    const waiting = this.steers.get(promptId) ?? []
    waiting.push(steer)
    this.steers.set(promptId, waiting)
    this.routed(steer.messageId, steer.threadId, promptId, 'steered')
    this.send(agent.runner!, {
      type: 'steer',
      promptId,
      text: steer.text,
      byName: steer.byName,
      attachments: steer.attachments
    })
  }

  // Acks arrive in the order the steers were sent over the same socket, so the
  // oldest outstanding one is the one being answered.
  private handleSteered(meta: ConnMeta, promptId: string, ok: boolean): void {
    const agent = this.ownedAgent(meta, promptId)
    if (!agent) return
    const waiting = this.steers.get(promptId)
    const steer = waiting?.shift()
    if (waiting?.length === 0) this.steers.delete(promptId)
    if (!steer || ok) return
    this.requeueSteer(agent, steer)
  }

  // The run would not take the message, so fall back to a normal prompt. The
  // fresh route event supersedes the optimistic 'steered' one in the UI.
  private requeueSteer(agent: AgentState, steer: PendingSteer): void {
    const thread = this.threads.get(steer.threadId)
    if (!thread) return
    if (!agent.runner && !agent.dropTimer) {
      this.systemMessage(`${agent.label} went offline before getting to this.`, steer.threadId)
      return
    }
    const promptId = randomUUID()
    thread.queue.push({
      promptId,
      agentId: agent.id,
      text: steer.text,
      byName: steer.byName,
      authorId: steer.authorId ?? '',
      threadId: steer.threadId,
      mentions: [agent.id],
      docMentions: this.docMentionRefs(steer.text),
      attachments: steer.attachments,
      messageId: steer.messageId
    })
    this.routed(steer.messageId, steer.threadId, promptId, 'queued')
    this.broadcastQueue(thread)
    this.runThread(thread)
  }

  private routed(messageId: string, threadId: string, promptId: string, mode: 'queued' | 'steered'): void {
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'message.route', messageId, threadId, promptId, mode })
  }

  private runThread(thread: Thread): void {
    if (thread.running) return
    const next = thread.queue[0]
    if (!next) return
    const agent = this.agents.get(next.agentId)
    if (!agent?.runner) return
    thread.queue.shift()
    this.broadcastQueue(thread)
    this.emitThreadMessage(next)
    thread.running = next.promptId
    agent.running.add(next.promptId)
    agent.runs.set(next.promptId, { steps: new Map(), tokens: 0, startedAt: Date.now(), entry: next })
    this.prompts.set(next.promptId, { agentId: agent.id, threadId: thread.id, messageId: next.messageId })
    const reactions = this.pendingReactions(agent.id)
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.start',
      promptId: next.promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      promptText: next.text,
      byName: next.byName,
      threadId: thread.id,
      reactionIds: reactions.length > 0 ? reactions.map(reaction => reaction.id) : undefined
    })
    this.send(agent.runner, {
      type: 'prompt',
      promptId: next.promptId,
      agentId: agent.id,
      threadId: thread.id,
      text: this.buildPrompt(agent, next, reactions),
      settings: agent.settings,
      attachments: next.attachments,
      designBoard: this.boardOf(thread)
    })
  }

  private finishPrompt(agent: AgentState, promptId: string, result: { ok: boolean; text?: string; error?: string }): void {
    const threadId = this.prompts.get(promptId)?.threadId
    this.prompts.delete(promptId)
    agent.running.delete(promptId)
    const thread = threadId ? this.threads.get(threadId) : undefined
    if (thread?.running === promptId) thread.running = null
    if (threadId) {
      for (const [stepId, entry] of agent.runs.get(promptId)?.steps ?? []) {
        entry.step.status = 'done'
        this.persistStep(agent, promptId, threadId, stepId)
      }
    }
    agent.runs.delete(promptId)
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.end',
      promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      threadId,
      ...result
    })
    // Steers the run never acknowledged died with it, so give them a turn of
    // their own rather than losing them.
    const orphaned = this.steers.get(promptId) ?? []
    this.steers.delete(promptId)
    for (const steer of orphaned) this.requeueSteer(agent, steer)
    if (thread) this.runThread(thread)
  }

  private pendingReactions(agentId: string): ReactionEvent[] {
    const delivered = new Set(
      this.events
        .filter((event): event is Extract<SessionEvent, { kind: 'agent.start' }> => event.kind === 'agent.start')
        .flatMap(event => event.reactionIds ?? [])
    )
    const latest = new Map<string, ReactionEvent>()
    for (const event of this.events) {
      if (event.kind !== 'message.reaction' || event.targetAuthorId !== agentId) continue
      latest.set(JSON.stringify([event.targetId, event.memberId, event.emoji]), event)
    }
    return [...latest.values()].filter(event => event.active && !delivered.has(event.id))
  }

  private buildPrompt(agent: AgentState, prompt: QueuedPrompt, reactions: ReactionEvent[]): string {
    const people = [...this.members.values()].map(m => m.name).join(', ')
    const context = this.events
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'message' | 'agent.end' }> =>
          (e.kind === 'message' || e.kind === 'agent.end') && e.threadId === prompt.threadId
      )
      .slice(-CONTEXT_EVENT_LIMIT)
    const transcript = context
      .map(e => {
        if (e.kind === 'message') {
          const images = (e.attachments ?? []).map(a => `[image: ${a.name}]`).join(' ')
          return `${e.authorName}: ${[e.text, images].filter(Boolean).join(' ')}`
        }
        if (e.ok && e.text) return `${e.agentLabel}: ${e.text}`
        return null
      })
      .filter(Boolean)
      .join('\n')
    const others = [...this.agents.values()].filter(a => a.id !== agent.id).map(a => a.label)
    const lines = [
      `You are ${agent.label}, one of several agents in a crew session with ${people}.`,
      `You share a project folder and can read and edit files in it.`,
      `You are in a focused thread. Only this thread's messages are shown here.`
    ]
    if (others.length > 0) {
      lines.push(
        `Other agents in the session: ${others.join(', ')}. A mention like @name in a thread hands that message to the named agent, so replies from several agents can appear here.`
      )
    }
    lines.push(``, `Thread so far:`, transcript || '(nothing yet)')
    const referenced = this.referencedPages(context, prompt)
    for (const page of referenced) {
      const doc = this.docs.get(page)
      if (!doc) continue
      lines.push(``, `Doc page "${doc.title}", referenced above as #${doc.title}:`, this.docExcerpt(doc.text))
    }
    if (reactions.length > 0) {
      lines.push(``, `Reactions to your earlier messages since your last turn:`)
      for (const reaction of reactions) {
        const text = this.reactionTarget(reaction.targetId)?.text.replace(/\s+/g, ' ').trim().slice(0, 180)
        lines.push(
          text
            ? `- ${reaction.memberName} reacted ${reaction.emoji} to your message: ${JSON.stringify(text)}`
            : `- ${reaction.memberName} reacted ${reaction.emoji} to one of your earlier messages.`
        )
      }
    }
    lines.push(``, `Continue as ${agent.label}. Reply to the latest message from ${prompt.byName}.`)
    return lines.join('\n')
  }

  private referencedPages(
    context: Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>>,
    prompt: QueuedPrompt
  ): string[] {
    const docs = Object.fromEntries(this.docs)
    const pages: string[] = []
    const add = (page: string | null) => {
      if (page && !pages.includes(page)) pages.push(page)
    }
    for (const event of context) {
      if (event.kind === 'message' && event.docMentions) {
        for (const ref of event.docMentions) add(resolveDocRef(docs, ref))
      } else {
        for (const page of docMentionsIn(event.text ?? '', docs)) add(page)
      }
    }
    for (const ref of prompt.docMentions) add(resolveDocRef(docs, ref))
    return pages
  }

  private docExcerpt(text: string): string {
    if (text.length <= MAX_DOC_PROMPT_CHARS) return text
    return `${text.slice(0, MAX_DOC_PROMPT_CHARS)}\n[doc cut off here]`
  }

  private handleSettings(id: string, settings: AgentSettings): void {
    const agent = this.agents.get(id)
    if (!agent) return
    agent.settings = resolveSettings(agent.fields, { ...agent.settings, ...settings })
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.updated', agentId: id, settings: agent.settings })
    this.persistMeta()
  }

  private registerAgent(ws: WebSocket, member: Member, llm: RegisteredLlm): void {
    const id = agentId(member.name, llm.instanceId)
    const meta = this.meta.get(ws)
    const existing = this.agents.get(id)
    if (existing) {
      if (existing.dropTimer) {
        clearTimeout(existing.dropTimer)
        existing.dropTimer = null
      }
      existing.runner = ws
      existing.fields = llm.fields
      existing.steerable = llm.steerable === true
      existing.settings = resolveSettings(llm.fields, existing.settings)
      meta?.agentIds.push(id)
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.online', agentId: id, label: existing.label })
      this.runThreadsOf(existing)
      return
    }
    const label = this.uniqueLabel(llm.label)
    const agent: AgentState = {
      id,
      label,
      provider: llm.provider,
      ownerId: member.id,
      ownerName: member.name,
      settings: resolveSettings(llm.fields, llm.settings ?? {}),
      fields: llm.fields,
      steerable: llm.steerable === true,
      runner: ws,
      running: new Set(),
      runs: new Map(),
      dropTimer: null
    }
    this.agents.set(id, agent)
    meta?.agentIds.push(id)
    this.broadcast({ type: 'agent.added', agent: this.pooled(agent) })
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.online', agentId: id, label })
    this.persistMeta()
  }

  private deregisterAgent(ws: WebSocket, member: Member, instanceId: string): void {
    const id = agentId(member.name, instanceId)
    const agent = this.agents.get(id)
    if (!agent) return
    if (agent.dropTimer) {
      clearTimeout(agent.dropTimer)
      agent.dropTimer = null
    }
    this.clearQueues(agent, `${agent.label} was removed before getting to this.`)
    this.dropRunning(agent, `${agent.label} was removed.`)
    this.agents.delete(id)
    const meta = this.meta.get(ws)
    if (meta) meta.agentIds = meta.agentIds.filter(a => a !== id)
    this.broadcast({ type: 'agent.removed', agentId: id })
    this.persistMeta()
  }

  private uniqueLabel(base: string): string {
    const taken = new Set([...this.agents.values()].map(a => a.label.toLowerCase()))
    if (!taken.has(base.toLowerCase())) return base
    let i = 2
    while (taken.has(`${base} ${i}`.toLowerCase())) i++
    return `${base} ${i}`
  }

  private titleFrom(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim()
    return flat.length > TITLE_LIMIT ? flat.slice(0, TITLE_LIMIT) + '…' : flat
  }

  private runThreadsOf(agent: AgentState): void {
    for (const thread of this.threads.values()) {
      if (thread.queue[0]?.agentId === agent.id) this.runThread(thread)
    }
  }

  private clearQueues(agent: AgentState, reason: string): void {
    for (const thread of this.threads.values()) {
      const dropped = thread.queue.filter(q => q.agentId === agent.id)
      if (dropped.length === 0) continue
      thread.queue = thread.queue.filter(q => q.agentId !== agent.id)
      for (const prompt of dropped) this.systemMessage(reason, prompt.threadId)
      this.broadcastQueue(thread)
      // Clearing the head can unblock messages for agents still here.
      this.runThread(thread)
    }
    // Steers still waiting on an ack go the same way as the queue: there is no
    // run left to fold them into, and nothing to re-queue them onto.
    for (const promptId of agent.running) {
      for (const steer of this.steers.get(promptId) ?? []) this.systemMessage(reason, steer.threadId)
      this.steers.delete(promptId)
    }
  }

  private dropRunning(agent: AgentState, reason: string): void {
    for (const promptId of [...agent.running]) this.finishPrompt(agent, promptId, { ok: false, error: reason })
  }

  private statusOf(agent: AgentState): AgentStatus {
    if (!agent.runner) return 'offline'
    return agent.running.size > 0 ? 'busy' : 'idle'
  }

  private pooled(agent: AgentState): PooledAgent {
    const { runner, running, runs, dropTimer, ...rest } = agent
    const live: Record<string, LiveRun> = {}
    for (const [promptId, run] of runs) {
      live[promptId] = {
        steps: [...run.steps.values()].map(entry => entry.step),
        tokens: run.tokens,
        startedAt: run.startedAt
      }
    }
    return { ...rest, status: this.statusOf(agent), runs: live }
  }

  private memberFor(name: string): Member {
    const key = name.trim().toLowerCase()
    let member = this.members.get(key)
    if (!member) {
      member = { id: randomUUID(), name: name.trim(), connections: new Set() }
      this.members.set(key, member)
    }
    return member
  }

  private detach(ws: WebSocket, code = 1006): void {
    const meta = this.meta.get(ws)
    if (!meta) return
    this.meta.delete(ws)
    const member = this.members.get(meta.memberKey)
    if (member) {
      member.connections.delete(ws)
      if (member.connections.size === 0) {
        this.emit({ id: randomUUID(), ts: Date.now(), kind: 'person.left', memberId: member.id, name: member.name })
      }
      if (meta.role === 'ui') this.dropDesignPresence(member)
    }
    const left = code === 1000 || code === 1001 || code === 1005
    for (const id of meta.agentIds) {
      const agent = this.agents.get(id)
      if (!agent || agent.runner !== ws) continue
      agent.runner = null
      if (left) {
        this.clearQueues(agent, `${agent.label} went offline before getting to this.`)
        this.dropRunning(agent, `${agent.label} disconnected.`)
      } else {
        agent.dropTimer = setTimeout(() => {
          agent.dropTimer = null
          if (agent.runner) return
          this.clearQueues(agent, `${agent.label} went offline before getting to this.`)
          this.dropRunning(agent, `${agent.label} disconnected.`)
        }, this.resumeGraceMs)
        agent.dropTimer.unref?.()
      }
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.offline', agentId: id, label: agent.label })
    }
    this.persistMeta()
  }

  private systemMessage(text: string, threadId?: string): void {
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'message',
      authorId: SYSTEM_AUTHOR_ID,
      authorName: SYSTEM_AUTHOR_NAME,
      text,
      mentions: [],
      threadId
    })
  }

  private emit(event: SessionEvent, opts: { persist?: boolean } = {}): void {
    const ephemeral =
      event.kind === 'doc' ||
      event.kind === 'doc.titled' ||
      event.kind === 'doc.renamed' ||
      event.kind === 'doc.deleted' ||
      event.kind === 'message.edited'
    if (!ephemeral) this.events.push(event)
    if (opts.persist !== false) this.store.appendEvent(event)
    this.broadcast({ type: 'event', event })
    if (opts.persist !== false) this.onSyncNeeded?.()
  }

  private broadcast(msg: ServerMessage): void {
    for (const [ws, meta] of this.meta) {
      if (meta.role === 'ui') this.send(ws, msg)
    }
  }

  private broadcastExcept(skip: WebSocket, msg: ServerMessage): void {
    for (const [ws, meta] of this.meta) {
      if (meta.role === 'ui' && ws !== skip) this.send(ws, msg)
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }

  private persistMeta(): void {
    this.store.saveSession({
      code: this.code,
      createdAt: this.createdAt,
      members: [...this.members.values()].map(m => ({ id: m.id, name: m.name })),
      agents: [...this.agents.values()].map(({ runner, running, runs, dropTimer, ...agent }) => agent)
    })
  }
}
