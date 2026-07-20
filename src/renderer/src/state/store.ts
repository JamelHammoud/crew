import { create } from 'zustand'
import type { SessionEvent } from '../../../shared/events'
import { mentionsIn, type AgentStep, type PooledAgent } from '../../../shared/llm'
import type { ClientMessage, MemberInfo, ServerMessage } from '../../../shared/protocol'
import { CrewSocket } from '../api/ws'

export type Connection = 'home' | 'connecting' | 'online' | 'reconnecting'

export interface ThreadMeta {
  id: string
  agentId: string
  agentLabel: string
  title: string
  createdBy: string
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
  docs: Record<string, string>
  steps: Record<string, AgentStep[]>
  activePrompts: Record<string, string[]>
  threads: Record<string, ThreadMeta>
  threadPrompts: Record<string, string>
  openThreadId: string | null
  chatDraft: string
  threadDrafts: Record<string, string>
  connect: (wsUrl: string, name: string, code: string, joinLink?: string) => void
  leave: () => void
  setChatDraft: (text: string) => void
  setThreadDraft: (threadId: string, text: string) => void
  sendChat: (text: string, threadId?: string) => void
  cancelPrompt: (promptId: string) => void
  updateDoc: (page: string, text: string) => void
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
  steps: {},
  activePrompts: {},
  threads: {},
  threadPrompts: {},
  openThreadId: null,
  chatDraft: '',
  threadDrafts: {}
}

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
    set(state => {
      const all = [...state.events, event]
      const events = all.slice(-EVENT_LIMIT)
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
            createdBy: event.byName
          }
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
          return { events, docs: { ...state.docs, [event.page]: event.text } }
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
        for (const event of msg.snapshot.events) {
          if (event.kind === 'thread.started') {
            threads[event.threadId] = {
              id: event.threadId,
              agentId: event.agentId,
              agentLabel: event.agentLabel,
              title: event.title,
              createdBy: event.byName
            }
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
          for (const [promptId, live] of Object.entries(agent.runs)) {
            for (const step of live) steps[promptId] = upsertStep(steps[promptId], step)
          }
        }
        set({
          connection: 'online',
          selfId: msg.selfId,
          code: msg.snapshot.code,
          members: msg.snapshot.members,
          agents: msg.snapshot.agents,
          events: msg.snapshot.events.slice(-EVENT_LIMIT),
          docs: msg.snapshot.docs,
          steps,
          activePrompts,
          threads,
          threadPrompts,
          openThreadId: null
        })
        break
      }
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
    ...EMPTY,
    connect: (wsUrl, name, code, joinLink) => {
      set({ connection: 'connecting', selfName: name, joinLink: joinLink ?? null })
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
    sendChat: (text, threadId) => {
      if (threadId) {
        socket.send({ type: 'chat.send', text, mentions: [], threadId })
        set(state => ({ threadDrafts: { ...state.threadDrafts, [threadId]: '' } }))
        return
      }
      const mentions = mentionsIn(text, get().agents)
      socket.send({ type: 'chat.send', text, mentions })
      set({ chatDraft: '' })
    },
    cancelPrompt: promptId => {
      socket.send({ type: 'prompt.cancel', promptId })
    },
    updateDoc: (page, text) => {
      set(state => ({ docs: { ...state.docs, [page]: text } }))
      socket.send({ type: 'doc.update', page, text })
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
