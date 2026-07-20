import { randomBytes, randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import { SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME, type SessionEvent } from '../shared/events'
import { agentId, resolveSettings, type AgentActivity, type AgentSettings, type PooledAgent } from '../shared/llm'
import type { ClientMessage, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
import { Store } from './store'

interface Member {
  id: string
  name: string
  connections: Set<WebSocket>
}

interface AgentState extends Omit<PooledAgent, 'activities'> {
  runner: WebSocket | null
  queue: QueuedPrompt[]
  activities: Map<string, AgentActivity>
}

interface QueuedPrompt {
  promptId: string
  text: string
  byName: string
  threadId: string
}

interface Thread {
  id: string
  agentId: string
  agentLabel: string
  title: string
  createdBy: string
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

export class CrewSession {
  readonly code: string
  private createdAt: number
  private members = new Map<string, Member>()
  private agents = new Map<string, AgentState>()
  private threads = new Map<string, Thread>()
  private events: SessionEvent[] = []
  private docs = new Map<string, string>()
  private meta = new Map<WebSocket, ConnMeta>()
  private prompts = new Map<string, PromptRef>()
  onSyncNeeded: (() => void) | null = null

  constructor(private store: Store) {
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
        status: 'offline',
        runner: null,
        queue: [],
        activities: new Map()
      })
    }
    this.events = store.loadEvents()
    for (const event of this.events) {
      if (event.kind === 'thread.started') {
        this.threads.set(event.threadId, {
          id: event.threadId,
          agentId: event.agentId,
          agentLabel: event.agentLabel,
          title: event.title,
          createdBy: event.byName
        })
      }
    }
    for (const [page, text] of Object.entries(store.loadDocs())) this.docs.set(page, text)
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
      events: this.events.slice(-SNAPSHOT_EVENT_LIMIT),
      docs: Object.fromEntries(this.docs)
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
        if (meta.role === 'ui') this.handleChat(member, msg.text, msg.mentions, msg.threadId)
        break
      case 'doc.update':
        if (meta.role === 'ui') this.handleDoc(member, msg.page, msg.text)
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
      case 'agent.chunk':
        this.handleChunk(meta, msg.promptId, msg.text)
        break
      case 'agent.activity':
        this.handleActivity(meta, msg.promptId, msg.activity)
        break
      case 'agent.done':
        this.handleDone(meta, msg.promptId, msg.text)
        break
      case 'agent.error':
        this.handleError(meta, msg.promptId, msg.message)
        break
    }
  }

  private handleChat(member: Member, text: string, mentions: string[], threadId?: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    if (threadId) {
      const thread = this.threads.get(threadId)
      if (!thread) return
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'message',
        authorId: member.id,
        authorName: member.name,
        text: trimmed,
        mentions: [thread.agentId],
        threadId
      })
      const agent = this.agents.get(thread.agentId)
      if (!agent) return
      this.enqueuePrompt(agent, trimmed, member.name, threadId)
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
        mentions
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
        title: this.titleFrom(trimmed),
        createdBy: member.name
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
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'message',
        authorId: member.id,
        authorName: member.name,
        text: trimmed,
        mentions: [id],
        threadId: newThreadId
      })
      this.enqueuePrompt(agent, trimmed, member.name, newThreadId)
    }
  }

  private handleDoc(member: Member, page: string, text: string): void {
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
  }

  private handleChunk(meta: ConnMeta, promptId: string, text: string): void {
    const agent = this.ownedAgent(meta, promptId)
    if (!agent) return
    this.broadcast({ type: 'agent.chunk', promptId, agentId: agent.id, threadId: this.prompts.get(promptId)?.threadId, text })
  }

  private handleActivity(meta: ConnMeta, promptId: string, activity: AgentActivity): void {
    const agent = this.ownedAgent(meta, promptId)
    if (!agent) return
    const existing = agent.activities.get(activity.id)
    const merged: AgentActivity = activity.name
      ? activity
      : { ...(existing ?? { kind: 'tool' as const, name: '' }), id: activity.id, status: activity.status }
    agent.activities.set(activity.id, merged)
    this.broadcast({
      type: 'agent.activity',
      promptId,
      agentId: agent.id,
      threadId: this.prompts.get(promptId)?.threadId,
      activity: merged
    })
  }

  private handleCancel(promptId: string): void {
    const ref = this.prompts.get(promptId)
    if (!ref) return
    const agent = this.agents.get(ref.agentId)
    if (agent?.runner) this.send(agent.runner, { type: 'cancel', promptId })
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

  private enqueuePrompt(agent: AgentState, text: string, byName: string, threadId: string): void {
    if (!agent.runner || agent.status === 'offline') {
      this.systemMessage(`${agent.label} is not here right now.`, threadId)
      return
    }
    agent.queue.push({ promptId: randomUUID(), text, byName, threadId })
    this.runNext(agent)
    this.broadcastWaiting(agent)
  }

  private broadcastWaiting(agent: AgentState): void {
    this.broadcast({
      type: 'agent.waiting',
      agentId: agent.id,
      waitingThreadIds: agent.queue.map(p => p.threadId)
    })
  }

  private runNext(agent: AgentState): void {
    if (agent.status !== 'idle' || !agent.runner) return
    const next = agent.queue.shift()
    if (!next) return
    agent.status = 'busy'
    agent.activities.clear()
    this.broadcastWaiting(agent)
    this.prompts.set(next.promptId, { agentId: agent.id, threadId: next.threadId })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.start',
      promptId: next.promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      promptText: next.text,
      byName: next.byName,
      threadId: next.threadId
    })
    this.send(agent.runner, {
      type: 'prompt',
      promptId: next.promptId,
      agentId: agent.id,
      text: this.buildPrompt(agent, next),
      settings: agent.settings
    })
  }

  private finishPrompt(agent: AgentState, promptId: string, result: { ok: boolean; text?: string; error?: string }): void {
    const threadId = this.prompts.get(promptId)?.threadId
    this.prompts.delete(promptId)
    agent.status = agent.runner ? 'idle' : 'offline'
    for (const activity of agent.activities.values()) activity.status = 'done'
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
    this.runNext(agent)
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
        if (e.kind === 'message') return `${e.authorName}: ${e.text}`
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
      existing.status = 'idle'
      existing.fields = llm.fields
      existing.settings = resolveSettings(llm.fields, existing.settings)
      meta?.agentIds.push(id)
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.online', agentId: id, label: existing.label })
      this.runNext(existing)
      return
    }
    const label = this.uniqueLabel(llm.label)
    const agent: AgentState = {
      id,
      label,
      provider: llm.provider,
      ownerId: member.id,
      ownerName: member.name,
      status: 'idle',
      settings: resolveSettings(llm.fields, llm.settings ?? {}),
      fields: llm.fields,
      runner: ws,
      queue: [],
      activities: new Map()
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
    const inFlight = [...this.prompts.entries()].find(([, ref]) => ref.agentId === id)
    if (inFlight) this.finishPrompt(agent, inFlight[0], { ok: false, error: `${agent.label} was removed.` })
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

  private pooled(agent: AgentState): PooledAgent {
    const { runner, queue, activities, ...rest } = agent
    return { ...rest, activities: [...activities.values()], waitingThreadIds: queue.map(p => p.threadId) }
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
      const dropped = agent.queue.splice(0)
      agent.activities.clear()
      this.broadcastWaiting(agent)
      for (const prompt of dropped) {
        this.systemMessage(`${agent.label} went offline before getting to this.`, prompt.threadId)
      }
      const inFlight = [...this.prompts.entries()].find(([, ref]) => ref.agentId === id)
      if (inFlight) {
        this.finishPrompt(agent, inFlight[0], { ok: false, error: `${agent.label} disconnected.` })
      }
      agent.status = 'offline'
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
    this.events.push(event)
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
      agents: [...this.agents.values()].map(({ runner, queue, status, activities, ...agent }) => agent)
    })
  }
}
