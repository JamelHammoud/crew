import { create } from 'zustand'
import {
  attachmentBytes,
  attachmentMbLabel,
  DEFAULT_ATTACHMENT_MB,
  httpBaseFrom,
  MAX_ATTACHMENTS,
  type OutgoingAttachment
} from '../../../shared/attachments'
import type { CommandName } from '../../../shared/commands'
import {
  cleanCustomEmojiName,
  CUSTOM_EMOJI_MAX_BYTES,
  customEmojiExtension,
  customEmojiNameTaken,
  customEmojiRef,
  MAX_CUSTOM_EMOJI,
  type CustomEmoji
} from '../../../shared/customEmoji'
import { boardCode, type DesignBoardMeta, type DesignDocument } from '../../../shared/design'
import { fallbackTitle, slugify, type DocPage } from '../../../shared/docs'
import {
  appendEvent,
  huddleRecordId,
  markDeletedReplies,
  mergeEvents,
  trimEvents,
  type MessageReply,
  type SessionEvent,
  type ThreadMode,
  type ThreadStatus,
  type Todo
} from '../../../shared/events'
import type { GameScore } from '../../../shared/games'
import { cleanMemoryLine, memoryKey, MEMORY_FULL, MEMORY_LIMIT, type CrewMemory } from '../../../shared/memory'
import {
  cleanPlugin,
  currentPluginInstallation,
  installPlugin,
  pluginKey,
  PLUGIN_FULL,
  PLUGIN_INSTALL_MS,
  PLUGIN_LIMIT,
  PLUGIN_SLOW,
  type CrewPlugin
} from '../../../shared/plugins'
import {
  cleanCadence,
  cleanSchedule,
  here as hereZone,
  SCHEDULE_FULL,
  SCHEDULE_LIMIT,
  type Cadence,
  type Schedule
} from '../../../shared/schedules'
import type { CrewTool, ToolAction } from '../../../shared/toolbox'
import { emptyRoom } from '../../../shared/huddle'
import { emptyMusic, type MusicPlaylist, type MusicUpload } from '../../../shared/music'
import { mentionsIn, type AgentMentionRef, type AgentStep, type PooledAgent } from '../../../shared/llm'
import type { ClientMessage, MemberInfo, QueuedItem, ServerMessage } from '../../../shared/protocol'
import { messageReactionTarget, type ReactionEmoji } from '../../../shared/reactions'
import { cleanMemberName } from '../../../shared/people'
import { shownPages } from '../../../shared/showPage'
import { isTicketEvent, type TicketEvent } from '../../../shared/tickets'
import { closeOne, focusAfterClose, isFull, openBeside } from '../../../shared/threadViews'
import { TYPING_PING, type Typist } from '../../../shared/typing'
import type { CurrentSession } from '../../../shared/session'
import { CrewSocket } from '../api/ws'
import { alertToast } from '../components/alertToast'
import { holdCustomEmoji } from '../components/customEmojiSheet'
import { filesFrom, imagesFrom, keepPreviews, readFiles, type PendingAttachment } from '../components/images'
import { openShown } from '../components/openShown'
import { useIos } from './ios'
import { onMac } from './platform'
import { playSound, soundFor } from '../media/sounds'
import { finishedAlert, memberMentionAlert, memberReplyAlert, questionAlert } from './alerts'
import { helperPrefs, onHelperPrefs } from './helpers'
import { makeStepBuffer } from './stepBuffer'
import { boardOnScreen, useBrowser } from './browser'
import { usePlaces } from './places'
import { forgetProject, recallProject, stashProject } from './projectMemory'
import { toast } from './toast'
import { forgetPluginConnection, refreshPluginConnection, syncPluginConnections } from './pluginConnections'

export type Connection = 'booting' | 'home' | 'connecting' | 'online' | 'reconnecting'

export interface ThreadMeta {
  id: string
  agentId: string
  agentLabel: string
  title: string
  titleRefs?: AgentMentionRef[]
  createdBy: string
  startedAt?: number
  status: ThreadStatus
  mode: ThreadMode
  plan?: string
  boardId?: string
  // A thread this window opened for itself. It reaches nobody else and it is
  // gone the moment the window is, so it is only ever built from a live event.
  ghost?: boolean
  // A thread somebody spoke rather than typed.
  voice?: boolean
  // A thread whose work is reported onto a board beside it.
  tickets?: boolean
  // The thread a question on the side was asked from. It reads in the panel and
  // is nobody's work, so it stands out of the chat and out of the task list.
  aside?: string
  // The thread this one carried on from. It is a card in the chat like any
  // other: what the fork says is that the talk before it is being carried.
  forkedFrom?: string
  // A thread another one sent out. It reads inside its parent rather than as a
  // card of its own in the feed.
  parentThreadId?: string
  parentPromptId?: string
  // The name the agent that sent it out made it up under, and what it is doing.
  helper?: string
  subject?: string
  depth?: number
  helperModel?: string
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
  // Which place this window is looking at, and where its work is. Everything
  // filed away while you are somewhere else is filed under the first.
  place: string
  folder: string
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  // How much of the history is held. It starts at a window of the newest and
  // grows by whatever is read back, so scrolling into older messages does not
  // hand them straight back to the trim.
  eventLimit: number
  moreHistory: boolean
  loadingHistory: boolean
  docs: Record<string, DocPage>
  queues: Record<string, QueuedItem[]>
  queueComposed: Record<string, { promptId: string; replyTo?: MessageReply }>
  steps: Record<string, AgentStep[]>
  tokens: Record<string, number>
  costs: Record<string, number>
  activePrompts: Record<string, string[]>
  threads: Record<string, ThreadMeta>
  threadPrompts: Record<string, string>
  // A thread read back out of the log, and the steps its runs took. The window
  // above holds the tail of the chat, so a thread opened long after it ran has
  // none of its own left in it, and what comes back is kept here rather than
  // folded in: the chat feed is drawn from the window, and a thread from months
  // ago would stand at the head of today's.
  readEvents: SessionEvent[]
  readSteps: Record<string, AgentStep[]>
  todos: Todo[]
  // What the agents have said about their own work, kept apart from the chat's
  // events because a board is folded off these rather than scrolled past.
  tickets: TicketEvent[]
  tools: CrewTool[]
  memories: CrewMemory[]
  memoryEnabled: boolean
  plugins: CrewPlugin[]
  schedules: Schedule[]
  // The emoji the crew drew themselves. They are everyone's here, so they come
  // off the host rather than out of this window's own storage.
  emoji: CustomEmoji[]
  scores: GameScore[]
  boards: DesignBoardMeta[]
  // Who is writing right now. It is never written down and never in the log, so
  // it lives here and nowhere else.
  typists: Typist[]
  openThreadIds: string[]
  openThreadId: string | null
  chatColumn: boolean
  docsTarget: string | null
  designTarget: string | null
  chatDraft: string
  chatCommands: CommandName[]
  threadDrafts: Record<string, string>
  // What a thread's next message was told to do. A thread's commands are one
  // choice about the one message, so there is only ever one of them held.
  threadCommands: Record<string, CommandName[]>
  httpBase: string
  pending: Record<string, PendingAttachment[]>
  // How big a file the crew may send, in megabytes. One number for everyone,
  // since the host is what turns a big one away.
  attachmentMb: number
  boot: () => Promise<void>
  connect: (session: CurrentSession) => void
  switchTo: (key: string) => Promise<void>
  closePlace: (key: string) => Promise<void>
  wantThread: (threadId: string | null) => void
  loadHistory: () => void
  readThread: (threadId: string) => void
  share: (shared: boolean) => Promise<string | null>
  leave: () => void
  setChatDraft: (text: string) => void
  setChatCommands: (commands: CommandName[]) => void
  setThreadDraft: (threadId: string, text: string) => void
  setThreadCommands: (threadId: string, commands: CommandName[]) => void
  setTyping: (where: string | undefined, on: boolean) => void
  attach: (key: string, files: FileList | File[] | null) => Promise<void>
  detach: (key: string, id: string) => void
  moveAttachments: (from: string, to: string) => void
  setAttachmentLimit: (mb: number) => void
  sendChat: (
    text: string,
    threadId?: string,
    boardId?: string,
    replyTo?: string,
    aimedAt?: string[],
    commands?: CommandName[],
    usePlugin?: string,
    startId?: string
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
  renameThread: (threadId: string, title: string) => void
  deleteThread: (threadId: string) => void
  retryThread: (threadId: string) => void
  implementPlan: (threadId: string) => void
  postChat: (text: string, agentId?: string) => void
  addTodo: (text: string, agentId?: string) => void
  editTodo: (todoId: string, text: string, agentId?: string) => void
  removeTodo: (todoId: string) => void
  checkTodo: (todoId: string, checked: boolean) => void
  doTodo: (todoId: string, agentId?: string) => void
  addTool: (name: string, mark: string, action: ToolAction) => void
  editTool: (toolId: string, name: string, mark: string, action: ToolAction) => void
  removeTool: (toolId: string) => void
  addMemory: (text: string) => string | null
  editMemory: (memoryId: string, text: string) => string | null
  removeMemory: (memoryId: string) => void
  setMemoryEnabled: (enabled: boolean) => void
  addPlugin: (plugin: unknown) => string | null
  installPlugin: (plugin: unknown) => Promise<string | null>
  removePlugin: (pluginId: string) => void
  addSchedule: (name: string, mark: string, when: Cadence, action: ToolAction) => string | null
  editSchedule: (scheduleId: string, name: string, mark: string, when: Cadence, action: ToolAction) => string | null
  removeSchedule: (scheduleId: string) => void
  pauseSchedule: (scheduleId: string, paused: boolean) => void
  runSchedule: (scheduleId: string) => void
  // What comes back is the line to say about a picture that never made it, and
  // nothing at all where it did.
  addCustomEmoji: (name: string, file: File) => Promise<string | null>
  renameCustomEmoji: (emojiId: string, name: string) => string | null
  removeCustomEmoji: (emojiId: string) => void
  stopSubagent: (threadId: string) => void
  restartSubagent: (threadId: string) => void
  postScore: (gameId: string, score: number) => void
  cancelPrompt: (promptId: string) => void
  updateDoc: (page: string, text: string, title?: string, scope?: DocPage['scope']) => void
  retitleDoc: (page: string, title: string) => void
  renameDoc: (from: string, to: string, title?: string) => void
  deleteDoc: (page: string) => void
  editQueued: (promptId: string, text: string) => void
  removeQueued: (promptId: string) => void
  sendQueued: (promptId: string) => void
  takeQueued: (promptId: string) => void
  moveQueued: (promptId: string, to: number) => void
  clearQueueComposed: (threadId: string) => void
  updateAgentSetting: (agentId: string, key: string, value: string) => void
  renameAgent: (agentId: string, label: string) => void
  renameSelf: (name: string) => boolean
  setAgentAvatar: (agentId: string, file: File | null) => void
  setMyPhoto: (file: File | null) => void
  removeAgent: (agentId: string) => void
  openThread: (threadId: string) => void
  openThreadAlone: (threadId: string) => void
  openAlertThread: (threadId: string, place: string | null) => void
  focusThread: (threadId: string) => void
  closeThread: (threadId?: string) => void
  closeThreads: () => void
  setChatColumn: (open: boolean) => void
  openDoc: (page: string) => void
  clearDocsTarget: () => void
  openBoard: (boardId: string) => void
  clearDesignTarget: () => void
}

const socket = new CrewSocket()
let destination: string | null = null
let transition = 0
const pendingPluginInstalls = new Map<string, { finish: (problem: string | null) => void }>()

// A window says it is writing at most every couple of seconds, and says it has
// stopped the moment the box empties, the message goes, or the composer is left.
// The host lets go of a window that never says either, so nothing is owed here
// beyond keeping one keystroke from being one message.
let typingSaid: { where?: string; at: number } | null = null

function sayTyping(where: string | undefined, on: boolean): void {
  if (!on) {
    if (!typingSaid) return
    const said = typingSaid
    typingSaid = null
    socket.send({ type: 'typing', where: said.where, on: false })
    return
  }
  const now = Date.now()
  if (typingSaid && typingSaid.where === where && now - typingSaid.at < TYPING_PING) return
  typingSaid = { where, at: now }
  socket.send({ type: 'typing', where, on: true })
}

// Changing what helpers may do here reaches the host at once, rather than
// waiting for the next time the window happens to connect.
onHelperPrefs(prefs => socket.send({ type: 'subagent.prefs', ...prefs }))

const EMPTY = {
  members: [],
  agents: [],
  events: [],
  eventLimit: EVENT_LIMIT,
  moreHistory: false,
  loadingHistory: false,
  docs: {},
  queues: {},
  queueComposed: {},
  steps: {},
  tokens: {},
  costs: {},
  activePrompts: {},
  threads: {},
  threadPrompts: {},
  readEvents: [],
  readSteps: {},
  todos: [],
  tickets: [],
  tools: [],
  memories: [],
  memoryEnabled: false,
  plugins: [],
  schedules: [],
  emoji: [],
  scores: [],
  boards: [],
  typists: [],
  openThreadIds: [],
  openThreadId: null,
  chatColumn: false,
  docsTarget: null,
  designTarget: null,
  chatDraft: '',
  chatCommands: [],
  threadDrafts: {},
  threadCommands: {},
  pending: {},
  attachmentMb: DEFAULT_ATTACHMENT_MB
}

// Everything a window holds about the crew it is looking at, wiped in one go
// whenever it stops looking at that one.
const BLANK = {
  place: '',
  folder: '',
  joinLink: null,
  hosting: false,
  shared: false,
  selfId: '',
  code: '',
  ...EMPTY
}

export const CHAT_KEY = 'chat'

const byTime = (a: AgentStep, b: AgentStep): number => a.ts - b.ts

const upsertStep = (steps: AgentStep[] | undefined, step: AgentStep): AgentStep[] => {
  const held = steps ?? []
  const last = held[held.length - 1]
  if (!last) return [step]
  if (last.id === step.id) {
    const next = [...held.slice(0, -1), step]
    return last.ts === step.ts ? next : next.sort(byTime)
  }
  if (step.ts >= last.ts && !held.some(one => one.id === step.id)) return [...held, step]
  return [...held.filter(one => one.id !== step.id), step].sort(byTime)
}

const settleSteps = (gathered: Record<string, AgentStep[]>): Record<string, AgentStep[]> => {
  const steps: Record<string, AgentStep[]> = {}
  for (const [promptId, held] of Object.entries(gathered)) {
    const byId = new Map<string, AgentStep>()
    for (const step of held) {
      byId.delete(step.id)
      byId.set(step.id, step)
    }
    steps[promptId] = [...byId.values()].sort(byTime)
  }
  return steps
}

const withAgent = (
  agents: PooledAgent[],
  agentId: string,
  change: (agent: PooledAgent) => PooledAgent
): PooledAgent[] =>
  agents.some(agent => agent.id === agentId)
    ? agents.map(agent => (agent.id === agentId ? change(agent) : agent))
    : agents

const addPrompt = (active: Record<string, string[]>, agentId: string, promptId: string): string[] => [
  ...(active[agentId] ?? []).filter(id => id !== promptId),
  promptId
]

// A photo is one picture, read the same way whether it goes on a person or on
// one of their agents. Anything that is not an image the app can carry is
// dropped here rather than sent for the host to refuse.
const readPhoto = (file: File, limit: number, send: (image: OutgoingAttachment) => void): void => {
  const [picked] = imagesFrom([file], limit)
  if (!picked) return
  void readFiles([picked], 0).then(([image]) => {
    if (image) send({ name: image.name, mime: image.mime, data: image.data })
  })
}

// What a thread is, read off the events that made it. One fold for all three
// ways they arrive: the welcome, one landing live, and a page read back out of
// the history.
const foldThread = (threads: Record<string, ThreadMeta>, event: SessionEvent): boolean => {
  switch (event.kind) {
    case 'thread.started':
      threads[event.threadId] = {
        id: event.threadId,
        agentId: event.agentId,
        agentLabel: event.agentLabel,
        title: event.title,
        titleRefs: event.titleRefs,
        createdBy: event.byName,
        startedAt: event.ts,
        status: 'open',
        mode: event.mode ?? 'build',
        boardId: event.boardId,
        ghost: event.ghost,
        voice: event.voice,
        tickets: event.tickets,
        aside: event.aside,
        forkedFrom: event.forkedFrom,
        parentThreadId: event.parentThreadId,
        parentPromptId: event.parentPromptId,
        helper: event.helper,
        subject: event.subject,
        depth: event.depth,
        helperModel: event.helperModel
      }
      return true
    case 'thread.plan':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], plan: event.text }
      return true
    case 'thread.implement':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], mode: 'build' }
      return true
    case 'thread.archived':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], status: 'archived' }
      return true
    case 'thread.status':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], status: event.status }
      return true
    case 'thread.agent':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], agentId: event.agentId, agentLabel: event.agentLabel }
      return true
    case 'thread.renamed':
      if (!threads[event.threadId]) return false
      threads[event.threadId] = { ...threads[event.threadId], title: event.title }
      return true
    case 'thread.deleted':
      if (!threads[event.threadId]) return false
      delete threads[event.threadId]
      return true
  }
  return false
}

const foldedThreads = (threads: Record<string, ThreadMeta>, event: SessionEvent): Record<string, ThreadMeta> => {
  const next = { ...threads }
  return foldThread(next, event) ? next : threads
}

const pruneSteps = (steps: Record<string, AgentStep[]>, events: SessionEvent[]): Record<string, AgentStep[]> => {
  const live = new Set(events.filter(e => e.kind === 'agent.start').map(e => e.promptId))
  const kept = Object.keys(steps).filter(promptId => live.has(promptId))
  if (kept.length === Object.keys(steps).length) return steps
  return Object.fromEntries(kept.map(promptId => [promptId, steps[promptId]]))
}

// The fork this window asked for, waiting on the thread to really arrive. It is
// named on the way out so there is nothing to guess about which of the threads
// landing was your own, and nobody else's window moves for it.
let forkWanted: string | null = null

// The thread this window was reading in the project it is going back to. The
// welcome is what opens it, since it is the welcome that says which threads
// there are to open. Null is nothing asked for, which is what falls back to
// where the project was left, and an empty list is somebody asking for the
// project itself rather than for any thread in it.
let threadsWanted: string[] | null = null

// The threads whose own history has been asked for. A thread is opened, closed
// and opened again all day, and the log does not move under it, so one asked
// for twice is one request. Every welcome empties it, since a session that has
// come back up is one nothing has been read out of yet.
let threadsRead = new Set<string>()

// What a composer sent and has not been refused for. A message the host would
// not take is a message that never happened, so the words, the chip and the
// files are kept until it is either taken or handed back.
interface HeldSend {
  text: string
  commands: CommandName[]
  attachments: PendingAttachment[]
}

const heldSends = new Map<string, HeldSend>()

export const useCrew = create<CrewState>((set, get) => {
  const stepBuffer = makeStepBuffer(deltas => {
    set(state => {
      const steps = { ...state.steps }
      for (const { promptId, step } of deltas) steps[promptId] = upsertStep(steps[promptId], step)
      return { steps }
    })
  })

  const applyEvent = (event: SessionEvent) => {
    stepBuffer.flush()
    const cue = soundFor(event, get().selfId, get())
    if (cue) playSound(cue)
    // One decision, said in two places: the row in the app and the banner from
    // the system, and neither one waits on the window being in the background.
    const alert =
      finishedAlert(event, get()) ??
      memberMentionAlert(event, get().selfId, get().openThreadIds, get().agents) ??
      memberReplyAlert(event, get().selfId, get().openThreadIds, get().agents) ??
      questionAlert(event, get(), boardOnScreen())
    if (alert) {
      const showAlertThread = (threadId: string, beside: boolean) => {
        if (beside) get().openThread(threadId)
        else get().openThreadAlone(threadId)
        if (!alert.board) return
        useBrowser.getState().showWork(threadId)
        useBrowser.getState().openPanel()
      }
      alertToast(
        alert,
        threadId => showAlertThread(threadId, false),
        threadId => showAlertThread(threadId, true)
      )
      void window.crew?.notify?.(alert)
    }
    // A question asked on the side opens where it is answered. It is a ghost, so
    // this only ever runs in the window that asked it.
    if (event.kind === 'thread.started' && event.aside) {
      useBrowser.getState().openAside(event.threadId, event.title)
    }
    // A fork opens for whoever made it, since a message was just typed into it.
    // Everyone else has the card in the chat, the way they do for any thread.
    if (event.kind === 'thread.started' && event.threadId === forkWanted) {
      forkWanted = null
      get().openThread(event.threadId)
    }
    // What an agent showed comes up for whoever is reading the thread it was
    // shown in, which is the whole of what showing something is. Anywhere else
    // it is the row in that thread, so nobody's panel is taken over by work
    // they are not watching.
    if (event.kind === 'page.shown' && get().openThreadIds.includes(event.threadId)) {
      void openShown(shownPages(event))
    }
    // The same rule for the app an agent put on the simulator. It runs on this
    // machine, so a window that cannot run one is a window that does nothing.
    if (event.kind === 'ios.ran' && get().openThreadIds.includes(event.threadId) && onMac()) {
      useIos.getState().open()
    }
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
    // What an agent said about its own work stands beside the chat's events
    // rather than in them, the same way the host hands it over, so a board is
    // never trimmed away by the window the messages are held in.
    if (isTicketEvent(event.kind)) {
      const said = event as TicketEvent
      set(state => (state.tickets.some(one => one.id === said.id) ? {} : { tickets: [...state.tickets, said] }))
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
      const events = appendEvent(state.events, event, state.eventLimit)
      const threads = foldedThreads(state.threads, event)
      let members = state.members
      let agents = state.agents
      let activePrompts = state.activePrompts
      let steps = state.steps
      let threadPrompts = state.threadPrompts
      switch (event.kind) {
        case 'person.joined': {
          members = members.some(m => m.id === event.memberId)
            ? members.map(m => (m.id === event.memberId ? { ...m, connected: true } : m))
            : [...members, { id: event.memberId, name: event.name, connected: true }]
          break
        }
        case 'person.left': {
          members = members.map(m => (m.id === event.memberId ? { ...m, connected: false } : m))
          break
        }
        case 'agent.online': {
          agents = withAgent(agents, event.agentId, agent => ({ ...agent, status: 'idle' }))
          break
        }
        case 'agent.updated': {
          agents = withAgent(agents, event.agentId, agent => ({ ...agent, settings: event.settings }))
          break
        }
        case 'agent.offline': {
          agents = withAgent(agents, event.agentId, agent => ({ ...agent, status: 'offline' }))
          break
        }
        case 'agent.start': {
          activePrompts = { ...activePrompts, [event.agentId]: addPrompt(activePrompts, event.agentId, event.promptId) }
          if (event.threadId) threadPrompts = { ...threadPrompts, [event.threadId]: event.promptId }
          break
        }
        case 'agent.step': {
          steps = { ...steps, [event.promptId]: upsertStep(steps[event.promptId], event.step) }
          break
        }
        case 'agent.end': {
          activePrompts = {
            ...activePrompts,
            [event.agentId]: (activePrompts[event.agentId] ?? []).filter(id => id !== event.promptId)
          }
          if (event.threadId && threadPrompts[event.threadId] === event.promptId) {
            threadPrompts = { ...threadPrompts }
            delete threadPrompts[event.threadId]
          }
          break
        }
        case 'doc': {
          const title = event.title ?? state.docs[event.page]?.title ?? fallbackTitle(event.page)
          const scope = event.scope ?? state.docs[event.page]?.scope
          return { events, docs: { ...state.docs, [event.page]: { title, text: event.text, scope } } }
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
        case 'memory.added': {
          if (state.memories.some(one => one.id === event.memoryId)) return { events }
          const memory: CrewMemory = {
            id: event.memoryId,
            text: event.text,
            by: event.byName,
            byAgentId: event.agentId,
            ts: event.ts
          }
          return { events, memories: [...state.memories, memory] }
        }
        case 'memory.edited':
          return {
            events,
            memories: state.memories.map(one =>
              one.id === event.memoryId ? { ...one, text: event.text, by: event.byName, byAgentId: event.agentId } : one
            )
          }
        case 'memory.removed':
          return { events, memories: state.memories.filter(one => one.id !== event.memoryId) }
        case 'memory.setting':
          return { events, memoryEnabled: event.enabled }
        case 'plugin.added': {
          if (!currentPluginInstallation(event.plugin)) return { events }
          if (state.plugins.some(one => one.id === event.pluginId)) return { events }
          const plugin: CrewPlugin = {
            ...event.plugin,
            id: event.pluginId,
            by: event.byName,
            byAgentId: event.agentId,
            ts: event.ts
          }
          void refreshPluginConnection(plugin)
          return { events, plugins: [...state.plugins, plugin] }
        }
        case 'plugin.removed': {
          const plugin = state.plugins.find(one => one.id === event.pluginId)
          if (plugin) forgetPluginConnection(plugin)
          return { events, plugins: state.plugins.filter(one => one.id !== event.pluginId) }
        }
        case 'schedule.added': {
          if (state.schedules.some(one => one.id === event.scheduleId)) return { events }
          const schedule: Schedule = {
            id: event.scheduleId,
            name: event.name,
            mark: event.mark,
            when: event.when,
            action: event.action,
            zone: event.zone,
            createdBy: event.byName,
            ts: event.ts
          }
          return { events, schedules: [...state.schedules, schedule] }
        }
        case 'schedule.edited':
          return {
            events,
            schedules: state.schedules.map(one =>
              one.id === event.scheduleId
                ? {
                    ...one,
                    name: event.name,
                    mark: event.mark,
                    when: event.when,
                    action: event.action,
                    zone: event.zone
                  }
                : one
            )
          }
        case 'schedule.removed':
          return { events, schedules: state.schedules.filter(one => one.id !== event.scheduleId) }
        case 'schedule.paused':
          return {
            events,
            schedules: state.schedules.map(one =>
              one.id === event.scheduleId ? { ...one, paused: event.paused } : one
            )
          }
        case 'schedule.ran':
          return {
            events,
            schedules: state.schedules.map(one =>
              one.id === event.scheduleId ? { ...one, lastRunAt: event.ts, lastThreadId: event.threadId } : one
            )
          }
        case 'attachment.limit':
          return { events, attachmentMb: event.mb }
      }
      return {
        events,
        members,
        agents,
        activePrompts,
        steps: events.length <= state.events.length ? pruneSteps(steps, events) : steps,
        threads,
        threadPrompts
      }
    })
  }

  // A send the host refused puts the words, the chip and the files back in the
  // composer they were typed in. Only into one nothing has been put in since:
  // what somebody is writing now beats what is being handed back.
  const putBack = (key: string) => {
    const held = heldSends.get(key)
    if (!held) return
    heldSends.delete(key)
    const state = get()
    const draft = key === CHAT_KEY ? state.chatDraft : (state.threadDrafts[key] ?? '')
    if (draft || (state.pending[key] ?? []).length > 0) return
    set(current =>
      key === CHAT_KEY
        ? {
            chatDraft: held.text,
            chatCommands: held.commands,
            pending: { ...current.pending, [key]: held.attachments }
          }
        : {
            threadDrafts: { ...current.threadDrafts, [key]: held.text },
            threadCommands: { ...current.threadCommands, [key]: held.commands },
            pending: { ...current.pending, [key]: held.attachments }
          }
    )
  }

  const handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome': {
        stepBuffer.drop()
        // Said on every connect, because the host holds it in memory and a host
        // that has just come up knows nothing about what anyone allows.
        socket.send({ type: 'subagent.prefs', ...helperPrefs() })
        const threads: Record<string, ThreadMeta> = {}
        const threadPrompts: Record<string, string> = {}
        const activePrompts: Record<string, string[]> = {}
        const gathered: Record<string, AgentStep[]> = {}
        const tokens: Record<string, number> = {}
        const costs: Record<string, number> = {}
        const gather = (promptId: string, step: AgentStep): void => {
          const held = gathered[promptId]
          if (held) held.push(step)
          else gathered[promptId] = [step]
        }
        for (const event of [...(msg.snapshot.threadEvents ?? []), ...msg.snapshot.events]) {
          foldThread(threads, event)
        }
        for (const event of msg.snapshot.events) {
          if (event.kind === 'agent.step') gather(event.promptId, event.step)
          if (event.kind === 'agent.start') {
            activePrompts[event.agentId] = addPrompt(activePrompts, event.agentId, event.promptId)
            if (event.threadId) threadPrompts[event.threadId] = event.promptId
          }
          if (event.kind === 'agent.end') {
            activePrompts[event.agentId] = (activePrompts[event.agentId] ?? []).filter(id => id !== event.promptId)
            if (event.threadId && threadPrompts[event.threadId] === event.promptId) delete threadPrompts[event.threadId]
          }
        }
        Object.assign(threadPrompts, msg.snapshot.threadPrompts ?? {})
        // A thread that has gone since is not one to come back to, so the row is
        // read against what the welcome really holds.
        const wanted = (threadsWanted ?? []).filter(id => threads[id])
        for (const agent of msg.snapshot.agents) {
          for (const [promptId, run] of Object.entries(agent.runs)) {
            for (const step of run.steps) gather(promptId, step)
            tokens[promptId] = run.tokens
            if (run.cost !== undefined) costs[promptId] = run.cost
          }
        }
        const steps = settleSteps(gathered)
        const plugins = (msg.snapshot.plugins ?? []).filter(currentPluginInstallation)
        void syncPluginConnections(plugins)
        set({
          connection: 'online',
          selfId: msg.selfId,
          selfName: msg.snapshot.members.find(member => member.id === msg.selfId)?.name ?? get().selfName,
          code: msg.snapshot.code,
          members: msg.snapshot.members,
          agents: msg.snapshot.agents,
          events: trimEvents(msg.snapshot.events, EVENT_LIMIT),
          eventLimit: EVENT_LIMIT,
          moreHistory: msg.snapshot.moreEvents ?? false,
          loadingHistory: false,
          docs: msg.snapshot.docs,
          queues: msg.snapshot.queues ?? {},
          todos: msg.snapshot.todos ?? [],
          tickets: msg.snapshot.tickets ?? [],
          tools: msg.snapshot.tools ?? [],
          memories: msg.snapshot.memories ?? [],
          memoryEnabled: msg.snapshot.memoryEnabled ?? false,
          plugins,
          schedules: msg.snapshot.schedules ?? [],
          emoji: msg.snapshot.emoji ?? [],
          attachmentMb: msg.snapshot.attachmentMb ?? DEFAULT_ATTACHMENT_MB,
          scores: msg.snapshot.gameScores ?? [],
          boards: msg.snapshot.boards ?? [],
          steps,
          tokens,
          costs,
          activePrompts,
          threads,
          threadPrompts,
          readEvents: [],
          readSteps: {},
          openThreadIds: wanted,
          openThreadId: wanted.at(-1) ?? null
        })
        threadsWanted = null
        threadsRead = new Set()
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
      case 'queue.taken':
        set(state => ({
          threadDrafts: { ...state.threadDrafts, [msg.threadId]: msg.item.text },
          threadCommands: {
            ...state.threadCommands,
            [msg.threadId]: state.threadPrompts[msg.threadId] ? ['queue'] : []
          },
          pending: {
            ...state.pending,
            [msg.threadId]: msg.attachments.map((attachment, index) => ({
              ...attachment,
              id: msg.item.attachments?.[index]?.id ?? crypto.randomUUID(),
              size: msg.item.attachments?.[index]?.size ?? 0
            }))
          },
          queueComposed: {
            ...state.queueComposed,
            [msg.threadId]: { promptId: msg.item.promptId, replyTo: msg.item.replyTo }
          }
        }))
        break
      case 'queue.take.failed':
        toast.fail(msg.message, { key: `queue-take-${msg.promptId}` })
        break
      case 'event':
        applyEvent(msg.event)
        break
      // A page read back out of the history. The window grows by what arrived,
      // so the next thing to land does not push it straight back out, and the
      // threads it names are folded in under the ones already known, which were
      // built from everything since.
      case 'history':
        stepBuffer.flush()
        set(state => {
          const held = new Set(state.events.map(e => e.id))
          const older = msg.events.filter(e => !held.has(e.id))
          const events = [...older, ...state.events]
          const rebuilt: Record<string, ThreadMeta> = {}
          for (const event of events) foldThread(rebuilt, event)
          const steps = { ...state.steps }
          for (const event of older) {
            if (event.kind === 'agent.step') steps[event.promptId] = upsertStep(steps[event.promptId], event.step)
          }
          return {
            events,
            steps,
            threads: { ...rebuilt, ...state.threads },
            eventLimit: state.eventLimit + older.filter(e => e.kind !== 'agent.step').length,
            moreHistory: msg.more,
            loadingHistory: false
          }
        })
        break
      // One thread read back on its own. The whole of what came back is kept,
      // including what the window happens to hold as well, since the window
      // trims and this does not, and which of the two copies is drawn is
      // settled where a thread is read rather than here. The steps are folded
      // once, on the way in, rather than at every place that draws one.
      case 'thread.history':
        set(state => {
          const readEvents = mergeEvents(msg.events, state.readEvents)
          if (readEvents === state.readEvents) return {}
          const readSteps = { ...state.readSteps }
          for (const event of msg.events) {
            if (event.kind === 'agent.step') {
              readSteps[event.promptId] = upsertStep(readSteps[event.promptId], event.step)
            }
          }
          return { readEvents, readSteps }
        })
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
      case 'member.renamed':
        set(state => {
          const old = state.members.find(member => member.id === msg.fromId)
          const mine = state.selfId === msg.fromId
          const members = state.members.filter(member => member.id !== msg.fromId && member.id !== msg.member.id)
          const events = state.events.map(event => {
            if (event.kind !== 'message' || event.authorId !== msg.fromId) return event
            return { ...event, authorId: msg.member.id, authorName: msg.member.name }
          })
          return {
            selfId: mine ? msg.member.id : state.selfId,
            selfName: mine ? msg.member.name : state.selfName,
            members: [...members, msg.member],
            agents: state.agents.map(agent =>
              agent.ownerId === msg.fromId ? { ...agent, ownerId: msg.member.id, ownerName: msg.member.name } : agent
            ),
            events,
            threads: Object.fromEntries(
              Object.entries(state.threads).map(([id, thread]) => [
                id,
                old && thread.createdBy === old.name ? { ...thread, createdBy: msg.member.name } : thread
              ])
            ),
            queues: Object.fromEntries(
              Object.entries(state.queues).map(([id, items]) => [
                id,
                items.map(item =>
                  item.authorId === msg.fromId
                    ? { ...item, authorId: msg.member.id, authorName: msg.member.name }
                    : item
                )
              ])
            )
          }
        })
        break
      case 'member.avatar':
        set(state => ({
          members: state.members.map(m => (m.id === msg.memberId ? { ...m, avatar: msg.file ?? undefined } : m))
        }))
        break
      case 'agent.step':
        stepBuffer.push(msg.promptId, msg.step)
        break
      case 'agent.usage':
        set(state => ({
          agents: state.agents.map(a => (a.id === msg.agentId ? { ...a, usage: msg.usage } : a))
        }))
        break
      case 'agent.tokens':
        set(state => ({
          tokens: { ...state.tokens, [msg.promptId]: msg.tokens },
          costs: msg.cost === undefined ? state.costs : { ...state.costs, [msg.promptId]: msg.cost }
        }))
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
      case 'emoji.set':
        set({ emoji: msg.emoji })
        break
      case 'game.scores':
        set({ scores: msg.scores })
        break
      case 'plugin.result': {
        const pending = pendingPluginInstalls.get(msg.requestId)
        if (!pending) break
        pending.finish(msg.ok ? null : msg.message || 'The plugin was not installed.')
        break
      }
      case 'typing.room':
        set({ typists: msg.typists })
        break
      // The same thing said twice is one row said again rather than a second
      // one under the first.
      case 'notice':
        if (msg.unsent) putBack(msg.where ?? CHAT_KEY)
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
    place: '',
    folder: '',
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
      destination = null
      transition++
      set({
        connection: 'connecting',
        selfName: session.name,
        place: session.place,
        folder: session.folder,
        joinLink: session.link,
        hosting: session.hosting,
        shared: session.shared,
        httpBase: httpBaseFrom(session.wsUrl)
      })
      const hello: ClientMessage = { type: 'hello', role: 'ui', name: session.name, code: session.code }
      socket.connect(session.wsUrl, hello)
    },
    // Moving between two projects that are both running. The connection goes
    // straight from one to the other and never through home, so the app never
    // unmounts and what the window holds for itself stays where it is.
    switchTo: async key => {
      const from = get().place
      if (destination === key) return
      // The project already on screen with nothing in flight. No welcome is
      // coming, so what was asked of it is answered here rather than waited for.
      if (destination === null && from === key) {
        const wanted = threadsWanted
        threadsWanted = null
        if (!wanted) return
        const open = wanted.filter(id => get().threads[id])
        set({ openThreadIds: open, openThreadId: open.at(-1) ?? null, chatColumn: false })
        return
      }
      destination = key
      const request = ++transition
      const panel = useBrowser.getState()
      if (from && from !== key) stashProject(from, { panel: panel.stash(), openThreadIds: get().openThreadIds })
      const info = await window.crew.switchTo(key).catch(() => null)
      if (request !== transition) return
      const memory = recallProject(key)
      if (!info) {
        destination = null
        if (from) panel.restore(recallProject(from)?.panel ?? null)
        toast.fail('That project is not open any more.', { key: 'switch' })
        return
      }
      const { useHuddle } = await import('./huddle')
      if (request !== transition) return
      useHuddle.getState().leave()
      threadsWanted = threadsWanted ?? memory?.openThreadIds ?? []
      stepBuffer.drop()
      set({ connection: 'connecting', ...BLANK })
      get().connect(info)
      panel.restore(memory?.panel ?? null)
    },
    wantThread: threadId => {
      threadsWanted = threadId ? [threadId] : []
    },
    closePlace: async key => {
      const others = usePlaces.getState().live.filter(place => place.key !== key)
      const leaving = key === get().place
      forgetProject(key)
      if (leaving && !others[0]) {
        get().leave()
        return
      }
      if (leaving) await get().switchTo(others[0].key)
      await window.crew.closeProject(key).catch(() => {})
      void usePlaces.getState().load()
    },
    // The oldest thing held is what the next page is asked for, so one asked
    // for twice is the same page rather than a second one.
    loadHistory: () => {
      const { events, moreHistory, loadingHistory } = get()
      const oldest = events[0]
      if (!moreHistory || loadingHistory || !oldest) return
      set({ loadingHistory: true })
      socket.send({ type: 'history', before: oldest.id })
    },
    // A thread the window has scrolled past, asked for on its own. What says it
    // has is the thread's own beginning: a thread starts once, so a window
    // holding that event holds everything the thread has done since, and one
    // that does not is a row in the rail with nothing under it. A ghost is the
    // one thread this can be asked for and come back empty, since it was never
    // written down, and it is asked once either way.
    readThread: threadId => {
      if (!threadId || get().connection !== 'online' || threadsRead.has(threadId)) return
      if (get().events.some(event => event.kind === 'thread.started' && event.threadId === threadId)) return
      threadsRead.add(threadId)
      socket.send({ type: 'thread.history', threadId })
    },
    // Turning sharing on and off moves the listener and nothing else, so the
    // session stays exactly where it is and the socket comes back on its own.
    share: async shared => {
      const was = get().httpBase
      const info = await window.crew.setShared(shared).catch(() => null)
      if (!info) {
        toast.fail(shared ? 'Could not share the session.' : 'Could not stop sharing.')
        return null
      }
      if (httpBaseFrom(info.wsUrl) !== was) {
        get().connect(info)
        return info.link
      }
      set({ joinLink: info.link, shared: info.shared })
      return info.link
    },
    // Leaving is done with this crew rather than done with the app, so with
    // another one still running the window lands there instead of on the list.
    leave: () => {
      const from = get().place
      const others = usePlaces.getState().live.filter(place => place.key !== from)
      if (from) forgetProject(from)
      useBrowser.getState().stash()
      socket.close()
      stepBuffer.drop()
      void window.crew.leave().then(() => usePlaces.getState().load())
      if (others[0]) {
        set({ connection: 'connecting', ...BLANK })
        void get().switchTo(others[0].key)
        return
      }
      set({ connection: 'home', ...BLANK })
    },
    setChatDraft: text => {
      sayTyping(undefined, text.trim().length > 0)
      set({ chatDraft: text })
    },
    setChatCommands: commands => set({ chatCommands: commands }),
    setThreadDraft: (threadId, text) => {
      sayTyping(threadId, text.trim().length > 0)
      set(state => ({ threadDrafts: { ...state.threadDrafts, [threadId]: text } }))
    },
    setThreadCommands: (threadId, commands) =>
      set(state => ({ threadCommands: { ...state.threadCommands, [threadId]: commands } })),
    setTyping: (where, on) => sayTyping(where, on),
    attach: async (key, files) => {
      const mb = get().attachmentMb
      const picked = filesFrom(files, attachmentBytes(mb))
      // A file left behind for being too big used to go quietly, which reads as
      // a drop that did nothing.
      if (picked.length < [...(files ?? [])].length) {
        toast.fail(`Files can be up to ${attachmentMbLabel(mb)}`, { key: 'attachment-size' })
      }
      if (picked.length === 0) return
      const added = await readFiles(picked, (get().pending[key] ?? []).length)
      if (added.length === 0) return
      set(state => ({ pending: { ...state.pending, [key]: [...(state.pending[key] ?? []), ...added] } }))
    },
    detach: (key, id) =>
      set(state => ({ pending: { ...state.pending, [key]: (state.pending[key] ?? []).filter(a => a.id !== id) } })),
    // A control that stages files under a key of its own has to hand them to
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
    // The number is the crew's, so the host is what writes it down and every
    // window hears it back. Nothing is set here on the way out.
    setAttachmentLimit: mb => {
      socket.send({ type: 'attachment.limit', mb })
    },
    sendChat: (text, threadId, boardId, replyTo, aimedAt, commands, usePlugin, startId) => {
      const key = threadId ?? boardId ?? CHAT_KEY
      const carried = get().pending[key] ?? []
      const attachments = carried.map(({ name, mime, data }) => ({ name, mime, data }))
      // The box is emptied on the way out rather than once the host has taken
      // it, so what was in it is held here until a refusal arrives or nothing
      // does.
      heldSends.set(key, { text, commands: commands ?? [], attachments: carried })
      // A message typed in a composer says who it is for by naming them. One
      // sent from a control that already knows the agent says so by id, so it
      // cannot be lost to a rename, a duplicate name or a fumbled spelling.
      const mentions = aimedAt ?? mentionsIn(text, get().agents)
      sayTyping(threadId ?? boardId, false)
      playSound('send')
      if (threadId || boardId) {
        // A fork is named on the way out rather than waited for and picked out of
        // whatever arrives, so the window that made it opens it and no other.
        const forkId = threadId && commands?.includes('fork') ? globalThis.crypto.randomUUID() : undefined
        forkWanted = forkId ?? forkWanted
        socket.send({
          type: 'chat.send',
          text,
          mentions,
          commands,
          threadId,
          attachments,
          boardId: threadId ? undefined : boardId,
          replyTo,
          forkId,
          usePlugin
        })
        set(state => ({
          threadDrafts: { ...state.threadDrafts, [key]: '' },
          threadCommands: { ...state.threadCommands, [key]: [] },
          pending: { ...state.pending, [key]: [] }
        }))
        return
      }
      socket.send({ type: 'chat.send', text, mentions, commands, attachments, replyTo, usePlugin, startId })
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
      socket.send(
        status === 'archived' ? { type: 'thread.archive', threadId } : { type: 'thread.status', threadId, status }
      )
    },
    renameThread: (threadId, title) => {
      socket.send({ type: 'thread.rename', threadId, title })
    },
    deleteThread: threadId => {
      socket.send({ type: 'thread.delete', threadId })
    },
    retryThread: threadId => {
      socket.send({ type: 'thread.retry', threadId })
    },
    implementPlan: threadId => {
      socket.send({ type: 'plan.implement', threadId })
    },
    postChat: (text, agentId) => {
      socket.send({ type: 'chat.post', text, agentId })
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
    addMemory: text => {
      const clean = cleanMemoryLine(text)
      if (!clean) return 'Write it as a sentence'
      const held = get().memories
      if (held.some(memory => memoryKey(memory.text) === memoryKey(clean))) return 'The crew already knows that one'
      if (held.length >= MEMORY_LIMIT) return MEMORY_FULL
      socket.send({ type: 'memory.add', text: clean })
      return null
    },
    editMemory: (memoryId, text) => {
      const clean = cleanMemoryLine(text)
      if (!clean) return 'Write it as a sentence'
      const held = get().memories
      if (held.some(memory => memory.id !== memoryId && memoryKey(memory.text) === memoryKey(clean))) {
        return 'The crew already knows that one'
      }
      if (clean !== held.find(memory => memory.id === memoryId)?.text) {
        socket.send({ type: 'memory.edit', memoryId, text: clean })
      }
      return null
    },
    removeMemory: memoryId => {
      socket.send({ type: 'memory.remove', memoryId })
    },
    setMemoryEnabled: enabled => {
      socket.send({ type: 'memory.set', enabled })
    },
    addPlugin: plugin => {
      const clean = cleanPlugin(
        currentPluginInstallation((plugin ?? {}) as CrewPlugin) ? plugin : installPlugin(plugin as CrewPlugin)
      )
      if (!clean) return 'Say where it runs'
      const held = get().plugins
      if (held.some(one => pluginKey(one.name) === pluginKey(clean.name))) return 'The crew already has that one'
      if (held.length >= PLUGIN_LIMIT) return PLUGIN_FULL
      socket.send({ type: 'plugin.add', plugin: clean })
      return null
    },
    installPlugin: plugin => {
      const clean = cleanPlugin(
        currentPluginInstallation((plugin ?? {}) as CrewPlugin) ? plugin : installPlugin(plugin as CrewPlugin)
      )
      if (!clean) return Promise.resolve('That plugin is not available.')
      const held = get().plugins
      if (held.some(one => pluginKey(one.name) === pluginKey(clean.name))) {
        return Promise.resolve('The crew already has that one.')
      }
      if (held.length >= PLUGIN_LIMIT) return Promise.resolve(PLUGIN_FULL)
      const key = pluginKey(clean.name)
      const requestId = crypto.randomUUID()
      return new Promise(resolve => {
        let settled = false
        let landed: (() => void) | null = null
        let timer: ReturnType<typeof setTimeout> | null = null
        const finish = (problem: string | null): void => {
          if (settled) return
          settled = true
          pendingPluginInstalls.delete(requestId)
          if (timer) clearTimeout(timer)
          landed?.()
          resolve(problem)
        }
        pendingPluginInstalls.set(requestId, { finish })
        landed = useCrew.subscribe(state => {
          if (state.plugins.some(one => pluginKey(one.name) === key)) finish(null)
        })
        timer = setTimeout(() => finish(PLUGIN_SLOW), PLUGIN_INSTALL_MS)
        socket.send({ type: 'plugin.add', plugin: clean, requestId })
      })
    },
    removePlugin: pluginId => {
      socket.send({ type: 'plugin.remove', pluginId })
    },
    addSchedule: (name, mark, when, action) => {
      if (!cleanCadence(when)) return 'Say when it runs'
      const clean = cleanSchedule(name, mark, when, action, hereZone())
      if (!clean) return 'Say what it does'
      if (get().schedules.length >= SCHEDULE_LIMIT) return SCHEDULE_FULL
      socket.send({ type: 'schedule.add', ...clean })
      return null
    },
    editSchedule: (scheduleId, name, mark, when, action) => {
      if (!cleanCadence(when)) return 'Say when it runs'
      const clean = cleanSchedule(name, mark, when, action, hereZone())
      if (!clean) return 'Say what it does'
      socket.send({ type: 'schedule.edit', scheduleId, ...clean })
      return null
    },
    removeSchedule: scheduleId => {
      socket.send({ type: 'schedule.remove', scheduleId })
    },
    pauseSchedule: (scheduleId, paused) => {
      socket.send({ type: 'schedule.pause', scheduleId, paused })
    },
    runSchedule: scheduleId => {
      socket.send({ type: 'schedule.run', scheduleId })
    },
    // A picture the whole crew will have. The host keeps it beside the session
    // and says so to everyone, so nothing is written down here on the way out.
    // What comes back is the one line to say where it did not go: the name is
    // what somebody types to reach it, so a name that cannot be one and a name
    // already answering to something are both worth saying rather than a picture
    // that quietly does not appear.
    addCustomEmoji: async (name, file) => {
      const clean = nameFor(get().emoji, name)
      if (typeof clean !== 'string') return clean.said
      if (get().emoji.length >= MAX_CUSTOM_EMOJI) return 'The crew has as many emoji as it can hold'
      if (!customEmojiExtension(file.type)) return 'That file is not a picture Crew can draw'
      if (file.size > CUSTOM_EMOJI_MAX_BYTES) return 'That picture is too big for an emoji'
      try {
        const data = await base64Of(file)
        if (!data) return 'That picture could not be read'
        socket.send({ type: 'emoji.add', name: clean, mime: file.type, data })
        return null
      } catch {
        return 'That picture could not be read'
      }
    },
    // Naming one again asks the same question adding one does, so it is answered
    // in the same words and in one place.
    renameCustomEmoji: (emojiId, name) => {
      const held = get().emoji
      const clean = nameFor(
        held.filter(emoji => emoji.id !== emojiId),
        name
      )
      if (typeof clean !== 'string') return clean.said
      if (clean !== held.find(emoji => emoji.id === emojiId)?.name) {
        socket.send({ type: 'emoji.rename', emojiId, name: clean })
      }
      return null
    },
    removeCustomEmoji: emojiId => {
      socket.send({ type: 'emoji.remove', emojiId })
    },
    stopSubagent: threadId => {
      socket.send({ type: 'subagent.stop', threadId })
    },
    restartSubagent: threadId => {
      socket.send({ type: 'subagent.restart', threadId })
    },
    postScore: (gameId, score) => {
      socket.send({ type: 'game.score', gameId, score })
    },
    cancelPrompt: promptId => {
      socket.send({ type: 'prompt.cancel', promptId })
    },
    updateDoc: (page, text, title, scope) => {
      set(state => {
        const kept = title ?? state.docs[page]?.title ?? fallbackTitle(page)
        const keptScope = state.docs[page]?.scope ?? scope
        return { docs: { ...state.docs, [page]: { title: kept, text, scope: keptScope } } }
      })
      socket.send({ type: 'doc.update', page, text, title, scope })
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
    sendQueued: promptId => {
      socket.send({ type: 'queue.send', promptId })
    },
    takeQueued: promptId => {
      socket.send({ type: 'queue.take', promptId })
    },
    moveQueued: (promptId, to) => {
      socket.send({ type: 'queue.move', promptId, to })
    },
    clearQueueComposed: threadId => {
      set(state => {
        if (!state.queueComposed[threadId]) return {}
        const queueComposed = { ...state.queueComposed }
        delete queueComposed[threadId]
        return { queueComposed }
      })
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
    renameSelf: name => {
      const clean = cleanMemberName(name)
      if (!clean || clean === get().selfName) return false
      set({ selfName: clean })
      localStorage.setItem('crew.name', clean)
      socket.send({ type: 'member.rename', name: clean })
      void window.crew.rename(clean)
      return true
    },
    setAgentAvatar: (agentId, file) => {
      if (!file) {
        socket.send({ type: 'agent.avatar', agentId, image: null })
        return
      }
      readPhoto(file, attachmentBytes(get().attachmentMb), image =>
        socket.send({ type: 'agent.avatar', agentId, image })
      )
    },
    setMyPhoto: file => {
      if (!file) {
        socket.send({ type: 'member.avatar', image: null })
        return
      }
      readPhoto(file, attachmentBytes(get().attachmentMb), image => socket.send({ type: 'member.avatar', image }))
    },
    removeAgent: agentId => {
      socket.send({ type: 'agent.remove', agentId })
    },
    openThread: threadId => {
      const open = get().openThreadIds
      if (open.includes(threadId)) {
        set({ openThreadId: threadId })
        return
      }
      if (isFull(open)) {
        toast('Close a thread to open another.', { key: 'thread-views' })
        return
      }
      set({ openThreadIds: openBeside(open, threadId), openThreadId: threadId })
    },
    openThreadAlone: threadId => set({ openThreadIds: [threadId], openThreadId: threadId, chatColumn: false }),
    // A banner names the crew it was raised in, so one clicked after this window
    // has moved on goes back to that project first and the welcome is what opens
    // the thread. Read without the crew it landed on whatever was in view, which
    // is a column standing on a thread that project has never heard of.
    openAlertThread: (threadId, place) => {
      if (place && place !== get().place) {
        get().wantThread(threadId)
        void get().switchTo(place)
        return
      }
      get().openThreadAlone(threadId)
    },
    focusThread: threadId => {
      if (get().openThreadId === threadId) return
      if (!get().openThreadIds.includes(threadId)) return
      set({ openThreadId: threadId })
    },
    closeThread: threadId => {
      const state = get()
      const closing = threadId ?? state.openThreadId
      if (!closing) return
      const left = closeOne(state.openThreadIds, closing)
      set({
        openThreadIds: left,
        openThreadId: focusAfterClose(state.openThreadIds, closing, state.openThreadId),
        chatColumn: left.length > 0 && state.chatColumn
      })
    },
    closeThreads: () => set({ openThreadIds: [], openThreadId: null, chatColumn: false }),
    setChatColumn: open => set({ chatColumn: open }),
    openDoc: page => set({ docsTarget: page }),
    clearDocsTarget: () => set({ docsTarget: null }),
    openBoard: boardId => set({ designTarget: boardId }),
    clearDesignTarget: () => set({ designTarget: null })
  }
})

// What a typed name really is, or the one line to say why it is not a name. Both
// adding an emoji and naming one again ask it, so the words exist once.
const nameFor = (held: CustomEmoji[], asked: string): string | { said: string } => {
  const clean = cleanCustomEmojiName(asked)
  if (!clean) return { said: 'Give it a name in letters and numbers' }
  if (customEmojiNameTaken(held, clean)) return { said: `${customEmojiRef(clean)} is already taken` }
  return clean
}

const base64Of = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('unreadable'))
    reader.readAsDataURL(file)
  })

// The crew's own emoji are drawn from a name, in a DOM walk over rendered
// markdown and in components a dozen callers deep, so they are looked up the way
// the sheet's are rather than handed down. This is the one thing that keeps that
// lookup fed, and it takes the address with it: a name with nowhere to read a
// picture from is nothing rather than a picture that will not load.
useCrew.subscribe(state => holdCustomEmoji(state.emoji, state.httpBase))

useCrew.subscribe((state, prev) => {
  if (state.pending === prev.pending) return
  keepPreviews(
    new Set(
      Object.values(state.pending)
        .flat()
        .map(item => item.id)
    )
  )
})

// What is waiting to be sent, read at the moment it is asked for. A picked GIF is
// attached and sent in the same breath, and a count held from the last render is
// still nought at that point, so a guard reading one would refuse to send the
// thing that was just picked.
export const pendingCount = (key: string): number => useCrew.getState().pending[key]?.length ?? 0
