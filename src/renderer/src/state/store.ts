import { create } from 'zustand'
import { httpBaseFrom } from '../../../shared/attachments'
import { fallbackTitle, type DocPage } from '../../../shared/docs'
import { trimEvents, type SessionEvent, type ThreadStatus, type Todo } from '../../../shared/events'
import { mentionsIn, type AgentStep, type PooledAgent } from '../../../shared/llm'
import type { ClientMessage, MemberInfo, QueuedItem, ServerMessage } from '../../../shared/protocol'
import { CrewSocket } from '../api/ws'
import { imagesFrom, readImages, type PendingAttachment } from '../components/images'

export type Connection = 'home' | 'connecting' | 'online' | 'reconnecting'

export interface ThreadMeta {
  id: string
  agentId: string
  agentLabel: string
  title: string
  createdBy: string
  status: ThreadStatus
}

const EVENT_LIMIT = 500

interface CrewState {
  connection: Connection
  joinLink: string | null
  selfId: string
  selfName: string
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  docs: Record<string, DocPage>
  queues: Record<string, QueuedItem[]>
  steps: Record<string, AgentStep[]>
  tokens: Record<string, number>
  activePrompts: Record<string, string[]>
  threads: Record<string, ThreadMeta>
  threadPrompts: Record<string, string>
  todos: Todo[]
  openThreadId: string | null
  chatDraft: string
  threadDrafts: Record<string, string>
  httpBase: string
  pending: Record<string, PendingAttachment[]>
  connect: (wsUrl: string, name: string, code: string, joinLink?: string) => void
  leave: () => void
  setChatDraft: (text: string) => void
  setThreadDraft: (threadId: string, text: string) => void
  attach: (key: string, files: FileList | File[] | null) => Promise<void>
  detach: (key: string, id: string) => void
  sendChat: (text: string, threadId?: string) => void
  deleteMessage: (messageId: string) => void
  setThreadStatus: (threadId: string, status: ThreadStatus) => void
  addTodo: (text: string, agentId?: string) => void
  editTodo: (todoId: string, text: string, agentId?: string) => void
  removeTodo: (todoId: string) => void
  checkTodo: (todoId: string, checked: boolean) => void
  doTodo: (todoId: string, agentId?: string) => void
  cancelPrompt: (promptId: string) => void
  updateDoc: (page: string, text: string, title?: string) => void
  retitleDoc: (page: string, title: string) => void
  renameDoc: (from: string, to: string, title?: string) => void
  deleteDoc: (page: string) => void
  editQueued: (promptId: string, text: string) => void
  removeQueued: (promptId: string) => void
  updateAgentSetting: (agentId: string, key: string, value: string) => void
  openThread: (threadId: string) => void
  closeThread: () => void
}

const socket = new CrewSocket()

const EMPTY = {
  members: [],
  agents: [],
  events: [],
  docs: {},
  queues: {},
  steps: {},
  tokens: {},
  activePrompts: {},
  threads: {},
  threadPrompts: {},
  openThreadId: null,
  chatDraft: '',
  threadDrafts: {},
  pending: {}
}

export const CHAT_KEY = 'chat'

const upsertStep = (steps: AgentStep[] | undefined, step: AgentStep): AgentStep[] => {
  const rest = (steps ?? []).filter(s => s.id !== step.id)
  return [...rest, step].sort((a, b) => a.ts - b.ts)
}

const addPrompt = (active: Record<string, string[]>, agentId: string, promptId: string): string[] => [
  ...(active[agentId] ?? []).filter(id => id !== promptId),
  promptId
]

const pruneSteps = (steps: Record<string, AgentStep[]>, events: SessionEvent[]): Record<string, AgentStep[]> => {
  const live = new Set(events.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  const kept = Object.keys(steps).filter(promptId => live.has(promptId))
  if (kept.length === Object.keys(steps).length) return steps
  return Object.fromEntries(kept.map(promptId => [promptId, steps[promptId]]))
}

export const useCrew = create<CrewState>((set, get) => {
  const applyEvent = (event: SessionEvent) => {
    if (event.kind === 'message.deleted') {
      set(state => ({ events: state.events.filter(e => !(e.kind === 'message' && e.id === event.messageId)) }))
      return
    }
    if (event.kind === 'message.edited') {
      set(state => ({
        events: state.events.map(e =>
          e.kind === 'message' && e.id === event.messageId ? { ...e, text: event.text } : e
        )
      }))
      return
    }
    set(state => {
      const all = [...state.events, event]
      const events = trimEvents(all, EVENT_LIMIT)
      const members = [...state.members]
      const agents = [...state.agents]
      const activePrompts = { ...state.activePrompts }
      const steps = { ...state.steps }
      const threads = { ...state.threads }
      const threadPrompts = { ...state.threadPrompts }
      switch (event.kind) {
        case 'person.joined': {
          const member = members.find(m => m.id === event.memberId)
          if (member) member.connected = true
          else members.push({ id: event.memberId, name: event.name, connected: true })
          break
        }
        case 'person.left': {
          const member = members.find(m => m.id === event.memberId)
          if (member) member.connected = false
          break
        }
        case 'agent.online': {
          const agent = agents.find(a => a.id === event.agentId)
          if (agent) agent.status = 'idle'
          break
        }
        case 'agent.updated': {
          const agent = agents.find(a => a.id === event.agentId)
          if (agent) agent.settings = event.settings
          break
        }
        case 'agent.offline': {
          const agent = agents.find(a => a.id === event.agentId)
          if (agent) agent.status = 'offline'
          break
        }
        case 'thread.started': {
          threads[event.threadId] = {
            id: event.threadId,
            agentId: event.agentId,
            agentLabel: event.agentLabel,
            title: event.title,
            createdBy: event.byName,
            status: 'open'
          }
          break
        }
        case 'thread.archived': {
          const thread = threads[event.threadId]
          if (thread) threads[event.threadId] = { ...thread, status: 'archived' }
          break
        }
        case 'thread.status': {
          const thread = threads[event.threadId]
          if (thread) threads[event.threadId] = { ...thread, status: event.status }
          break
        }
        case 'agent.start': {
          activePrompts[event.agentId] = addPrompt(activePrompts, event.agentId, event.promptId)
          if (event.threadId) threadPrompts[event.threadId] = event.promptId
          break
        }
        case 'agent.step': {
          steps[event.promptId] = upsertStep(steps[event.promptId], event.step)
          break
        }
        case 'agent.end': {
          activePrompts[event.agentId] = (activePrompts[event.agentId] ?? []).filter(id => id !== event.promptId)
          if (event.threadId && threadPrompts[event.threadId] === event.promptId) delete threadPrompts[event.threadId]
          break
        }
        case 'doc': {
          const title = event.title ?? state.docs[event.page]?.title ?? fallbackTitle(event.page)
          return { events, docs: { ...state.docs, [event.page]: { title, text: event.text } } }
        }
        case 'doc.renamed': {
          const docs = { ...state.docs }
          for (const page of Object.keys(docs)) {
            if (page !== event.from && !page.startsWith(`${event.from}/`)) continue
            docs[event.to + page.slice(event.from.length)] = docs[page]
            delete docs[page]
          }
          if (event.title !== undefined && docs[event.to]) {
            docs[event.to] = { ...docs[event.to], title: event.title }
          }
          return { events, docs }
        }
        case 'doc.deleted': {
          const docs = { ...state.docs }
          for (const page of Object.keys(docs)) {
            if (page === event.page || page.startsWith(`${event.page}/`)) delete docs[page]
          }
          return { events, docs }
        }
      }
      return {
        events,
        members,
        agents,
        activePrompts,
        steps: all.length > events.length ? pruneSteps(steps, events) : steps,
        threads,
        threadPrompts
      }
    })
  }

  const handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome': {
        const threads: Record<string, ThreadMeta> = {}
        const threadPrompts: Record<string, string> = {}
        const activePrompts: Record<string, string[]> = {}
        const steps: Record<string, AgentStep[]> = {}
        const tokens: Record<string, number> = {}
        for (const event of msg.snapshot.events) {
          if (event.kind === 'thread.started') {
            threads[event.threadId] = {
              id: event.threadId,
              agentId: event.agentId,
              agentLabel: event.agentLabel,
              title: event.title,
              createdBy: event.byName,
              status: 'open'
            }
          }
          if (event.kind === 'thread.archived' && threads[event.threadId]) {
            threads[event.threadId].status = 'archived'
          }
          if (event.kind === 'thread.status' && threads[event.threadId]) {
            threads[event.threadId].status = event.status
          }
          if (event.kind === 'agent.step') steps[event.promptId] = upsertStep(steps[event.promptId], event.step)
          if (event.kind === 'agent.start') {
            activePrompts[event.agentId] = addPrompt(activePrompts, event.agentId, event.promptId)
            if (event.threadId) threadPrompts[event.threadId] = event.promptId
          }
          if (event.kind === 'agent.end') {
            activePrompts[event.agentId] = (activePrompts[event.agentId] ?? []).filter(id => id !== event.promptId)
            if (event.threadId && threadPrompts[event.threadId] === event.promptId) delete threadPrompts[event.threadId]
          }
        }
        for (const agent of msg.snapshot.agents) {
          for (const [promptId, run] of Object.entries(agent.runs)) {
            for (const step of run.steps) steps[promptId] = upsertStep(steps[promptId], step)
            tokens[promptId] = run.tokens
          }
        }
        set({
          connection: 'online',
          selfId: msg.selfId,
          code: msg.snapshot.code,
          members: msg.snapshot.members,
          agents: msg.snapshot.agents,
          events: trimEvents(msg.snapshot.events, EVENT_LIMIT),
          docs: msg.snapshot.docs,
          queues: msg.snapshot.queues ?? {},
          steps,
          tokens,
          activePrompts,
          threads,
          threadPrompts,
          openThreadId: null
        })
        break
      }
      case 'queue.state':
        set(state => ({ queues: { ...state.queues, [msg.threadId]: msg.items } }))
        break
      case 'event':
        applyEvent(msg.event)
        break
      case 'agent.added':
        set(state =>
          state.agents.some(a => a.id === msg.agent.id)
            ? { agents: state.agents.map(a => (a.id === msg.agent.id ? msg.agent : a)) }
            : { agents: [...state.agents, msg.agent] }
        )
        break
      case 'agent.removed':
        set(state => ({ agents: state.agents.filter(a => a.id !== msg.agentId) }))
        break
      case 'agent.step':
        set(state => ({ steps: { ...state.steps, [msg.promptId]: upsertStep(state.steps[msg.promptId], msg.step) } }))
        break
      case 'agent.usage':
        set(state => ({
          agents: state.agents.map(a => (a.id === msg.agentId ? { ...a, usage: msg.usage } : a))
        }))
        break
      case 'agent.tokens':
        set(state => ({ tokens: { ...state.tokens, [msg.promptId]: msg.tokens } }))
        break
    }
  }

  socket.onMessage = handleMessage
  socket.onStatus = status => {
    const current = get().connection
    if (status === 'connecting' && current !== 'home') set({ connection: 'connecting' })
    if (status === 'closed' && current !== 'home') set({ connection: 'reconnecting' })
  }

  return {
    connection: 'home',
    joinLink: null,
    selfId: '',
    selfName: '',
    code: '',
    httpBase: '',
    ...EMPTY,
    connect: (wsUrl, name, code, joinLink) => {
      set({ connection: 'connecting', selfName: name, joinLink: joinLink ?? null, httpBase: httpBaseFrom(wsUrl) })
      const hello: ClientMessage = { type: 'hello', role: 'ui', name, code }
      socket.connect(wsUrl, hello)
    },
    leave: () => {
      socket.close()
      void window.crew.leave()
      set({ connection: 'home', joinLink: null, selfId: '', code: '', ...EMPTY })
    },
    setChatDraft: text => set({ chatDraft: text }),
    setThreadDraft: (threadId, text) =>
      set(state => ({ threadDrafts: { ...state.threadDrafts, [threadId]: text } })),
    attach: async (key, files) => {
      const picked = imagesFrom(files)
      if (picked.length === 0) return
      const added = await readImages(picked, (get().pending[key] ?? []).length)
      if (added.length === 0) return
      set(state => ({ pending: { ...state.pending, [key]: [...(state.pending[key] ?? []), ...added] } }))
    },
    detach: (key, id) =>
      set(state => ({ pending: { ...state.pending, [key]: (state.pending[key] ?? []).filter(a => a.id !== id) } })),
    sendChat: (text, threadId) => {
      const key = threadId ?? CHAT_KEY
      const attachments = (get().pending[key] ?? []).map(({ name, mime, data }) => ({ name, mime, data }))
      const mentions = mentionsIn(text, get().agents)
      if (threadId) {
        socket.send({ type: 'chat.send', text, mentions, threadId, attachments })
        set(state => ({
          threadDrafts: { ...state.threadDrafts, [threadId]: '' },
          pending: { ...state.pending, [key]: [] }
        }))
        return
      }
      socket.send({ type: 'chat.send', text, mentions, attachments })
      set(state => ({ chatDraft: '', pending: { ...state.pending, [key]: [] } }))
    },
    deleteMessage: messageId => {
      socket.send({ type: 'chat.delete', messageId })
    },
    setThreadStatus: (threadId, status) => {
      // Archiving keeps the old message so a newer UI can still archive on an
      // older host; the other transitions only exist on hosts that know them.
      socket.send(status === 'archived' ? { type: 'thread.archive', threadId } : { type: 'thread.status', threadId, status })
    },
    cancelPrompt: promptId => {
      socket.send({ type: 'prompt.cancel', promptId })
    },
    updateDoc: (page, text, title) => {
      set(state => {
        const kept = title ?? state.docs[page]?.title ?? fallbackTitle(page)
        return { docs: { ...state.docs, [page]: { title: kept, text } } }
      })
      socket.send({ type: 'doc.update', page, text, title })
    },
    retitleDoc: (page, title) => {
      set(state =>
        state.docs[page] === undefined ? state : { docs: { ...state.docs, [page]: { ...state.docs[page], title } } }
      )
      socket.send({ type: 'doc.retitle', page, title })
    },
    renameDoc: (from, to, title) => {
      set(state => {
        if (state.docs[from] === undefined || state.docs[to] !== undefined) return state
        if (to === from || to.startsWith(`${from}/`)) return state
        const docs = { ...state.docs }
        for (const page of Object.keys(docs)) {
          if (page !== from && !page.startsWith(`${from}/`)) continue
          docs[to + page.slice(from.length)] = docs[page]
          delete docs[page]
        }
        if (title !== undefined && docs[to]) docs[to] = { ...docs[to], title }
        return { docs }
      })
      socket.send({ type: 'doc.rename', from, to, title })
    },
    deleteDoc: page => {
      set(state => {
        const docs = { ...state.docs }
        for (const key of Object.keys(docs)) {
          if (key === page || key.startsWith(`${page}/`)) delete docs[key]
        }
        return { docs }
      })
      socket.send({ type: 'doc.delete', page })
    },
    editQueued: (promptId, text) => {
      socket.send({ type: 'queue.edit', promptId, text })
    },
    removeQueued: promptId => {
      socket.send({ type: 'queue.remove', promptId })
    },
    updateAgentSetting: (agentId, key, value) => {
      set(state => ({
        agents: state.agents.map(agent =>
          agent.id === agentId ? { ...agent, settings: { ...agent.settings, [key]: value } } : agent
        )
      }))
      socket.send({ type: 'agent.settings', agentId, settings: { [key]: value } })
    },
    openThread: threadId => set({ openThreadId: threadId }),
    closeThread: () => set({ openThreadId: null })
  }
})
