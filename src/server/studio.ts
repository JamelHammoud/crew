import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import type { ServerMessage } from '../shared/protocol'
import {
  emptyStudioDoc,
  isStudioId,
  sanitizeNode,
  STUDIO_CHAT_LIMIT,
  absoluteOrigin,
  type StudioChatEntry,
  type StudioDoc,
  type StudioMeta,
  type StudioNode,
  type StudioPresence,
  type StudioPreviewNode
} from '../shared/studio'
import { applyOps, parseStudioOps, sanitizeOps, type StudioOp } from '../shared/studio-ops'
import { agentChatEntry, buildCodePrompt, designPrompt } from './studio-prompt'
import type { Store } from './store'

export interface StudioPromptRef {
  studioId: string
  pageId?: string
  build?: boolean
}

interface StudioIo {
  send: (ws: WebSocket, msg: ServerMessage) => void
  broadcast: (msg: ServerMessage) => void
  syncNeeded: () => void
}

interface Viewer {
  studioId: string
  presence: StudioPresence
}

const SAVE_DEBOUNCE_MS = 400
const INDEX_DEBOUNCE_MS = 300
const PREVIEW_LIMIT = 48
const NAME_LIMIT = 60

export class StudioManager {
  private docs = new Map<string, StudioDoc>()
  private viewers = new Map<WebSocket, Viewer>()
  private threads = new Map<string, Map<string, string>>()
  private threadRefs = new Map<string, { studioId: string; agentId: string }>()
  private threadPages = new Map<string, string>()
  private saveTimers = new Map<string, NodeJS.Timeout>()
  private indexTimer: NodeJS.Timeout | null = null

  constructor(
    private store: Store,
    private io: StudioIo
  ) {
    for (const doc of store.loadStudios()) {
      this.docs.set(doc.id, {
        ...doc,
        assets: doc.assets ?? [],
        chat: doc.chat ?? [],
        agents: doc.agents ?? [],
        rev: doc.rev ?? 0
      })
    }
  }

  doc(studioId: string): StudioDoc | undefined {
    return this.docs.get(studioId)
  }

  index(): StudioMeta[] {
    return [...this.docs.values()].map(doc => this.metaOf(doc))
  }

  create(byId: string, byName: string, name: string, nodes?: StudioNode[]): StudioDoc {
    const doc = emptyStudioDoc(randomUUID(), this.cleanName(name), byName)
    this.docs.set(doc.id, doc)
    if (nodes && nodes.length > 0) {
      const clean = nodes.map(sanitizeNode).filter((n): n is StudioNode => n !== null)
      if (clean.length > 0) applyOps(doc, [{ kind: 'upsert', nodes: clean, pageId: doc.pages[0].id }])
    }
    this.saveNow(doc)
    this.broadcastIndex(true)
    this.io.broadcast({ type: 'studio.created', studioId: doc.id, name: doc.name, byId })
    return doc
  }

  rename(studioId: string, name: string): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    doc.name = this.cleanName(name)
    doc.updatedAt = Date.now()
    this.saveNow(doc)
    this.broadcastMeta(doc)
  }

  favorite(studioId: string, favorite: boolean): void {
    const doc = this.docs.get(studioId)
    if (!doc || doc.favorite === favorite) return
    doc.favorite = favorite
    this.saveNow(doc)
    this.broadcastMeta(doc)
  }

  assignAgents(studioId: string, agents: string[]): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    const next = [...new Set(agents)].slice(0, 32)
    if (next.length === doc.agents.length && next.every(id => doc.agents.includes(id))) return
    doc.agents = next
    this.scheduleSave(doc)
    this.broadcastMeta(doc)
  }

  duplicate(studioId: string, byId: string): StudioDoc | undefined {
    const source = this.docs.get(studioId)
    if (!source) return undefined
    const now = Date.now()
    const doc: StudioDoc = {
      ...structuredClone(source),
      id: randomUUID(),
      name: this.cleanName(`${source.name} copy`),
      favorite: false,
      chat: [],
      rev: 0,
      createdAt: now,
      updatedAt: now
    }
    this.docs.set(doc.id, doc)
    this.saveNow(doc)
    this.broadcastIndex(true)
    this.io.broadcast({ type: 'studio.created', studioId: doc.id, name: doc.name, byId })
    return doc
  }

  delete(studioId: string): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    const timer = this.saveTimers.get(studioId)
    if (timer) clearTimeout(timer)
    this.saveTimers.delete(studioId)
    this.docs.delete(studioId)
    try {
      this.store.deleteStudio(studioId)
    } catch {
      return
    }
    for (const [ws, viewer] of this.viewers) {
      if (viewer.studioId !== studioId) continue
      this.viewers.delete(ws)
      this.io.send(ws, { type: 'studio.deleted', studioId })
    }
    this.threads.delete(studioId)
    for (const [threadId, ref] of [...this.threadRefs]) {
      if (ref.studioId === studioId) this.threadRefs.delete(threadId)
    }
    this.broadcastIndex(true)
    this.io.syncNeeded()
  }

  open(ws: WebSocket, memberId: string, memberName: string, studioId: string): void {
    const doc = this.docs.get(studioId)
    if (!doc) {
      this.io.send(ws, { type: 'studio.deleted', studioId })
      return
    }
    const previous = this.viewers.get(ws)
    this.viewers.set(ws, {
      studioId,
      presence: {
        clientId: randomUUID(),
        memberId,
        name: memberName,
        pageId: doc.pages[0].id,
        cursor: null,
        selection: []
      }
    })
    this.io.send(ws, { type: 'studio.doc', doc })
    if (previous && previous.studioId !== studioId) this.broadcastPresence(previous.studioId)
    this.broadcastPresence(studioId)
  }

  close(ws: WebSocket): void {
    const viewer = this.viewers.get(ws)
    if (!viewer) return
    this.viewers.delete(ws)
    this.broadcastPresence(viewer.studioId)
  }

  presence(ws: WebSocket, studioId: string, pageId: string, cursor: { x: number; y: number } | null, selection: string[]): void {
    const viewer = this.viewers.get(ws)
    if (!viewer || viewer.studioId !== studioId) return
    if (isStudioId(pageId)) viewer.presence.pageId = pageId
    viewer.presence.cursor =
      cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y)
        ? { x: Math.round(cursor.x * 10) / 10, y: Math.round(cursor.y * 10) / 10 }
        : null
    viewer.presence.selection = selection.filter(isStudioId).slice(0, 200)
    this.broadcastPresence(studioId)
  }

  clientOps(ws: WebSocket, studioId: string, rawOps: unknown): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    const ops = sanitizeOps(rawOps)
    if (ops.length === 0) return
    this.apply(doc, ops, ws)
  }

  agentOps(studioId: string, ops: StudioOp[]): number {
    const doc = this.docs.get(studioId)
    if (!doc) return 0
    return this.apply(doc, ops, null)
  }

  userChat(
    member: { id: string; name: string },
    studioId: string,
    text: string,
    mentions: string[],
    build: boolean
  ): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    this.appendChat(doc, {
      kind: 'user',
      authorId: member.id,
      authorName: member.name,
      text,
      mentions: mentions.length > 0 ? mentions : undefined,
      build: build || undefined
    })
  }

  systemChat(studioId: string, text: string): void {
    const doc = this.docs.get(studioId)
    if (!doc) return
    this.appendChat(doc, { kind: 'system', authorId: 'crew', authorName: 'crew', text })
  }

  agentReply(agent: { id: string; label: string }, ref: StudioPromptRef, text: string): string {
    const doc = this.docs.get(ref.studioId)
    if (!doc) return text
    const { ops, cleaned } = this.extractOps(ref, text)
    const applied = ops.length > 0 ? this.apply(doc, ops, null) : 0
    const entry = agentChatEntry(agent.id, agent.label, cleaned, countNodesTouched(ops, applied))
    this.appendChat(doc, entry)
    return entry.text
  }

  agentFailed(studioId: string, agentLabel: string, error: string): void {
    this.systemChat(studioId, `${agentLabel} could not finish: ${error}`)
  }

  prompt(
    agent: { id: string; label: string },
    ref: StudioPromptRef,
    text: string,
    byName: string,
    people: string[],
    others: string[]
  ): string {
    const doc = this.docs.get(ref.studioId)
    if (!doc) return text
    const page = doc.pages.find(p => p.id === (ref.pageId ?? this.threadPages.get(this.threadFor(ref.studioId, agent.id) ?? ''))) ?? doc.pages[0]
    const input = { agentLabel: agent.label, doc, page, text, byName, people, others }
    return ref.build ? buildCodePrompt(input) : designPrompt(input)
  }

  threadFor(studioId: string, agentId: string): string | undefined {
    return this.threads.get(studioId)?.get(agentId)
  }

  registerThread(studioId: string, agentId: string, threadId: string): void {
    let byAgent = this.threads.get(studioId)
    if (!byAgent) {
      byAgent = new Map()
      this.threads.set(studioId, byAgent)
    }
    byAgent.set(agentId, threadId)
    this.threadRefs.set(threadId, { studioId, agentId })
  }

  studioOfThread(threadId: string): string | undefined {
    return this.threadRefs.get(threadId)?.studioId
  }

  notePage(threadId: string, pageId?: string): void {
    if (pageId && isStudioId(pageId)) this.threadPages.set(threadId, pageId)
  }

  detach(ws: WebSocket): void {
    this.close(ws)
  }

  private extractOps(ref: StudioPromptRef, text: string): { ops: StudioOp[]; cleaned: string } {
    if (ref.build) return { ops: [], cleaned: text.trim() }
    const doc = this.docs.get(ref.studioId)
    const fallbackPage = ref.pageId && doc?.pages.some(p => p.id === ref.pageId) ? ref.pageId : doc?.pages[0]?.id
    const parsed = parseStudioOps(text)
    const ops = parsed.ops.map(op =>
      op.kind === 'upsert' && !op.pageId && fallbackPage ? { ...op, pageId: fallbackPage } : op
    )
    return { ops, cleaned: parsed.cleaned }
  }

  private apply(doc: StudioDoc, ops: StudioOp[], except: WebSocket | null): number {
    const applied = applyOps(doc, ops)
    if (applied === 0) return 0
    doc.rev++
    doc.updatedAt = Date.now()
    this.scheduleSave(doc)
    for (const [ws, viewer] of this.viewers) {
      if (viewer.studioId !== doc.id || ws === except) continue
      this.io.send(ws, { type: 'studio.op', studioId: doc.id, ops, rev: doc.rev })
    }
    this.broadcastIndex(false)
    return applied
  }

  private appendChat(doc: StudioDoc, entry: Omit<StudioChatEntry, 'id' | 'ts'>): void {
    const full: StudioChatEntry = { ...entry, id: randomUUID(), ts: Date.now() }
    doc.chat = [...doc.chat, full].slice(-STUDIO_CHAT_LIMIT)
    doc.updatedAt = full.ts
    this.scheduleSave(doc)
    for (const [ws, viewer] of this.viewers) {
      if (viewer.studioId === doc.id) this.io.send(ws, { type: 'studio.chat', studioId: doc.id, entry: full })
    }
    this.broadcastIndex(false)
  }

  private broadcastPresence(studioId: string): void {
    const all = [...this.viewers.entries()].filter(([, viewer]) => viewer.studioId === studioId)
    for (const [ws] of all) {
      const peers = all.filter(([other]) => other !== ws).map(([, viewer]) => viewer.presence)
      this.io.send(ws, { type: 'studio.presence', studioId, peers })
    }
  }

  private broadcastMeta(doc: StudioDoc): void {
    this.broadcastIndex(true)
    for (const [ws, viewer] of this.viewers) {
      if (viewer.studioId === doc.id) {
        this.io.send(ws, {
          type: 'studio.meta',
          studioId: doc.id,
          name: doc.name,
          favorite: doc.favorite,
          agents: doc.agents
        })
      }
    }
  }

  private broadcastIndex(immediate: boolean): void {
    if (immediate) {
      if (this.indexTimer) clearTimeout(this.indexTimer)
      this.indexTimer = null
      this.io.broadcast({ type: 'studio.index', studios: this.index() })
      return
    }
    if (this.indexTimer) return
    this.indexTimer = setTimeout(() => {
      this.indexTimer = null
      this.io.broadcast({ type: 'studio.index', studios: this.index() })
    }, INDEX_DEBOUNCE_MS)
    this.indexTimer.unref?.()
  }

  private scheduleSave(doc: StudioDoc): void {
    const existing = this.saveTimers.get(doc.id)
    if (existing) return
    const timer = setTimeout(() => {
      this.saveTimers.delete(doc.id)
      const current = this.docs.get(doc.id)
      if (!current) return
      try {
        this.store.saveStudio(current)
        this.io.syncNeeded()
      } catch {
        return
      }
    }, SAVE_DEBOUNCE_MS)
    timer.unref?.()
    this.saveTimers.set(doc.id, timer)
  }

  private saveNow(doc: StudioDoc): void {
    const timer = this.saveTimers.get(doc.id)
    if (timer) clearTimeout(timer)
    this.saveTimers.delete(doc.id)
    try {
      this.store.saveStudio(doc)
      this.io.syncNeeded()
    } catch {
      return
    }
  }

  private metaOf(doc: StudioDoc): StudioMeta {
    return {
      id: doc.id,
      name: doc.name,
      favorite: doc.favorite,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      pageCount: doc.pages.length,
      nodeCount: Object.keys(doc.nodes).length,
      agents: doc.agents,
      preview: this.previewOf(doc)
    }
  }

  private previewOf(doc: StudioDoc): StudioPreviewNode[] {
    const page = doc.pages[0]
    if (!page) return []
    const out: StudioPreviewNode[] = []
    for (const id of page.order) {
      const node = doc.nodes[id]
      if (!node || node.hidden) continue
      if (depthOf(doc, node) > 2) continue
      const origin = absoluteOrigin(doc, node)
      out.push({
        type: node.type,
        x: origin.x,
        y: origin.y,
        w: node.w,
        h: node.h,
        fill: node.fill ?? null,
        radius: node.radius ?? 0
      })
      if (out.length >= PREVIEW_LIMIT) break
    }
    return out
  }

  private cleanName(name: string): string {
    return name.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT) || 'Untitled'
  }
}

function depthOf(doc: StudioDoc, node: StudioNode): number {
  let depth = 0
  let parentId = node.parentId ?? null
  while (parentId && depth < 20) {
    const parent = doc.nodes[parentId]
    if (!parent) break
    depth++
    parentId = parent.parentId ?? null
  }
  return depth
}

function countNodesTouched(ops: StudioOp[], applied: number): number {
  if (applied === 0) return 0
  let count = 0
  for (const op of ops) {
    if (op.kind === 'upsert') count += op.nodes.length
    else if (op.kind === 'remove') count += op.ids.length
    else count += 1
  }
  return count
}
