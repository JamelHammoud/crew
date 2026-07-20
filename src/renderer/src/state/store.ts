import { create } from 'zustand'
import type { SessionEvent } from '../../../shared/events'
import type { AgentActivity, PooledAgent } from '../../../shared/llm'
import type { ClientMessage, MemberInfo, ServerMessage } from '../../../shared/protocol'
import { CrewSocket } from '../api/ws'

export type Connection = 'home' | 'connecting' | 'online' | 'reconnecting'

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
  streams: Record<string, string>
  activePrompts: Record<string, string>
  connect: (wsUrl: string, name: string, code: string, joinLink?: string) => void
  leave: () => void
  sendChat: (text: string) => void
  cancelPrompt: (promptId: string) => void
  updateDoc: (page: string, text: string) => void
  updateAgentSetting: (agentId: string, key: string, value: string) => void
}

const socket = new CrewSocket()

export const useCrew = create<CrewState>((set, get) => {
  const applyEvent = (event: SessionEvent) => {
    set(state => {
      const events = [...state.events, event].slice(-EVENT_LIMIT)
      const members = [...state.members]
      const agents = [...state.agents]
      const activePrompts = { ...state.activePrompts }
      const streams = { ...state.streams }
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
          else agents.push(agentFromId(event.agentId, event.label))
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
        case 'agent.start': {
          activePrompts[event.agentId] = event.promptId
          break
        }
        case 'agent.end': {
          delete activePrompts[event.agentId]
          delete streams[event.promptId]
          break
        }
        case 'doc': {
          return { events, members, agents, activePrompts, streams, docs: { ...state.docs, [event.page]: event.text } }
        }
      }
      return { events, members, agents, activePrompts, streams }
    })
  }

  const handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        set({
          connection: 'online',
          selfId: msg.selfId,
          code: msg.snapshot.code,
          members: msg.snapshot.members,
          agents: msg.snapshot.agents,
          events: msg.snapshot.events.slice(-EVENT_LIMIT),
          docs: msg.snapshot.docs,
          streams: {},
          activePrompts: {}
        })
        break
      case 'event':
        applyEvent(msg.event)
        break
      case 'agent.chunk':
        set(state => ({
          streams: { ...state.streams, [msg.promptId]: (state.streams[msg.promptId] ?? '') + msg.text }
        }))
        break
      case 'agent.activity':
        set(state => ({
          agents: state.agents.map(agent => {
            if (agent.id !== msg.agentId) return agent
            const rest = agent.activities.filter(a => a.id !== msg.activity.id)
            return { ...agent, activities: [...rest, msg.activity] }
          })
        }))
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
    members: [],
    agents: [],
    events: [],
    docs: {},
    streams: {},
    activePrompts: {},
    connect: (wsUrl, name, code, joinLink) => {
      set({ connection: 'connecting', selfName: name, joinLink: joinLink ?? null })
      const hello: ClientMessage = { type: 'hello', role: 'ui', name, code }
      socket.connect(wsUrl, hello)
    },
    leave: () => {
      socket.close()
      void window.crew.leave()
      set({
        connection: 'home',
        joinLink: null,
        selfId: '',
        code: '',
        members: [],
        agents: [],
        events: [],
        docs: {},
        streams: {},
        activePrompts: {}
      })
    },
    sendChat: text => {
      const mentions = get()
        .agents.filter(agent => text.toLowerCase().includes(`@${agent.label.toLowerCase()}`))
        .map(agent => agent.id)
      socket.send({ type: 'chat.send', text, mentions })
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
    }
  }
})

function agentFromId(id: string, label: string): PooledAgent {
  const slash = id.indexOf('/')
  return {
    id,
    label,
    provider: slash === -1 ? '' : id.slice(slash + 1),
    ownerId: '',
    ownerName: slash === -1 ? '' : id.slice(0, slash),
    status: 'idle',
    activities: [] as AgentActivity[],
    settings: {},
    fields: []
  }
}
