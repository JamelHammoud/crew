import { create } from 'zustand'
import { httpBaseFrom, MAX_ATTACHMENTS, type OutgoingAttachment } from '../../../shared/attachments'
import type { CommandName } from '../../../shared/commands'
import { boardCode, type DesignBoardMeta, type DesignDocument } from '../../../shared/design'
import { fallbackTitle, slugify, type DocPage } from '../../../shared/docs'
import {
  huddleRecordId,
  markDeletedReplies,
  trimEvents,
  type SessionEvent,
  type ThreadMode,
  type ThreadStatus,
  type Todo
} from '../../../shared/events'
import type { GameScore } from '../../../shared/games'
import type { CrewTool, ToolAction } from '../../../shared/toolbox'
import { emptyRoom } from '../../../shared/huddle'
import { emptyMusic, type MusicPlaylist, type MusicUpload } from '../../../shared/music'
import { mentionsIn, type AgentMentionRef, type AgentStep, type PooledAgent } from '../../../shared/llm'
import type { ClientMessage, MemberInfo, QueuedItem, ServerMessage } from '../../../shared/protocol'
import { messageReactionTarget, type ReactionEmoji } from '../../../shared/reactions'
import type { CurrentSession } from '../../../shared/session'
import { CrewSocket } from '../api/ws'
import { imagesFrom, readImages, type PendingAttachment } from '../components/images'
import { playSound, soundFor } from '../media/sounds'
import { finishedAlert, memberMentionAlert } from './alerts'
import { toast } from './toast'

export type Connection = 'booting' | 'home' | 'connecting' | 'online' | 'reconnecting'

export interface ThreadMeta {
  id: string
  agentId: string
  agentLabel: string
  title: string
  titleRefs?: AgentMentionRef[]
  createdBy: string
  status: ThreadStatus
  mode: ThreadMode
  plan?: string
  boardId?: string
  // A thread this window opened for itself. It reaches nobody else and it is
  // gone the moment the window is, so it is only ever built from a live event.
  ghost?: boolean
  // A thread somebody spoke rather than typed.
  voice?: boolean
}

export type DesignServerMessage = Extract<
  ServerMessage,
  { type: 'design.snapshot' | 'design.preview' | 'design.changes' | 'design.presence' }
>

const designListeners = new Set<(msg: DesignServerMessage) => void>()

export function onDesign(listener: (msg: DesignServerMessage) => void): () => void {
  designListeners.add(listener)
  return () => designListeners.delete(listener)
}

export type HuddleServerMessage = Extract<ServerMessage, { type: 'huddle.room' | 'huddle.signal' }>

export type HuddleClientMessage = Extract<
  ClientMessage,
  { type: 'huddle.join' | 'huddle.leave' | 'huddle.update' | 'huddle.signal' }
>

const huddleListeners = new Set<(msg: HuddleServerMessage) => void>()

export function onHuddle(listener: (msg: HuddleServerMessage) => void): () => void {
  huddleListeners.add(listener)
  return () => huddleListeners.delete(listener)
}

export function sendHuddle(msg: HuddleClientMessage): void {
  socket.send(msg)
}

export type MusicServerMessage = Extract<ServerMessage, { type: 'music.room' }>

export type MusicClientMessage = Extract<
  ClientMessage,
  {
    type:
      | 'music.set'
      | 'music.off'
      | 'music.loop'
      | 'music.add'
      | 'music.remove'
      | 'playlist.add'
      | 'playlist.remove'
      | 'playlist.rename'
      | 'playlist.track'
  }
>

const musicListeners = new Set<(msg: MusicServerMessage) => void>()
const shelfListeners = new Set<(uploads: MusicUpload[]) => void>()
const playlistListeners = new Set<(playlists: MusicPlaylist[]) => void>()

export function onMusic(listener: (msg: MusicServerMessage) => void): () => void {
  musicListeners.add(listener)
  return () => musicListeners.delete(listener)
}

export function onMusicShelf(listener: (uploads: MusicUpload[]) => void): () => void {
  shelfListeners.add(listener)
  return () => shelfListeners.delete(listener)
}

export function onMusicPlaylists(listener: (playlists: MusicPlaylist[]) => void): () => void {
  playlistListeners.add(listener)
  return () => playlistListeners.delete(listener)
}

export function sendMusic(msg: MusicClientMessage): void {
  socket.send(msg)
}

const EVENT_LIMIT = 500

interface CrewState {
  connection: Connection
  joinLink: string | null
  hosting: boolean
  shared: boolean
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
  tools: CrewTool[]
  scores: GameScore[]
  boards: DesignBoardMeta[]
  openThreadId: string | null
  docsTarget: string | null
  designTarget: string | null
  chatDraft: string
  chatCommands: CommandName[]
  threadDrafts: Record<string, string>
  httpBase: string
  pending: Record<string, PendingAttachment[]>
  boot: () => Promise<void>
  connect: (session: CurrentSession) => void
  share: (shared: boolean) => Promise<string | null>
  leave: () => void
  setChatDraft: (text: string) => void
  setChatCommands: (commands: CommandName[]) => void
  setThreadDraft: (threadId: string, text: string) => void
  attach: (key: string, files: FileList | File[] | null) => Promise<void>
  detach: (key: string, id: string) => void
  moveAttachments: (from: string, to: string) => void
  sendChat: (
    text: string,
    threadId?: string,
    boardId?: string,
    replyTo?: string,
    aimedAt?: string[],
    commands?: CommandName[]
  ) => void
  createBoard: (name: string) => string
  renameBoard: (boardId: string, name: string) => void
  deleteBoard: (boardId: string) => void
  openDesign: (boardId: string) => void
  peekDesign: (boardId: string) => void
  initDesign: (boardId: string, document: DesignDocument) => void
  applyDesign: (boardId: string, put: unknown[], remove: string[]) => void
  sendDesignPresence: (
    boardId: string,
    cursor: { x: number; y: number } | null,
    selection: string[],
    pageId: string | null
  ) => void
  deleteMessage: (messageId: string) => void
  deleteHuddle: (huddleId: string) => void
  editMessage: (messageId: string, text: string) => void
  reactToMessage: (targetId: string, emoji: ReactionEmoji) => void
  setThreadStatus: (threadId: string, status: ThreadStatus) => void
  implementPlan: (threadId: string) => void
  addTodo: (text: string, agentId?: string) => void
  editTodo: (todoId: string, text: string, agentId?: string) => void
  removeTodo: (todoId: string) => void
  checkTodo: (todoId: string, checked: boolean) => void
  doTodo: (todoId: string, agentId?: string) => void
  addTool: (name: string, mark: string, action: ToolAction) => void
  editTool: (toolId: string, name: string, mark: string, action: ToolAction) => void
  removeTool: (toolId: string) => void
  postScore: (gameId: string, score: number) => void
  cancelPrompt: (promptId: string) => void
  updateDoc: (page: string, text: string, title?: string) => void
  retitleDoc: (page: string, title: string) => void
  renameDoc: (from: string, to: string, title?: string) => void
  deleteDoc: (page: string) => void
  editQueued: (promptId: string, text: string) => void
  removeQueued: (promptId: string) => void
  updateAgentSetting: (agentId: string, key: string, value: string) => void
  renameAgent: (agentId: string, label: string) => void
  setAgentAvatar: (agentId: string, file: File | null) => void
  setMyPhoto: (file: File | null) => void
  removeAgent: (agentId: string) => void
  openThread: (threadId: string) => void
  closeThread: () => void
  openDoc: (page: string) => void
  clearDocsTarget: () => void
  openBoard: (boardId: string) => void
  clearDesignTarget: () => void
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
  todos: [],
  tools: [],
  scores: [],
  boards: [],
  openThreadId: null,
  docsTarget: null,
  designTarget: null,
  chatDraft: '',
  chatCommands: [],
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

// A photo is one picture, read the same way whether it goes on a person or on
// one of their agents. Anything that is not an image the app can carry is
// dropped here rather than sent for the host to refuse.
const readPhoto = (file: File, send: (image: OutgoingAttachment) => void): void => {
  const [picked] = imagesFrom([file])
  if (!picked) return
  void readImages([picked], 0).then(([image]) => {
    if (image) send({ name: image.name, mime: image.mime, data: image.data })
  })
}

const pruneSteps = (steps: Record<string, AgentStep[]>, events: SessionEvent[]): Record<string, AgentStep[]> => {
  const live = new Set(events.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  const kept = Object.keys(steps).filter(promptId => live.has(promptId))
  if (kept.length === Object.keys(steps).length) return steps
  return Object.fromEntries(kept.map(promptId => [promptId, steps[promptId]]))
}

export const useCrew = create<CrewState>((set, get) => {
  const applyEvent = (event: SessionEvent) => {
    const cue = soundFor(event, get().selfId)
    if (cue) playSound(cue)
    const focused = document.hasFocus()
    const alert = finishedAlert(event, get(), focused) ?? memberMentionAlert(event, get().selfId, focused)
    if (alert) void window.crew?.notify?.(alert)
    if (event.kind === 'message.deleted') {
      set(state => ({
        events: markDeletedReplies(
          state.events.filter(e => !(e.kind === 'message' && e.id === event.messageId)),
          new Set([messageReactionTarget(event.messageId)])
        )
      }))
      return
    }
    if (event.kind === 'huddle.deleted') {
      set(state => ({ events: state.events.filter(e => huddleRecordId(e) !== event.huddleId) }))
      return
    }
    if (event.kind === 'message.edited') {
      set(state => ({
        events: state.events.map(e =>
          e.kind === 'message' && e.id === event.messageId
            ? {
                ...e,
                text: event.text,
                mentionRefs: event.mentionRefs ?? e.mentionRefs,
                memberMentionRefs: event.memberMentionRefs ?? e.memberMentionRefs,
                docMentions: event.docMentions ?? e.docMentions,
                boardMentions: event.boardMentions ?? e.boardMentions,
                editedTs: event.ts
              }
            : e
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
            titleRefs: event.titleRefs,
            createdBy: event.byName,
            status: 'open',
            mode: event.mode ?? 'build',
            boardId: event.boardId,
            ghost: event.ghost
          }
          break
        }
        case 'thread.plan': {
          const thread = threads[event.threadId]
          if (thread) threads[event.threadId] = { ...thread, plan: event.text }
          break
        }
        case 'thread.implement': {
          const thread = threads[event.threadId]
          if (thread) threads[event.threadId] = { ...thread, mode: 'build' }
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
        case 'thread.agent': {
          const thread = threads[event.threadId]
          if (thread) threads[event.threadId] = { ...thread, agentId: event.agentId, agentLabel: event.agentLabel }
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
        case 'doc.titled': {
          const doc = state.docs[event.page]
          return doc ? { events, docs: { ...state.docs, [event.page]: { ...doc, title: event.title } } } : { events }
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
        case 'todo.added': {
          if (state.todos.some(t => t.id === event.todoId)) return { events }
          const todo: Todo = {
            id: event.todoId,
            text: event.text,
            agentId: event.agentId,
            createdBy: event.byName,
            ts: event.ts,
            checked: false
          }
          return { events, todos: [...state.todos, todo] }
        }
        case 'todo.edited':
          return {
            events,
            todos: state.todos.map(t =>
              t.id === event.todoId ? { ...t, text: event.text, agentId: event.agentId } : t
            )
          }
        case 'todo.checked':
          return {
            events,
            todos: state.todos.map(t =>
              t.id === event.todoId
                ? { ...t, checked: event.checked, checkedTs: event.checked ? event.ts : undefined }
                : t
            )
          }
        // A started todo lives on as its thread; the thread.started event
        // arrives on its own just before this one.
        case 'todo.removed':
        case 'todo.started':
          return { events, todos: state.todos.filter(t => t.id !== event.todoId) }
        case 'tool.added': {
          if (state.tools.some(t => t.id === event.toolId)) return { events }
          const tool: CrewTool = {
            id: event.toolId,
            name: event.name,
            mark: event.mark,
            action: event.action,
            createdBy: event.byName,
            ts: event.ts
          }
          return { events, tools: [...state.tools, tool] }
        }
        case 'tool.edited':
          return {
            events,
            tools: state.tools.map(t =>
              t.id === event.toolId ? { ...t, name: event.name, mark: event.mark, action: event.action } : t
            )
          }
        case 'tool.removed':
          return { events, tools: state.tools.filter(t => t.id !== event.toolId) }
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
              titleRefs: event.titleRefs,
              createdBy: event.byName,
              status: 'open',
              mode: event.mode ?? 'build',
              boardId: event.boardId
            }
          }
          if (event.kind === 'thread.plan' && threads[event.threadId]) {
            threads[event.threadId].plan = event.text
          }
          if (event.kind === 'thread.implement' && threads[event.threadId]) {
            threads[event.threadId].mode = 'build'
          }
          if (event.kind === 'thread.archived' && threads[event.threadId]) {
            threads[event.threadId].status = 'archived'
          }
          if (event.kind === 'thread.status' && threads[event.threadId]) {
            threads[event.threadId].status = event.status
          }
          if (event.kind === 'thread.agent' && threads[event.threadId]) {
            threads[event.threadId].agentId = event.agentId
            threads[event.threadId].agentLabel = event.agentLabel
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
          todos: msg.snapshot.todos ?? [],
          tools: msg.snapshot.tools ?? [],
          scores: msg.snapshot.gameScores ?? [],
          boards: msg.snapshot.boards ?? [],
          steps,
          tokens,
          activePrompts,
          threads,
          threadPrompts,
          openThreadId: null
        })
        for (const listener of huddleListeners) {
          listener({ type: 'huddle.room', room: msg.snapshot.huddle ?? emptyRoom() })
        }
        for (const listener of shelfListeners) listener(msg.snapshot.musicUploads ?? [])
        for (const listener of playlistListeners) listener(msg.snapshot.musicPlaylists ?? [])
        for (const listener of musicListeners) {
          listener({ type: 'music.room', room: msg.snapshot.music ?? emptyMusic() })
        }
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
      // A thread carries the name its agent had when it opened, so every one it
      // belongs to is brought along and the new name shows up without a reload.
      case 'agent.renamed':
        set(state => ({
          agents: state.agents.map(a => (a.id === msg.agentId ? { ...a, label: msg.label } : a)),
          threads: Object.fromEntries(
            Object.entries(state.threads).map(([id, thread]) => [
              id,
              thread.agentId === msg.agentId ? { ...thread, agentLabel: msg.label } : thread
            ])
          )
        }))
        break
      case 'agent.avatar':
        set(state => ({
          agents: state.agents.map(a => (a.id === msg.agentId ? { ...a, avatar: msg.file ?? undefined } : a))
        }))
        break
      case 'member.avatar':
        set(state => ({
          members: state.members.map(m => (m.id === msg.memberId ? { ...m, avatar: msg.file ?? undefined } : m))
        }))
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
      case 'design.boards':
        set({ boards: msg.boards })
        break
      case 'design.snapshot':
      case 'design.preview':
      case 'design.changes':
      case 'design.presence':
        for (const listener of designListeners) listener(msg)
        break
      case 'huddle.room':
      case 'huddle.signal':
        for (const listener of huddleListeners) listener(msg)
        break
      case 'music.room':
        for (const listener of musicListeners) listener(msg)
        break
      case 'music.shelf':
        for (const listener of shelfListeners) listener(msg.uploads)
        break
      case 'music.playlists':
        for (const listener of playlistListeners) listener(msg.playlists)
        break
      case 'game.scores':
        set({ scores: msg.scores })
        break
      // The same thing said twice is one row said again rather than a second
      // one under the first.
      case 'notice':
        toast(msg.text, { key: `notice:${msg.text}` })
        break
    }
  }

  socket.onMessage = handleMessage
  socket.onStatus = status => {
    const current = get().connection
    if (current === 'home' || current === 'booting') return
    if (status === 'connecting') set({ connection: 'connecting' })
    if (status === 'closed') set({ connection: 'reconnecting' })
  }

  return {
    connection: 'booting',
    joinLink: null,
    hosting: false,
    shared: false,
    selfId: '',
    selfName: '',
    code: '',
    httpBase: '',
    ...EMPTY,
    boot: async () => {
      const info = await window.crew.current().catch(() => null)
      if (info) {
        get().connect(info)
        return
      }
      if (get().connection === 'booting') set({ connection: 'home' })
    },
    connect: session => {
      set({
        connection: 'connecting',
        selfName: session.name,
        joinLink: session.link,
        hosting: session.hosting,
        shared: session.shared,
        httpBase: httpBaseFrom(session.wsUrl)
      })
      const hello: ClientMessage = { type: 'hello', role: 'ui', name: session.name, code: session.code }
      socket.connect(session.wsUrl, hello)
    },
    // Turning sharing on and off moves the listener and nothing else, so the
    // session stays exactly where it is and the socket comes back on its own.
    share: async shared => {
      const info = await window.crew.setShared(shared).catch(() => null)
      if (!info) {
        toast.fail(shared ? 'Could not share the session.' : 'Could not stop sharing.')
        return null
      }
      set({ joinLink: info.link, shared: info.shared })
      return info.link
    },
    leave: () => {
      socket.close()
      void window.crew.leave()
      set({ connection: 'home', joinLink: null, hosting: false, shared: false, selfId: '', code: '', ...EMPTY })
    },
    setChatDraft: text => set({ chatDraft: text }),
    setChatCommands: commands => set({ chatCommands: commands }),
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
    // A control that stages images under a key of its own has to hand them to
    // the thread or board the message is going to, because that is the only
    // place sendChat looks for them.
    moveAttachments: (from, to) =>
      set(state => {
        const carried = state.pending[from] ?? []
        if (from === to || carried.length === 0) return {}
        const waiting = state.pending[to] ?? []
        return {
          pending: { ...state.pending, [from]: [], [to]: [...waiting, ...carried].slice(0, MAX_ATTACHMENTS) }
        }
      }),
    sendChat: (text, threadId, boardId, replyTo, aimedAt, commands) => {
      const key = threadId ?? boardId ?? CHAT_KEY
      const attachments = (get().pending[key] ?? []).map(({ name, mime, data }) => ({ name, mime, data }))
      // A message typed in a composer says who it is for by naming them. One
      // sent from a control that already knows the agent says so by id, so it
      // cannot be lost to a rename, a duplicate name or a fumbled spelling.
      const mentions = aimedAt ?? mentionsIn(text, get().agents)
      playSound('send')
      if (threadId || boardId) {
        socket.send({
          type: 'chat.send',
          text,
          mentions,
          threadId,
          attachments,
          boardId: threadId ? undefined : boardId,
          replyTo
        })
        set(state => ({
          threadDrafts: { ...state.threadDrafts, [key]: '' },
          pending: { ...state.pending, [key]: [] }
        }))
        return
      }
      socket.send({ type: 'chat.send', text, mentions, commands, attachments, replyTo })
      set(state => ({ chatDraft: '', chatCommands: [], pending: { ...state.pending, [key]: [] } }))
    },
    createBoard: name => {
      const boardId = `${slugify(name) || 'board'}-${boardCode()}`
      set(state => ({ boards: [...state.boards, { id: boardId, name }] }))
      socket.send({ type: 'design.create', boardId, name })
      return boardId
    },
    renameBoard: (boardId, name) => {
      set(state => ({ boards: state.boards.map(b => (b.id === boardId ? { ...b, name } : b)) }))
      socket.send({ type: 'design.rename', boardId, name })
    },
    deleteBoard: boardId => {
      set(state => ({ boards: state.boards.filter(b => b.id !== boardId) }))
      socket.send({ type: 'design.delete', boardId })
    },
    openDesign: boardId => {
      socket.send({ type: 'design.open', boardId })
    },
    peekDesign: boardId => {
      socket.send({ type: 'design.peek', boardId })
    },
    initDesign: (boardId, document) => {
      socket.send({ type: 'design.init', boardId, document })
    },
    applyDesign: (boardId, put, remove) => {
      socket.send({ type: 'design.apply', boardId, put, remove })
    },
    sendDesignPresence: (boardId, cursor, selection, pageId) => {
      socket.send({ type: 'design.presence', boardId, cursor, selection, pageId })
    },
    deleteMessage: messageId => {
      socket.send({ type: 'chat.delete', messageId })
    },
    deleteHuddle: huddleId => {
      socket.send({ type: 'huddle.delete', huddleId })
    },
    editMessage: (messageId, text) => {
      socket.send({ type: 'chat.edit', messageId, text })
    },
    reactToMessage: (targetId, emoji) => {
      socket.send({ type: 'chat.react', targetId, emoji })
    },
    setThreadStatus: (threadId, status) => {
      if (status === 'done') playSound('task.done')
      // Archiving keeps the old message so a newer UI can still archive on an
      // older host; the other transitions only exist on hosts that know them.
      socket.send(status === 'archived' ? { type: 'thread.archive', threadId } : { type: 'thread.status', threadId, status })
    },
    implementPlan: threadId => {
      socket.send({ type: 'plan.implement', threadId })
    },
    addTodo: (text, agentId) => {
      socket.send({ type: 'todo.add', text, agentId })
    },
    editTodo: (todoId, text, agentId) => {
      socket.send({ type: 'todo.edit', todoId, text, agentId })
    },
    removeTodo: todoId => {
      socket.send({ type: 'todo.remove', todoId })
    },
    checkTodo: (todoId, checked) => {
      if (checked) playSound('task.done')
      socket.send({ type: 'todo.check', todoId, checked })
    },
    doTodo: (todoId, agentId) => {
      socket.send({ type: 'todo.do', todoId, agentId })
    },
    addTool: (name, mark, action) => {
      socket.send({ type: 'tool.add', name, mark, action })
    },
    editTool: (toolId, name, mark, action) => {
      socket.send({ type: 'tool.edit', toolId, name, mark, action })
    },
    removeTool: toolId => {
      socket.send({ type: 'tool.remove', toolId })
    },
    postScore: (gameId, score) => {
      socket.send({ type: 'game.score', gameId, score })
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
    renameAgent: (agentId, label) => {
      socket.send({ type: 'agent.rename', agentId, label })
    },
    setAgentAvatar: (agentId, file) => {
      if (!file) {
        socket.send({ type: 'agent.avatar', agentId, image: null })
        return
      }
      readPhoto(file, image => socket.send({ type: 'agent.avatar', agentId, image }))
    },
    setMyPhoto: file => {
      if (!file) {
        socket.send({ type: 'member.avatar', image: null })
        return
      }
      readPhoto(file, image => socket.send({ type: 'member.avatar', image }))
    },
    removeAgent: agentId => {
      socket.send({ type: 'agent.remove', agentId })
    },
    openThread: threadId => set({ openThreadId: threadId }),
    closeThread: () => set({ openThreadId: null }),
    openDoc: page => set({ docsTarget: page }),
    clearDocsTarget: () => set({ docsTarget: null }),
    openBoard: boardId => set({ designTarget: boardId }),
    clearDesignTarget: () => set({ designTarget: null })
  }
})

// What is waiting to be sent, read at the moment it is asked for. A picked GIF is
// attached and sent in the same breath, and a count held from the last render is
// still nought at that point, so a guard reading one would refuse to send the
// thing that was just picked.
export const pendingCount = (key: string): number => useCrew.getState().pending[key]?.length ?? 0
