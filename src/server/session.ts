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
import { SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME, trimEvents, type SessionEvent } from '../shared/events'
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
import type { ClientMessage, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
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
}

interface RunState {
  steps: Map<string, StepEntry>
  tokens: number
  startedAt: number
}

interface StepEntry {
  step: AgentStep
  persisted: boolean
}

interface QueuedPrompt {
  promptId: string
  text: string
  byName: string
  authorId: string
  threadId: string
  attachments: Attachment[]
  messageId: string
  emitted: boolean
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
  archived: boolean
  queue: QueuedPrompt[]
  running: string | null
}

interface PromptRef {
  agentId: string
  threadId: string
}

interface ConnMeta {
  role: 'ui' | 'runner'
  memberKey: string
  agentIds: string[]
}

const SNAPSHOT_EVENT_LIMIT = 500
const CONTEXT_EVENT_LIMIT = 20
const TITLE_LIMIT = 80
const CANCEL_REPORT_TIMEOUT_MS = 15000

export class CrewSession {
  readonly code: string
  private createdAt: number
  private members = new Map<string, Member>()
  private agents = new Map<string, AgentState>()
  private threads = new Map<string, Thread>()
  private events: SessionEvent[] = []
  private docs = new Map<string, string>()
  private docTitles = new Map<string, string>()
  private docRenames = new Map<string, { to: string; ts: number }>()
  private meta = new Map<WebSocket, ConnMeta>()
  private prompts = new Map<string, PromptRef>()
  private steers = new Map<string, PendingSteer[]>()
  private cancelTimeoutMs: number
  onSyncNeeded: (() => void) | null = null

  constructor(private store: Store, opts: { cancelTimeoutMs?: number } = {}) {
    this.cancelTimeoutMs = opts.cancelTimeoutMs ?? CANCEL_REPORT_TIMEOUT_MS
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
        runs: new Map()
      })
    }
    const loaded = store.loadEvents()
    const deleted = new Set(loaded.filter(e => e.kind === 'message.deleted').map(e => e.messageId))
    const edits = new Map<string, string>()
    for (const event of loaded) {
      if (event.kind === 'message.edited') edits.set(event.messageId, event.text)
    }
    this.events = loaded
      .filter(
        e => e.kind !== 'message.deleted' && e.kind !== 'message.edited' && !(e.kind === 'message' && deleted.has(e.id))
      )
      .map(e => (e.kind === 'message' && edits.has(e.id) ? { ...e, text: edits.get(e.id)! } : e))
    for (const event of this.events) {
      if (event.kind === 'thread.started') {
        this.threads.set(event.threadId, {
          id: event.threadId,
          agentId: event.agentId,
          agentLabel: event.agentLabel,
          title: event.title,
          createdBy: event.byName,
          archived: false,
          queue: [],
          running: null
        })
      }
      if (event.kind === 'thread.archived') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.archived = true
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
    for (const [page, text] of Object.entries(store.loadDocs())) this.docs.set(page, text)
    for (const [page, title] of Object.entries(store.loadTitles())) this.docTitles.set(page, title)
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
    ws.on('close', () => this.detach(ws))
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
      docTitles: Object.fromEntries(this.docTitles),
      queues: Object.fromEntries(
        [...this.threads.values()]
          .filter(thread => thread.queue.length > 0)
          .map(thread => [
            thread.id,
            thread.queue.map(({ promptId, authorId, byName, text }) => ({
              promptId,
              authorId,
              authorName: byName,
              text
            }))
          ])
      )
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
        if (meta.role === 'ui') this.handleChat(member, msg.text, msg.mentions, msg.threadId, msg.attachments)
        break
      case 'chat.delete':
        if (meta.role === 'ui') this.handleDeleteMessage(member, msg.messageId)
        break
      case 'thread.archive':
        if (meta.role === 'ui') this.handleArchiveThread(member, msg.threadId)
        break
      case 'doc.update':
        if (meta.role === 'ui') this.handleDoc(member, msg.page, msg.text)
        break
      case 'doc.title':
        if (meta.role === 'ui') this.handleDocTitle(member, msg.page, msg.title)
        break
      case 'doc.rename':
        if (meta.role === 'ui') this.handleDocRename(member, msg.from, msg.to)
        break
      case 'doc.delete':
        if (meta.role === 'ui') this.handleDocDelete(member, msg.page)
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
        this.handleStep(meta, msg.promptId, msg.step)
        break
      case 'agent.usage':
        if (meta.role === 'runner') this.handleUsage(meta, member, msg.instanceId, msg.usage)
        break
      case 'agent.tokens':
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
    incoming?: OutgoingAttachment[]
  ): void {
    const trimmed = text.trim()
    const attachments = this.saveAttachments(incoming)
    if (!trimmed && attachments.length === 0) return
    if (threadId) {
      const thread = this.threads.get(threadId)
      if (!thread) return
      const agent = this.agents.get(thread.agentId)
      if (!agent) return
      this.enqueuePrompt(agent, member, trimmed, threadId, attachments)
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
        attachments
      })
      return
    }
    for (const id of ids) {
      const agent = this.agents.get(id)!
      const newThreadId = randomUUID()
      const thread: Thread = {
        id: newThreadId,
        agentId: id,
        agentLabel: agent.label,
        title: this.titleFrom(trimmed || attachments.map(a => a.name).join(', ')),
        createdBy: member.name,
        archived: false,
        queue: [],
        running: null
      }
      this.threads.set(newThreadId, thread)
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'thread.started',
        threadId: newThreadId,
        agentId: id,
        agentLabel: agent.label,
        title: thread.title,
        byName: member.name
      })
      this.enqueuePrompt(agent, member, trimmed, newThreadId, attachments)
    }
  }

  private emitThreadMessage(entry: QueuedPrompt, agentId: string): void {
    if (entry.emitted) return
    entry.emitted = true
    this.emit({
      id: entry.messageId,
      ts: Date.now(),
      kind: 'message',
      authorId: entry.authorId,
      authorName: entry.byName,
      text: entry.text,
      mentions: [agentId],
      threadId: entry.threadId,
      attachments: entry.attachments
    })
  }

  private handleDeleteMessage(member: Member, messageId: string): void {
    const index = this.events.findIndex(e => e.kind === 'message' && e.id === messageId)
    if (index === -1) return
    const event = this.events[index]
    if (event.kind !== 'message' || event.authorId !== member.id) return
    this.events.splice(index, 1)
    const tombstone: SessionEvent = { id: randomUUID(), ts: Date.now(), kind: 'message.deleted', messageId }
    this.store.appendEvent(tombstone)
    this.broadcast({ type: 'event', event: tombstone })
    this.onSyncNeeded?.()
  }

  private handleArchiveThread(member: Member, threadId: string): void {
    const thread = this.threads.get(threadId)
    if (!thread || thread.archived) return
    thread.archived = true
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.archived', threadId, byName: member.name })
  }

  private saveAttachments(incoming?: OutgoingAttachment[]): Attachment[] {
    const saved: Attachment[] = []
    for (const item of (incoming ?? []).slice(0, MAX_ATTACHMENTS)) {
      if (!isImageType(item.mime)) continue
      const data = Buffer.from(item.data, 'base64')
      if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) continue
      const id = randomUUID()
      const file = `${id}.${extensionFor(item.mime)}`
      try {
        this.store.saveAttachment(file, data)
      } catch {
        continue
      }
      saved.push({ id, name: this.safeName(item.name), mime: item.mime, size: data.length, file })
    }
    return saved
  }

  private safeName(name: string): string {
    const flat = name.replace(/[\r\n]+/g, ' ').trim()
    return flat.slice(0, 120) || 'image'
  }

  attachmentPath(file: string): string | null {
    return this.store.attachmentPath(file)
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

  private handleDoc(member: Member, page: string, text: string): void {
    page = this.followRenames(page)
    try {
      this.store.saveDoc(page, text)
    } catch {
      return
    }
    this.docs.set(page, text)
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc', page, text, byName: member.name },
      { persist: false }
    )
    this.onSyncNeeded?.()
  }

  private handleDocTitle(member: Member, page: string, title: string): void {
    page = this.followRenames(page)
    if (!this.docs.has(page)) return
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
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
    let titlesChanged = false
    for (const key of [...this.docs.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) this.docs.delete(key)
    }
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
    found.entry.text = trimmed
    if (found.entry.emitted) {
      const message = this.events.find(e => e.kind === 'message' && e.id === found.entry.messageId)
      if (message && message.kind === 'message') {
        message.text = trimmed
        this.emit({ id: randomUUID(), ts: Date.now(), kind: 'message.edited', messageId: message.id, text: trimmed })
      }
    }
    this.broadcastQueue(found.thread)
  }

  private handleQueueRemove(member: Member, promptId: string): void {
    const found = this.queuedEntry(promptId)
    if (!found || found.entry.authorId !== member.id) return
    found.thread.queue = found.thread.queue.filter(q => q.promptId !== promptId)
    if (found.entry.emitted) this.handleDeleteMessage(member, found.entry.messageId)
    this.broadcastQueue(found.thread)
  }

  private handleDocRename(member: Member, from: string, to: string): void {
    if (from === to || from === 'main' || !this.docs.has(from)) return
    if (to === from || to.startsWith(`${from}/`)) return
    try {
      this.store.renameDoc(from, to)
    } catch {
      return
    }
    for (const [page, text] of [...this.docs.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue
      this.docs.delete(page)
      this.docs.set(to + page.slice(from.length), text)
    }
    let titlesChanged = false
    for (const [page, title] of [...this.docTitles.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue
      this.docTitles.delete(page)
      this.docTitles.set(to + page.slice(from.length), title)
      titlesChanged = true
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.docRenames.set(from, { to, ts: Date.now() })
    for (const [key, move] of this.docRenames) {
      if (Date.now() - move.ts > 10000) this.docRenames.delete(key)
    }
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.renamed', from, to, byName: member.name },
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
    this.broadcast({ type: 'agent.step', promptId, agentId: agent.id, threadId: ref.threadId, step: merged })
    if (merged.status === 'done') this.persistStep(agent, promptId, ref.threadId, step.id)
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

  private ownedAgent(meta: ConnMeta, promptId: string): AgentState | null {
    const ref = this.prompts.get(promptId)
    if (!ref) return null
    const agent = this.agents.get(ref.agentId)
    if (!agent || !meta.agentIds.includes(agent.id)) return null
    return agent
  }

  private enqueuePrompt(agent: AgentState, member: Member, text: string, threadId: string, attachments: Attachment[]): void {
    const thread = this.threads.get(threadId)
    if (!thread) return
    const entry: QueuedPrompt = {
      promptId: randomUUID(),
      text,
      byName: member.name,
      authorId: member.id,
      threadId,
      attachments,
      messageId: randomUUID(),
      emitted: false
    }
    if (!agent.runner) {
      this.emitThreadMessage(entry, agent.id)
      this.systemMessage(`${agent.label} is not here right now.`, threadId)
      return
    }
    // A message that arrives mid-run goes straight into the run when the agent
    // can take it, so it steers the work in progress instead of waiting.
    if (thread.running && agent.steerable) {
      this.emitThreadMessage(entry, agent.id)
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
    this.broadcastQueue(thread)
    this.runThread(thread)
  }

  private broadcastQueue(thread: Thread): void {
    this.broadcast({
      type: 'queue.state',
      threadId: thread.id,
      items: thread.queue.map(({ promptId, authorId, byName, text }) => ({
        promptId,
        authorId,
        authorName: byName,
        text
      }))
    })
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
    if (!agent.runner) {
      this.systemMessage(`${agent.label} went offline before getting to this.`, steer.threadId)
      return
    }
    const promptId = randomUUID()
    thread.queue.push({
      promptId,
      text: steer.text,
      byName: steer.byName,
      authorId: steer.authorId ?? '',
      threadId: steer.threadId,
      attachments: steer.attachments,
      messageId: steer.messageId,
      emitted: true
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
    const agent = this.agents.get(thread.agentId)
    if (!agent?.runner) return
    const next = thread.queue.shift()
    if (!next) return
    this.broadcastQueue(thread)
    this.emitThreadMessage(next, agent.id)
    thread.running = next.promptId
    agent.running.add(next.promptId)
    agent.runs.set(next.promptId, { steps: new Map(), tokens: 0, startedAt: Date.now() })
    this.prompts.set(next.promptId, { agentId: agent.id, threadId: thread.id })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.start',
      promptId: next.promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      promptText: next.text,
      byName: next.byName,
      threadId: thread.id
    })
    this.send(agent.runner, {
      type: 'prompt',
      promptId: next.promptId,
      agentId: agent.id,
      threadId: thread.id,
      text: this.buildPrompt(agent, next),
      settings: agent.settings,
      attachments: next.attachments
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

  private buildPrompt(agent: AgentState, prompt: QueuedPrompt): string {
    const people = [...this.members.values()].map(m => m.name).join(', ')
    const transcript = this.events
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'message' | 'agent.end' }> =>
          (e.kind === 'message' || e.kind === 'agent.end') && e.threadId === prompt.threadId
      )
      .slice(-CONTEXT_EVENT_LIMIT)
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
    return [
      `You are ${agent.label}, one of several agents in a crew session with ${people}.`,
      `You share a project folder and can read and edit files in it.`,
      `You are in a focused thread. Only this thread's messages are shown here.`,
      ``,
      `Thread so far:`,
      transcript || '(nothing yet)',
      ``,
      `Continue as ${agent.label}. Reply to the latest message from ${prompt.byName}.`
    ].join('\n')
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
      runs: new Map()
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
      if (thread.agentId === agent.id) this.runThread(thread)
    }
  }

  private clearQueues(agent: AgentState, reason: string): void {
    for (const thread of this.threads.values()) {
      if (thread.agentId !== agent.id) continue
      for (const prompt of thread.queue.splice(0)) this.systemMessage(reason, prompt.threadId)
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
    const { runner, running, runs, ...rest } = agent
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

  private detach(ws: WebSocket): void {
    const meta = this.meta.get(ws)
    if (!meta) return
    this.meta.delete(ws)
    const member = this.members.get(meta.memberKey)
    if (member) {
      member.connections.delete(ws)
      if (member.connections.size === 0) {
        this.emit({ id: randomUUID(), ts: Date.now(), kind: 'person.left', memberId: member.id, name: member.name })
      }
    }
    for (const id of meta.agentIds) {
      const agent = this.agents.get(id)
      if (!agent || agent.runner !== ws) continue
      agent.runner = null
      this.clearQueues(agent, `${agent.label} went offline before getting to this.`)
      this.dropRunning(agent, `${agent.label} disconnected.`)
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

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
  }

  private persistMeta(): void {
    this.store.saveSession({
      code: this.code,
      createdAt: this.createdAt,
      members: [...this.members.values()].map(m => ({ id: m.id, name: m.name })),
      agents: [...this.agents.values()].map(({ runner, running, runs, ...agent }) => agent)
    })
  }
}
