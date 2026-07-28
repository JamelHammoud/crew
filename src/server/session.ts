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
  fallbackTitle,
  pageCode,
  pageCodeOf,
  resolveDocRef,
  ROOT_PAGE,
  type DocMentionRef,
  type DocPage
} from '../shared/docs'
import {
  boardMentionsOf,
  crewRefs,
  docMentionsOf,
  refsIn,
  type CrewRef
} from '../shared/refs'
import {
  huddleRecordId,
  markDeletedReplies,
  SYSTEM_AUTHOR_ID,
  SYSTEM_AUTHOR_NAME,
  trimEvents,
  type MessageReply,
  type SessionEvent,
  type ThreadMode,
  type ThreadStatus,
  type Todo
} from '../shared/events'
import {
  emptyRoom,
  MAX_HUDDLE_PEERS,
  MAX_SIGNAL_CHARS,
  PEER_ID_CHARS,
  type HuddlePeer,
  type HuddleRoom,
  type HuddleSignal
} from '../shared/huddle'
import { beats, cleanGameScore, type GameScore } from '../shared/games'
import {
  audioExtension,
  BY_LIMIT,
  cleanPlaylistName,
  cleanUploadName,
  emptyMusic,
  isMine,
  isMusicSet,
  isPlaylistId,
  itemFor,
  MAX_PLAYLIST_TRACKS,
  MAX_PLAYLISTS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_SECONDS,
  MAX_UPLOADS,
  musicItems,
  playlistFor,
  trackAfter,
  wrapAt,
  type MusicItem,
  type MusicPlaylist,
  type MusicRoom,
  type MusicUpload
} from '../shared/music'
import { readCommands } from '../shared/commands'
import { IMPLEMENT_PROMPT, PLAN_INSTRUCTIONS } from '../shared/plan'
import {
  agentId,
  agentMentionRefsIn,
  mentionsIn,
  resolveSettings,
  type AgentMentionRef,
  type AgentStatus,
  type AgentSettings,
  type AgentStep,
  type AgentUsage,
  type LiveRun,
  type PooledAgent,
  type RunStep
} from '../shared/llm'
import { memberMentionRefsIn } from '../shared/people'
import { cleanTool, type CrewTool, type ToolAction } from '../shared/toolbox'
import {
  agentEndReactionTarget,
  agentStepReactionTarget,
  isReactionEmoji,
  messageReactionTarget
} from '../shared/reactions'
import type { ClientMessage, QueuedItem, RegisteredLlm, ServerMessage, SessionSnapshot } from '../shared/protocol'
import {
  BOARD_ID,
  resolveBoardRef,
  type BoardMentionRef,
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
  avatar?: string
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
  boardMentions: BoardMentionRef[]
  attachments: Attachment[]
  messageId: string
  replyTo?: MessageReply
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
  replyTo?: MessageReply
}

interface Thread {
  id: string
  agentId: string
  agentLabel: string
  title: string
  createdBy: string
  status: ThreadStatus
  mode: ThreadMode
  plan?: string
  queue: QueuedPrompt[]
  running: string | null
  boardId?: string
  ghost?: boolean
}

// A thread only the window that opened it can see: the socket it belongs to,
// and the transcript it is read back from. Nothing here is ever written to the
// log or handed to anybody else.
interface Ghost {
  ws: WebSocket
  events: SessionEvent[]
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
const LABEL_LIMIT = 40
const CANCEL_REPORT_TIMEOUT_MS = 15000
const RESUME_GRACE_MS = 60000
const STEP_FLUSH_MS = 80
const DESIGN_SAVE_MS = 500
const DESIGN_CURSOR_STEP_MS = 140
const DESIGN_CURSOR_STEPS_MAX = 25

// A person is one row per game however they happen to be capitalised, since a
// member is keyed by their name in lower case everywhere else here too.
const scoreKey = (gameId: string, name: string): string => `${gameId}\n${name.toLowerCase()}`

export class CrewSession {
  readonly code: string
  private createdAt: number
  private members = new Map<string, Member>()
  private agents = new Map<string, AgentState>()
  private threads = new Map<string, Thread>()
  // The threads nobody else can see, keyed by thread. An entry outlives the
  // window that opened it, emptied rather than deleted: a run still coming back
  // from a machine somewhere has to land somewhere sealed, or its last steps
  // would be written down as an ordinary thread's.
  private ghosts = new Map<string, Ghost>()
  // A picture sent to one of them, held by the file name the message carries
  // and by the window it belongs to. Everything else about a ghost thread is
  // kept in memory, and a file beside the session would be the one part of it
  // the crew syncs.
  private ghostFiles = new Map<string, { ws: WebSocket; mime: string; data: Buffer }>()
  private todos = new Map<string, Todo>()
  private tools = new Map<string, CrewTool>()
  private events: SessionEvent[] = []
  private docs = new Map<string, DocPage>()
  private designs = new Map<string, DesignBoard>()
  private designCursorTimers = new Map<string, NodeJS.Timeout[]>()
  // One huddle per session, keyed by the connection in it: two windows on the
  // same folder are the same member but two separate people in the call.
  private huddle = new Map<WebSocket, HuddlePeer>()
  private huddleStartedAt: number | null = null
  private huddleId: string | null = null
  // Everyone the log already names for this call, so coming back to it after a
  // dropped window does not say they joined twice.
  private huddleNamed = new Set<string>()
  // What is playing, and the moment it was last set, so the position can be
  // worked out for whoever asks. Held in memory the way a call is.
  private music: {
    track: MusicItem
    playing: boolean
    from: number
    since: number
    by: string
    playlistId: string | null
    loop: boolean
  } | null = null
  // What is waiting for the track that is on to end. The host is the one clock
  // everyone reads, so it is the one that walks the list on rather than whichever
  // machine notices first and tells the others.
  private musicTimer: ReturnType<typeof setTimeout> | null = null
  // The shelf the crew filled itself. Unlike what is playing, this is written
  // down: a track somebody added is still there tomorrow.
  private uploads = new Map<string, MusicUpload>()
  // The lists people wrote for themselves, written down for the same reason.
  private playlists = new Map<string, MusicPlaylist>()
  // The leaderboard: one row per person per game, their best and nothing else.
  private scores = new Map<string, GameScore>()
  private docTitles = new Map<string, string>()
  private docRenames = new Map<string, { to: string; ts: number }>()
  private meta = new Map<WebSocket, ConnMeta>()
  private removedAgents = new Set<string>()
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
      this.members.set(m.name.toLowerCase(), { id: m.id, name: m.name, avatar: m.avatar, connections: new Set() })
    }
    for (const id of persisted?.removedAgents ?? []) this.removedAgents.add(id)
    for (const a of persisted?.agents ?? []) {
      if (this.removedAgents.has(a.id)) continue
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
    const deletedHuddles = new Set(loaded.filter(e => e.kind === 'huddle.deleted').map(e => e.huddleId))
    const inDeletedHuddle = (event: SessionEvent): boolean => {
      const huddleId = huddleRecordId(event)
      return huddleId !== undefined && deletedHuddles.has(huddleId)
    }
    const edits = new Map<string, Extract<SessionEvent, { kind: 'message.edited' }>>()
    for (const event of loaded) {
      if (event.kind === 'message.edited') edits.set(event.messageId, event)
    }
    this.events = markDeletedReplies(
      loaded
        .filter(
          e =>
            e.kind !== 'message.deleted' &&
            e.kind !== 'message.edited' &&
            e.kind !== 'huddle.deleted' &&
            !(e.kind === 'message' && deleted.has(e.id)) &&
            !(e.kind === 'message.reaction' && deletedTargets.has(e.targetId)) &&
            !inDeletedHuddle(e)
        )
        .map(e => {
          if (e.kind !== 'message') return e
          const edit = edits.get(e.id)
          if (!edit) return e
          return {
            ...e,
            text: edit.text,
            mentionRefs: edit.mentionRefs ?? e.mentionRefs,
            docMentions: edit.docMentions ?? e.docMentions,
            editedTs: edit.ts
          }
        }),
      deletedTargets
    )
    for (const event of this.events) {
      if (event.kind === 'thread.started') {
        this.threads.set(event.threadId, {
          id: event.threadId,
          agentId: event.agentId,
          agentLabel: event.agentLabel,
          title: event.title,
          createdBy: event.byName,
          status: 'open',
          mode: event.mode ?? 'build',
          queue: [],
          running: null,
          boardId: event.boardId
        })
      }
      if (event.kind === 'thread.plan') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.plan = event.text
      }
      if (event.kind === 'thread.implement') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.mode = 'build'
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
        if (todo) {
          todo.checked = event.checked
          todo.checkedTs = event.checked ? event.ts : undefined
        }
      }
      if (event.kind === 'todo.removed' || event.kind === 'todo.started') {
        this.todos.delete(event.todoId)
      }
      if (event.kind === 'tool.added') {
        this.tools.set(event.toolId, {
          id: event.toolId,
          name: event.name,
          mark: event.mark,
          action: event.action,
          createdBy: event.byName,
          ts: event.ts
        })
      }
      if (event.kind === 'tool.edited') {
        const tool = this.tools.get(event.toolId)
        if (tool) {
          tool.name = event.name
          tool.mark = event.mark
          tool.action = event.action
        }
      }
      if (event.kind === 'tool.removed') {
        this.tools.delete(event.toolId)
      }
      // A track whose file has gone is left off the shelf rather than offered
      // as a row that plays nothing.
      if (event.kind === 'music.added' && this.store.musicPath(event.file)) {
        this.uploads.set(event.trackId, {
          id: event.trackId,
          name: event.name,
          file: event.file,
          seconds: event.seconds,
          by: event.byName,
          ts: event.ts
        })
      }
      if (event.kind === 'music.removed') {
        this.uploads.delete(event.trackId)
      }
      if (event.kind === 'playlist.added') {
        this.playlists.set(event.playlistId, {
          id: event.playlistId,
          name: event.name,
          by: event.byName,
          trackIds: [],
          ts: event.ts
        })
      }
      if (event.kind === 'playlist.removed') {
        this.playlists.delete(event.playlistId)
      }
      if (event.kind === 'playlist.renamed') {
        const playlist = this.playlists.get(event.playlistId)
        if (playlist) playlist.name = event.name
      }
      if (event.kind === 'playlist.track') {
        const playlist = this.playlists.get(event.playlistId)
        if (playlist) {
          const held = playlist.trackIds.filter(id => id !== event.trackId)
          playlist.trackIds = event.on ? [...held, event.trackId] : held
        }
      }
      // The log holds every score anyone ever beat their own with, so reading
      // it back keeps the last one standing rather than the highest: they went
      // in in the order they were played, and each one already beat the one
      // before it.
      if (event.kind === 'game.score') {
        this.scores.set(scoreKey(event.gameId, event.byName), {
          gameId: event.gameId,
          name: event.byName,
          score: event.score,
          ts: event.ts
        })
      }
      if (event.kind === 'thread.agent') {
        const thread = this.threads.get(event.threadId)
        if (thread) {
          thread.agentId = event.agentId
          thread.agentLabel = event.agentLabel
        }
      }
    }
    // A call the host was in when it went down has a start in the log and no
    // end. It ran until the session last said anything, so that is where it is
    // closed, rather than being left reading as live forever. This goes before
    // the runs below are closed off, because those are written at the time of
    // the restart and would stretch the call out to meet them.
    const finished = new Set<string>()
    for (const event of this.events) {
      if (event.kind === 'huddle.ended') finished.add(event.huddleId)
    }
    const lastTs = this.events.at(-1)?.ts ?? Date.now()
    for (const event of [...this.events]) {
      if (event.kind !== 'huddle.started' || finished.has(event.huddleId)) continue
      const close: SessionEvent = {
        id: randomUUID(),
        ts: Math.max(event.ts, lastTs),
        kind: 'huddle.ended',
        huddleId: event.huddleId,
        ms: Math.max(0, lastTs - event.ts)
      }
      this.events.push(close)
      store.appendEvent(close)
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
        connected: m.connections.size > 0,
        avatar: m.avatar
      })),
      agents: [...this.agents.values()].map(agent => this.pooled(agent)),
      events: trimEvents(this.events, SNAPSHOT_EVENT_LIMIT),
      docs: Object.fromEntries(this.docs),
      queues: Object.fromEntries(
        [...this.threads.values()]
          .filter(thread => thread.queue.length > 0 && !thread.ghost)
          .map(thread => [thread.id, this.queueItems(thread)])
      ),
      todos: [...this.todos.values()],
      tools: [...this.tools.values()],
      boards: this.boardList(),
      huddle: this.huddleRoom(),
      music: this.musicRoom(),
      musicUploads: [...this.uploads.values()],
      musicPlaylists: this.playlistList(),
      gameScores: [...this.scores.values()]
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
        if (meta.role === 'ui') {
          this.handleChat(ws, member, msg.text, msg.mentions, msg.threadId, msg.attachments, msg.boardId, msg.replyTo)
        }
        break
      case 'chat.delete':
        if (meta.role === 'ui') this.handleDeleteMessage(member, msg.messageId)
        break
      case 'chat.edit':
        if (meta.role === 'ui') this.handleEditMessage(member, msg.messageId, msg.text)
        break
      case 'chat.react':
        if (meta.role === 'ui') this.handleReaction(ws, member, msg.targetId, msg.emoji)
        break
      case 'thread.archive':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) {
          this.handleThreadStatus(member, msg.threadId, 'archived')
        }
        break
      case 'thread.status':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) {
          this.handleThreadStatus(member, msg.threadId, msg.status)
        }
        break
      case 'plan.implement':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) this.handlePlanImplement(member, msg.threadId)
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
      case 'tool.add':
        if (meta.role === 'ui') this.handleToolAdd(member, msg.name, msg.mark, msg.action)
        break
      case 'tool.edit':
        if (meta.role === 'ui') this.handleToolEdit(member, msg.toolId, msg.name, msg.mark, msg.action)
        break
      case 'tool.remove':
        if (meta.role === 'ui') this.handleToolRemove(member, msg.toolId)
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
      case 'design.peek':
        if (meta.role === 'ui') this.handleDesignPeek(ws, msg.boardId)
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
      case 'huddle.join':
        if (meta.role === 'ui') this.handleHuddleJoin(ws, member, msg.peerId, msg.muted, msg.camera)
        break
      case 'huddle.leave':
        if (meta.role === 'ui') this.handleHuddleLeave(ws)
        break
      case 'huddle.update':
        if (meta.role === 'ui') this.handleHuddleUpdate(ws, msg)
        break
      case 'huddle.signal':
        if (meta.role === 'ui') this.handleHuddleSignal(ws, msg.to, msg.signal)
        break
      case 'huddle.delete':
        if (meta.role === 'ui') this.handleDeleteHuddle(member, msg.huddleId)
        break
      case 'music.set':
        if (meta.role === 'ui') this.handleMusicSet(member, msg.trackId, msg.playing, msg.at, msg.playlistId)
        break
      case 'music.off':
        if (meta.role === 'ui') this.handleMusicOff()
        break
      case 'music.loop':
        if (meta.role === 'ui') this.handleMusicLoop(msg.loop)
        break
      case 'music.add':
        if (meta.role === 'ui') this.handleMusicAdd(member, msg.name, msg.mime, msg.seconds, msg.data)
        break
      case 'music.remove':
        if (meta.role === 'ui') this.handleMusicRemove(member, msg.trackId)
        break
      case 'playlist.add':
        if (meta.role === 'ui') this.handlePlaylistAdd(member, msg.name, msg.playlistId)
        break
      case 'playlist.remove':
        if (meta.role === 'ui') this.handlePlaylistRemove(member, msg.playlistId)
        break
      case 'playlist.rename':
        if (meta.role === 'ui') this.handlePlaylistRename(member, msg.playlistId, msg.name)
        break
      case 'playlist.track':
        if (meta.role === 'ui') this.handlePlaylistTrack(member, msg.playlistId, msg.trackId, msg.on)
        break
      case 'game.score':
        if (meta.role === 'ui') this.handleGameScore(member, msg.gameId, msg.score)
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
      case 'agent.rename':
        if (meta.role === 'ui') this.handleRename(member, msg.agentId, msg.label)
        break
      case 'agent.avatar':
        if (meta.role === 'ui') this.handleAvatar(member, msg.agentId, msg.image)
        break
      case 'member.avatar':
        if (meta.role === 'ui') this.handleMemberAvatar(member, msg.image)
        break
      case 'agent.remove':
        if (meta.role === 'ui') this.handleRemove(msg.agentId)
        break
      case 'agent.register':
        if (meta.role === 'runner') this.registerAgent(ws, member, msg.llm)
        break
      case 'agent.deregister':
        if (meta.role === 'runner') this.deregisterAgent(msg.agentId)
        break
      case 'agent.step':
        if (this.promptGone(ws, meta, msg.promptId)) break
        this.handleStep(meta, msg.promptId, msg.step)
        break
      case 'agent.usage':
        if (meta.role === 'runner') this.handleUsage(meta, msg.agentId, msg.usage)
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
    ws: WebSocket,
    member: Member,
    text: string,
    mentions: string[],
    threadId?: string,
    incoming?: OutgoingAttachment[],
    boardId?: string,
    replyTargetId?: string
  ): void {
    // A command only opens threads, so inside one it stays plain text.
    const command = threadId
      ? { planning: false, ghost: false, text: text.trim() }
      : readCommands(text.trim())
    const trimmed = command.text
    const hidden = threadId ? this.ghostOf(threadId) !== undefined : command.ghost
    const attachments = this.saveAttachments(incoming, hidden ? ws : undefined)
    if (!trimmed && attachments.length === 0) return
    const replyTo = this.replyReference(ws, replyTargetId)
    if (threadId) {
      const thread = this.threads.get(threadId)
      if (!thread || this.hiddenFrom(ws, threadId)) return
      if (thread.status !== 'open') this.handleThreadStatus(member, threadId, 'open')
      const named = [...new Set(mentions)].filter(id => this.agents.has(id))
      // An agent on somebody else's machine cannot take a ghost thread, so
      // naming one reads the way naming an agent who is not here reads: the
      // thread's own agent takes it.
      const targets = hidden ? named.filter(id => this.ownAgent(member, id)) : named
      if (targets.length === 0) targets.push(thread.agentId)
      const messageId = randomUUID()
      if (!targets.includes(thread.agentId)) this.switchThreadAgent(thread, targets[0], member)
      for (const id of targets) {
        const agent = this.agents.get(id)
        if (!agent) continue
        this.enqueuePrompt(agent, member, trimmed, threadId, attachments, { messageId, mentions: targets, replyTo })
      }
      return
    }
    const named = [...new Set(mentions)].filter(id => this.agents.has(id))
    const ids = command.ghost ? named.filter(id => this.ownAgent(member, id)) : named
    const mode: ThreadMode = command.planning ? 'plan' : 'build'
    const ghost = command.ghost ? ws : undefined
    if (ids.length === 0) {
      // The one asking is the only one who knows a ghost thread was meant, so
      // saying why it did not open goes to them and nowhere else. An agent was
      // named here, so nobody else stands in for it.
      if (command.ghost && named.length > 0) {
        this.systemMessage("That agent runs on somebody else's machine. Mention one of your own.", undefined, ws)
        return
      }
      // A command needs someone to take it. With one agent here that is not a
      // question worth asking, and a ghost thread only ever goes to an agent of
      // your own, so one of yours takes it rather than being asked for.
      const taker = command.ghost ? (this.agentsHere(member.id)[0] ?? null) : command.planning ? this.soloAgent() : null
      if (taker) {
        this.startThread(member, taker, trimmed, attachments, { boardId, mode, ghost, replyTo })
        return
      }
      if (command.ghost) {
        this.systemMessage('No agent of yours is here to take it.', undefined, ws)
        return
      }
      if (command.planning) {
        this.systemMessage('Mention an agent with @ to say who should write the plan.')
        return
      }
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'message',
        authorId: member.id,
        authorName: member.name,
        text: trimmed,
        mentions,
        mentionRefs: this.agentRefs(mentions, trimmed),
        memberMentionRefs: this.memberRefs(trimmed),
        ...this.refsOf(trimmed),
        attachments,
        replyTo
      })
      return
    }
    for (const id of ids) {
      this.startThread(member, this.agents.get(id)!, trimmed, attachments, {
        boardId,
        mode,
        ghost,
        mentions: ids,
        replyTo
      })
    }
  }

  private agentsHere(ownerId?: string): AgentState[] {
    return [...this.agents.values()].filter(
      agent => agent.runner && (ownerId === undefined || agent.ownerId === ownerId)
    )
  }

  private soloAgent(): AgentState | null {
    const here = this.agentsHere()
    return here.length === 1 ? here[0] : null
  }

  // A prompt reaches whatever machine runs the agent, and the CLI there keeps
  // its own record of it, so a ghost thread only ever goes to an agent of your
  // own. Anywhere else it is somebody else's to read, whatever the app shows.
  private ownAgent(member: Member, id: string): boolean {
    return this.agents.get(id)?.ownerId === member.id
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
    opts: {
      boardId?: string
      mode?: ThreadMode
      ghost?: WebSocket
      mentions?: string[]
      replyTo?: MessageReply
    } = {}
  ): string {
    const threadId = randomUUID()
    const boardId = opts.boardId
    const thread: Thread = {
      id: threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: this.titleFrom(text || attachments.map(a => a.name).join(', ')),
      createdBy: member.name,
      status: 'open',
      mode: opts.mode ?? 'build',
      queue: [],
      running: null,
      boardId: boardId && this.designs.has(boardId) ? boardId : undefined,
      ghost: opts.ghost !== undefined
    }
    this.threads.set(threadId, thread)
    // Before the first word of it is emitted, or that word goes to everyone.
    if (opts.ghost) this.ghosts.set(threadId, { ws: opts.ghost, events: [] })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'thread.started',
      threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: thread.title,
      titleRefs: this.agentRefs(opts.mentions ?? [agent.id], thread.title),
      byName: member.name,
      boardId: thread.boardId,
      mode: thread.mode === 'plan' ? 'plan' : undefined,
      ghost: thread.ghost ? true : undefined
    })
    this.enqueuePrompt(agent, member, text, threadId, attachments, {
      messageId: randomUUID(),
      mentions: [agent.id],
      replyTo: opts.replyTo
    })
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
    const ts = Date.now()
    todo.checked = checked
    todo.checkedTs = checked ? ts : undefined
    this.emit({ id: randomUUID(), ts, kind: 'todo.checked', todoId, checked, byName: member.name })
  }

  private handleToolAdd(member: Member, name: string, mark: string, action: ToolAction): void {
    const clean = cleanTool(name, mark, action)
    if (!clean) return
    const tool: CrewTool = {
      id: randomUUID(),
      name: clean.name,
      mark: clean.mark,
      action: clean.action,
      createdBy: member.name,
      ts: Date.now()
    }
    this.tools.set(tool.id, tool)
    this.emit({
      id: randomUUID(),
      ts: tool.ts,
      kind: 'tool.added',
      toolId: tool.id,
      name: tool.name,
      mark: tool.mark,
      action: tool.action,
      byName: member.name
    })
  }

  private handleToolEdit(member: Member, toolId: string, name: string, mark: string, action: ToolAction): void {
    const tool = this.tools.get(toolId)
    const clean = cleanTool(name, mark, action)
    if (!tool || !clean) return
    tool.name = clean.name
    tool.mark = clean.mark
    tool.action = clean.action
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'tool.edited',
      toolId,
      name: clean.name,
      mark: clean.mark,
      action: clean.action,
      byName: member.name
    })
  }

  private handleToolRemove(member: Member, toolId: string): void {
    if (!this.tools.delete(toolId)) return
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'tool.removed', toolId, byName: member.name })
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
      mentionRefs: this.agentRefs(entry.mentions, entry.text),
      memberMentionRefs: this.memberRefs(entry.text),
      docMentions: entry.docMentions,
      boardMentions: entry.boardMentions,
      threadId: entry.threadId,
      attachments: entry.attachments,
      replyTo: entry.replyTo
    })
  }

  private refsOf(text: string): { docMentions: DocMentionRef[]; boardMentions: BoardMentionRef[] } {
    const refs = this.crewRefsIn(text)
    return { docMentions: docMentionsOf(refs), boardMentions: boardMentionsOf(refs) }
  }

  private crewRefsIn(text: string): CrewRef[] {
    return refsIn(text, crewRefs(Object.fromEntries(this.docs), this.boardList()))
  }

  private memberRefs(text: string) {
    return memberMentionRefsIn(
      text,
      [...this.members.values()].map(member => ({ id: member.id, name: member.name }))
    )
  }

  // Pairs the agents a piece of text pointed at with the names they carried
  // when it was written, so the text can be read back under their names today.
  // Every name written in it counts, not only the agents it was routed to: one
  // that was away still gets its mention brought along when it is renamed.
  private agentRefs(ids: string[], text = ''): AgentMentionRef[] {
    const refs = new Map<string, AgentMentionRef>()
    const written = agentMentionRefsIn(text, [...this.agents.values()].map(agent => this.pooled(agent)))
    for (const ref of written) refs.set(ref.id, ref)
    for (const id of ids) {
      const agent = this.agents.get(id)
      if (agent) refs.set(agent.id, { id: agent.id, label: agent.label })
    }
    return [...refs.values()]
  }

  private handleDeleteMessage(member: Member, messageId: string): void {
    const index = this.events.findIndex(e => e.kind === 'message' && e.id === messageId)
    if (index === -1) return
    const event = this.events[index]
    if (event.kind !== 'message' || event.authorId !== member.id) return
    this.events.splice(index, 1)
    const targetId = messageReactionTarget(messageId)
    this.events = markDeletedReplies(
      this.events.filter(e => e.kind !== 'message.reaction' || e.targetId !== targetId),
      new Set([targetId])
    )
    const tombstone: SessionEvent = { id: randomUUID(), ts: Date.now(), kind: 'message.deleted', messageId }
    this.store.appendEvent(tombstone)
    this.broadcast({ type: 'event', event: tombstone })
    this.onSyncNeeded?.()
  }

  // Whoever started a call can take its block out of the chat, and only once the
  // call is over: while it is going the block is the way in, so removing it
  // would take the way in off everyone else's screen mid-call.
  private handleDeleteHuddle(member: Member, huddleId: string): void {
    if (this.huddleId === huddleId) return
    const started = this.events.find(e => e.kind === 'huddle.started' && e.huddleId === huddleId)
    if (!started || started.kind !== 'huddle.started' || started.byId !== member.id) return
    this.events = this.events.filter(e => huddleRecordId(e) !== huddleId)
    const tombstone: SessionEvent = { id: randomUUID(), ts: Date.now(), kind: 'huddle.deleted', huddleId }
    this.store.appendEvent(tombstone)
    this.broadcast({ type: 'event', event: tombstone })
    this.onSyncNeeded?.()
  }

  private handleEditMessage(member: Member, messageId: string, text: string): void {
    const event = this.events.find(e => e.kind === 'message' && e.id === messageId)
    if (!event || event.kind !== 'message') return
    if (event.authorId !== member.id || event.threadId) return
    const trimmed = text.trim()
    if (!trimmed || trimmed === event.text) return
    const { docMentions, boardMentions } = this.refsOf(trimmed)
    const mentionRefs = this.agentRefs([], trimmed)
    const memberMentionRefs = this.memberRefs(trimmed)
    event.text = trimmed
    event.docMentions = docMentions
    event.boardMentions = boardMentions
    event.mentionRefs = mentionRefs
    event.memberMentionRefs = memberMentionRefs
    const ts = Date.now()
    event.editedTs = ts
    this.emit({
      id: randomUUID(),
      ts,
      kind: 'message.edited',
      messageId,
      text: trimmed,
      mentionRefs,
      memberMentionRefs,
      docMentions,
      boardMentions
    })
  }

  private handleReaction(ws: WebSocket, member: Member, targetId: string, emoji: string): void {
    if (!isReactionEmoji(emoji)) return
    const target = this.reactionTarget(targetId, this.ghostEventsFor(ws))
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

  // A reply or a reaction inside a ghost thread has to find what it points at,
  // and that was never written to the session, so the transcripts the asker can
  // see stand at the end of the scan: the search runs backwards and every target
  // id is its own. Only the ones they can see, or a reply is a way to read a
  // line out of somebody else's ghost thread by naming what it points at.
  private reactionTarget(targetId: string, within: SessionEvent[] = []): ReactionTarget | null {
    const events = within.length === 0 ? this.events : [...this.events, ...within]
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i]
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

  // A target id already names one message, so where it was said is not part of
  // finding it. Asking for the thread to match as well dropped the quote in
  // silence whenever a reply crossed from a live run into the log.
  private replyReference(ws: WebSocket, targetId: string | undefined): MessageReply | undefined {
    if (!targetId) return undefined
    const target = this.reactionTarget(targetId, this.ghostEventsFor(ws))
    if (!target) return undefined
    return {
      targetId,
      authorId: target.authorId,
      authorName: target.authorName,
      text: target.text.replace(/\s+/g, ' ').trim().slice(0, 280)
    }
  }

  // Implementing is the moment the thread stops planning: the plan stays on it
  // as the brief, and the agent gets a turn to build it.
  private handlePlanImplement(member: Member, threadId: string): void {
    const thread = this.threads.get(threadId)
    if (!thread || thread.mode !== 'plan' || !thread.plan) return
    const agent = this.agents.get(thread.agentId)
    if (!agent) return
    thread.mode = 'build'
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.implement', threadId, byName: member.name })
    if (thread.status !== 'open') this.handleThreadStatus(member, threadId, 'open')
    this.enqueuePrompt(agent, member, IMPLEMENT_PROMPT, threadId, [])
  }

  private handleThreadStatus(member: Member, threadId: string, status: ThreadStatus): void {
    const thread = this.threads.get(threadId)
    if (!thread || !THREAD_STATUSES.has(status) || thread.status === status) return
    thread.status = status
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.status', threadId, status, byName: member.name })
  }

  private saveAttachments(incoming?: OutgoingAttachment[], hidden?: WebSocket): Attachment[] {
    const saved: Attachment[] = []
    for (const item of (incoming ?? []).slice(0, MAX_ATTACHMENTS)) {
      const data = Buffer.from(item.data, 'base64')
      const one = hidden
        ? this.holdAttachment(hidden, item.mime, item.name, data)
        : this.saveAttachment(item.mime, item.name, data)
      if (one) saved.push(one)
    }
    return saved
  }

  saveAttachment(mime: string, name: string, data: Buffer): Attachment | null {
    const one = this.attachmentOf(mime, name, data)
    if (!one) return null
    try {
      this.store.saveAttachment(one.file, data)
    } catch {
      return null
    }
    return one
  }

  // The picture on a ghost message, kept for the window that sent it and served
  // from here rather than from the folder.
  private holdAttachment(ws: WebSocket, mime: string, name: string, data: Buffer): Attachment | null {
    const one = this.attachmentOf(mime, name, data)
    if (!one) return null
    this.ghostFiles.set(one.file, { ws, mime, data })
    return one
  }

  private attachmentOf(mime: string, name: string, data: Buffer): Attachment | null {
    if (!isImageType(mime)) return null
    if (data.length === 0 || data.length > MAX_ATTACHMENT_BYTES) return null
    const id = randomUUID()
    return { id, name: this.safeName(name), mime, size: data.length, file: `${id}.${extensionFor(mime)}` }
  }

  private safeName(name: string): string {
    const flat = name.replace(/[\r\n]+/g, ' ').trim()
    return flat.slice(0, 120) || 'image'
  }

  attachmentPath(file: string): string | null {
    return this.store.attachmentPath(file)
  }

  attachmentBytes(file: string): Buffer | null {
    return this.ghostFiles.get(file)?.data ?? null
  }

  private assignPageCodes(): void {
    const taken = new Set([...this.docs.keys()].map(pageCodeOf))
    const pending = [...this.docs.keys()]
      .filter(page => page !== ROOT_PAGE && !pageCodeOf(page))
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
    if (page === ROOT_PAGE || !this.docs.has(page)) return
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

  private handleDesignPeek(ws: WebSocket, boardId: string): void {
    const board = this.designs.get(boardId)
    if (!board) return
    this.send(ws, { type: 'design.preview', boardId, document: board.document })
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

  private huddleRoom(): HuddleRoom {
    if (this.huddle.size === 0) return emptyRoom()
    return {
      id: this.huddleId,
      peers: [...this.huddle.values()].sort((a, b) => a.joinedAt - b.joinedAt),
      startedAt: this.huddleStartedAt
    }
  }

  private broadcastHuddle(): void {
    this.broadcast({ type: 'huddle.room', room: this.huddleRoom() })
  }

  // A dropped socket takes a while to close, so a client coming back with the
  // peer id it already had takes its own place over rather than doubling up.
  private handleHuddleJoin(
    ws: WebSocket,
    member: Member,
    rawPeerId: string,
    muted: boolean,
    camera: boolean
  ): void {
    if (typeof rawPeerId !== 'string' || rawPeerId.trim().length === 0) return
    const peerId = rawPeerId.trim().slice(0, PEER_ID_CHARS)
    let existing = this.huddle.get(ws)
    for (const [other, peer] of [...this.huddle]) {
      if (peer.peerId !== peerId || other === ws) continue
      existing = existing ?? peer
      this.huddle.delete(other)
    }
    if (!existing && this.huddle.size >= MAX_HUDDLE_PEERS) {
      this.send(ws, { type: 'error', message: 'This huddle is full.' })
      return
    }
    this.huddle.set(ws, {
      peerId,
      memberId: member.id,
      name: member.name,
      muted: muted === true,
      camera: camera === true,
      sharing: existing?.sharing ?? false,
      joinedAt: existing?.joinedAt ?? Date.now()
    })
    this.recordHuddleArrival(member)
    this.broadcastHuddle()
  }

  private handleHuddleLeave(ws: WebSocket): void {
    if (!this.huddle.delete(ws)) return
    if (this.huddle.size === 0) this.recordHuddleEnd()
    this.broadcastHuddle()
  }

  // The chat keeps the record of a call: who started it, who came, and how long
  // it ran. The call itself stays out of the log, so nothing about the media or
  // the handshake is ever committed.
  private recordHuddleArrival(member: Member): void {
    if (this.huddleStartedAt === null) {
      this.huddleStartedAt = Date.now()
      this.huddleId = randomUUID()
      this.huddleNamed = new Set([member.id])
      this.emit({
        id: randomUUID(),
        ts: this.huddleStartedAt,
        kind: 'huddle.started',
        huddleId: this.huddleId,
        byId: member.id,
        byName: member.name
      })
      return
    }
    if (this.huddleId === null || this.huddleNamed.has(member.id)) return
    this.huddleNamed.add(member.id)
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'huddle.joined',
      huddleId: this.huddleId,
      memberId: member.id,
      name: member.name
    })
  }

  private recordHuddleEnd(): void {
    const huddleId = this.huddleId
    const startedAt = this.huddleStartedAt
    this.huddleId = null
    this.huddleStartedAt = null
    this.huddleNamed.clear()
    if (huddleId === null || startedAt === null) return
    const ts = Date.now()
    this.emit({ id: randomUUID(), ts, kind: 'huddle.ended', huddleId, ms: ts - startedAt })
  }

  private handleHuddleUpdate(
    ws: WebSocket,
    change: { muted?: boolean; camera?: boolean; sharing?: boolean }
  ): void {
    const peer = this.huddle.get(ws)
    if (!peer) return
    if (typeof change.muted === 'boolean') peer.muted = change.muted
    if (typeof change.camera === 'boolean') peer.camera = change.camera
    if (typeof change.sharing === 'boolean') peer.sharing = change.sharing
    // Only one screen at a time, and the newest one wins, so nobody has to ask
    // the last person to stop before they can start.
    if (peer.sharing) {
      for (const other of this.huddle.values()) {
        if (other !== peer) other.sharing = false
      }
    }
    this.broadcastHuddle()
  }

  // Where the loop has got to by now. The clients are told a position rather
  // than a moment on this machine's clock, so nothing depends on two computers
  // agreeing what time it is.
  private musicRoom(): MusicRoom {
    const music = this.music
    if (!music) return emptyMusic()
    const run = music.playing ? (Date.now() - music.since) / 1000 : 0
    return {
      trackId: music.track.id,
      playing: music.playing,
      at: wrapAt(music.from + run, music.track.seconds),
      by: music.by,
      playlistId: music.playlistId,
      loop: music.loop
    }
  }

  private broadcastMusic(): void {
    this.broadcast({ type: 'music.room', room: this.musicRoom() })
  }

  // A track that is playing has an end, and the next one follows it. Only a
  // looping track is left to come round on its own, which is what the loop
  // control is for.
  private armMusic(): void {
    if (this.musicTimer) clearTimeout(this.musicTimer)
    this.musicTimer = null
    const music = this.music
    if (!music || !music.playing || music.loop || music.track.seconds <= 0) return
    const left = Math.max(0, music.track.seconds - music.from) * 1000
    this.musicTimer = setTimeout(() => this.playOn(), left)
    this.musicTimer.unref?.()
  }

  // Where Next goes when nobody pressed it. A list plays along its own order and
  // the shelf plays along the shelf, and both come round to the top again.
  private playOn(): void {
    const music = this.music
    if (!music) return
    const uploads = [...this.uploads.values()]
    const next = itemFor(trackAfter(music.track.id, 1, uploads, this.musicPlaylist(music.playlistId)), uploads)
    if (!next) {
      this.handleMusicOff()
      return
    }
    this.music = { ...music, track: next, from: 0, since: Date.now() }
    this.broadcastMusic()
    this.armMusic()
  }

  private musicPlaylist(playlistId: string | null): MusicPlaylist | null {
    return playlistFor(playlistId, this.playlistList())
  }

  private broadcastShelf(): void {
    this.broadcast({ type: 'music.shelf', uploads: [...this.uploads.values()] })
  }

  // A playlist is read back against what is really on the shelf, so a track
  // somebody took off is out of everyone's lists as well.
  private playlistList(): MusicPlaylist[] {
    const known = new Set(musicItems([...this.uploads.values()]).map(item => item.id))
    return [...this.playlists.values()].map(playlist => ({
      ...playlist,
      trackIds: playlist.trackIds.filter(id => known.has(id))
    }))
  }

  private broadcastPlaylists(): void {
    this.broadcast({ type: 'music.playlists', playlists: this.playlistList() })
  }

  private handlePlaylistAdd(member: Member, name: string, asked?: string): void {
    if (this.playlists.size >= MAX_PLAYLISTS || typeof name !== 'string') return
    const playlistId = isPlaylistId(asked) && !this.playlists.has(asked) ? asked : randomUUID()
    const clean = cleanPlaylistName(name)
    const by = member.name.slice(0, BY_LIMIT)
    const ts = Date.now()
    this.playlists.set(playlistId, { id: playlistId, name: clean, by, trackIds: [], ts })
    this.emit({ id: randomUUID(), ts, kind: 'playlist.added', playlistId, name: clean, byName: by })
    this.broadcastPlaylists()
  }

  // A list belongs to whoever wrote it. Everyone can play it, and nobody else
  // can write in it.
  private ownPlaylist(member: Member, playlistId: string): MusicPlaylist | null {
    const playlist = this.playlists.get(playlistId)
    if (!playlist || !isMine(playlist, member.name)) return null
    return playlist
  }

  private handlePlaylistRemove(member: Member, playlistId: string): void {
    if (!this.ownPlaylist(member, playlistId)) return
    this.playlists.delete(playlistId)
    if (this.music?.playlistId === playlistId) this.music.playlistId = null
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'playlist.removed', playlistId, byName: member.name })
    this.broadcastPlaylists()
  }

  private handlePlaylistRename(member: Member, playlistId: string, name: string): void {
    const playlist = this.ownPlaylist(member, playlistId)
    // A list that is already named keeps its name rather than being emptied into
    // Untitled, which is the one way a rename can lose something.
    if (!playlist || typeof name !== 'string' || !name.trim()) return
    const clean = cleanPlaylistName(name)
    if (clean === playlist.name) return
    playlist.name = clean
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'playlist.renamed',
      playlistId,
      name: clean,
      byName: member.name
    })
    this.broadcastPlaylists()
  }

  private handlePlaylistTrack(member: Member, playlistId: string, trackId: string, on: boolean): void {
    const playlist = this.ownPlaylist(member, playlistId)
    if (!playlist) return
    if (on && !itemFor(trackId, [...this.uploads.values()])) return
    if (on && playlist.trackIds.length >= MAX_PLAYLIST_TRACKS) return
    // A track already in a list stays where it is rather than jumping to the
    // end, and one that was never in it is nothing to take out.
    if (playlist.trackIds.includes(trackId) === (on === true)) return
    playlist.trackIds = on ? [...playlist.trackIds, trackId] : playlist.trackIds.filter(id => id !== trackId)
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'playlist.track',
      playlistId,
      trackId,
      on: on === true,
      byName: member.name
    })
    this.broadcastPlaylists()
  }

  // A round somebody played. Only a score that beats their own is written down:
  // the board holds their best, so anything under it is a game they played
  // rather than something the crew keeps.
  private handleGameScore(member: Member, gameId: string, score: number): void {
    const clean = cleanGameScore(gameId, score)
    if (clean === null) return
    const held = [...this.scores.values()]
    if (!beats(held, gameId, member.name, clean)) return
    const ts = Date.now()
    this.scores.set(scoreKey(gameId, member.name), { gameId, name: member.name, score: clean, ts })
    this.emit({ id: randomUUID(), ts, kind: 'game.score', gameId, score: clean, byName: member.name })
    this.broadcast({ type: 'game.scores', scores: [...this.scores.values()] })
  }

  // A track of the crew's own. The bytes are kept beside the session the way an
  // attachment is, and everyone plays their own copy of the file rather than
  // listening down the wire to whoever added it.
  private handleMusicAdd(member: Member, name: string, mime: string, seconds: number, data: string): void {
    const extension = audioExtension(mime)
    if (!extension || this.uploads.size >= MAX_UPLOADS) return
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_UPLOAD_SECONDS) return
    const bytes = Buffer.from(data ?? '', 'base64')
    if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return
    const trackId = randomUUID()
    const file = `${trackId}.${extension}`
    try {
      this.store.saveMusic(file, bytes)
    } catch {
      return
    }
    const upload: MusicUpload = {
      id: trackId,
      name: cleanUploadName(name ?? ''),
      file,
      seconds,
      by: member.name.slice(0, BY_LIMIT),
      ts: Date.now()
    }
    this.uploads.set(trackId, upload)
    this.emit({
      id: randomUUID(),
      ts: upload.ts,
      kind: 'music.added',
      trackId,
      name: upload.name,
      file,
      seconds,
      byName: upload.by
    })
    this.broadcastShelf()
  }

  // Taking a track off the shelf while it is playing stops it, or everyone is
  // left holding a position in something that is no longer there.
  private handleMusicRemove(member: Member, trackId: string): void {
    const upload = this.uploads.get(trackId)
    if (!upload) return
    this.uploads.delete(trackId)
    this.store.deleteMusic(upload.file)
    if (this.music?.track.id === trackId) this.handleMusicOff()
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'music.removed', trackId, byName: member.name })
    this.broadcastShelf()
    // It is out of everyone's lists as well, so they are said again rather than
    // left holding a row that plays nothing.
    this.broadcastPlaylists()
  }

  musicPath(file: string): string | null {
    return this.store.musicPath(file)
  }

  // Anyone can put something on, and anyone can take it off again. A track
  // nobody has heard of is nothing to play, so it is dropped rather than sent
  // on to everyone as a name their build cannot draw.
  private handleMusicSet(
    member: Member,
    trackId: string,
    playing: boolean,
    at: number,
    playlistId?: string | null
  ): void {
    const track = itemFor(trackId, [...this.uploads.values()])
    if (!track) return
    this.music = {
      track,
      playing: playing === true,
      from: wrapAt(typeof at === 'number' ? at : 0, track.seconds),
      since: Date.now(),
      by: member.name.slice(0, BY_LIMIT),
      // One of the app's own lists is in nobody's map, so it is asked for by
      // name rather than looked up, or Next would fall out of it after a track.
      playlistId:
        playlistId && (this.playlists.has(playlistId) || isMusicSet(playlistId)) ? playlistId : null,
      // Looping is a setting rather than something about the track, so it stays
      // where it was set across a skip and a pause.
      loop: this.music?.loop === true
    }
    this.broadcastMusic()
    this.armMusic()
  }

  private handleMusicLoop(loop: boolean): void {
    if (!this.music) return
    this.music.loop = loop === true
    this.broadcastMusic()
    this.armMusic()
  }

  private handleMusicOff(): void {
    if (this.musicTimer) clearTimeout(this.musicTimer)
    this.musicTimer = null
    if (!this.music) return
    this.music = null
    this.broadcastMusic()
  }

  private handleHuddleSignal(ws: WebSocket, to: string, signal: HuddleSignal): void {
    const from = this.huddle.get(ws)
    if (!from || typeof to !== 'string') return
    if (JSON.stringify(signal ?? null).length > MAX_SIGNAL_CHARS) return
    for (const [target, peer] of this.huddle) {
      if (peer.peerId !== to) continue
      this.send(target, { type: 'huddle.signal', from: from.peerId, signal })
      return
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
    const { docMentions, boardMentions } = this.refsOf(trimmed)
    for (const entry of found.thread.queue) {
      if (entry.messageId === found.entry.messageId) {
        entry.text = trimmed
        entry.docMentions = docMentions
        entry.boardMentions = boardMentions
      }
    }
    if (this.emittedMessages.has(found.entry.messageId)) {
      const message = this.events.find(e => e.kind === 'message' && e.id === found.entry.messageId)
      if (message && message.kind === 'message') {
        const ts = Date.now()
        message.text = trimmed
        message.docMentions = docMentions
        message.boardMentions = boardMentions
        message.editedTs = ts
        this.emit({
          id: randomUUID(),
          ts,
          kind: 'message.edited',
          messageId: message.id,
          text: trimmed,
          docMentions,
          boardMentions
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
    if (from === to || from === ROOT_PAGE || !this.docs.has(from)) return
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

  private handleUsage(meta: ConnMeta, id: string, usage: AgentUsage): void {
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
    this.toThread(ref.threadId, {
      type: 'agent.tokens',
      promptId,
      agentId: agent.id,
      threadId: ref.threadId,
      tokens: run.tokens
    })
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
      output: step.output ?? existing?.output,
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
      this.toThread(ref.threadId, { type: 'agent.step', promptId, agentId: agent.id, threadId: ref.threadId, step: merged })
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
    this.toThread(threadId, { type: 'agent.step', promptId, agentId: agent.id, threadId, step })
    const timer = setTimeout(() => {
      const entry = this.stepFlushes.get(key)
      this.stepFlushes.delete(key)
      const latest = agent.runs.get(promptId)?.steps.get(stepId)?.step
      if (!entry?.dirty || !latest || latest.status === 'done') return
      this.toThread(threadId, { type: 'agent.step', promptId, agentId: agent.id, threadId, step: latest })
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
          text: this.buildPrompt(agent, entry, this.assignedReactions(promptId)),
          settings: agent.settings,
          attachments: entry.attachments,
          designBoard: this.boardOf(this.threads.get(ref.threadId)),
          designBoards: this.referencedBoards(entry),
          ghost: this.ghostOf(ref.threadId) ? true : undefined
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
    route?: { messageId: string; mentions: string[]; replyTo?: MessageReply }
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
      ...this.refsOf(text),
      attachments,
      messageId: route?.messageId ?? randomUUID(),
      replyTo: route?.replyTo
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
        attachments,
        replyTo: entry.replyTo
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
    this.toThread(thread.id, { type: 'queue.state', threadId: thread.id, items: this.queueItems(thread) })
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
      attachments: steer.attachments,
      ghost: this.ghostOf(steer.threadId) ? true : undefined
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
      ...this.refsOf(steer.text),
      attachments: steer.attachments,
      messageId: steer.messageId,
      replyTo: steer.replyTo
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
      designBoard: this.boardOf(thread),
      designBoards: this.referencedBoards(next),
      ghost: this.ghostOf(thread.id) ? true : undefined
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
    if (thread && thread.mode === 'plan' && result.ok && result.text?.trim()) {
      thread.plan = result.text.trim()
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'thread.plan',
        threadId: thread.id,
        text: thread.plan,
        agentId: agent.id,
        agentLabel: agent.label
      })
    }
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

  private assignedReactions(promptId: string): ReactionEvent[] {
    const start = this.events.find(
      (event): event is Extract<SessionEvent, { kind: 'agent.start' }> =>
        event.kind === 'agent.start' && event.promptId === promptId
    )
    const ids = new Set(start?.reactionIds ?? [])
    return this.events.filter(
      (event): event is ReactionEvent => event.kind === 'message.reaction' && ids.has(event.id)
    )
  }

  private threadContext(threadId: string): Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>> {
    return this.eventsOf(threadId)
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'message' | 'agent.end' }> =>
          (e.kind === 'message' || e.kind === 'agent.end') && e.threadId === threadId
      )
      .slice(-CONTEXT_EVENT_LIMIT)
  }

  private buildPrompt(agent: AgentState, prompt: QueuedPrompt, reactions: ReactionEvent[]): string {
    const people = [...this.members.values()].map(m => m.name).join(', ')
    const context = this.threadContext(prompt.threadId)
    const transcript = context
      .map(e => {
        if (e.kind === 'message') {
          const images = (e.attachments ?? []).map(a => `[image: ${a.name}]`).join(' ')
          const reply = e.replyTo ? `, replying to ${e.replyTo.authorName}: ${JSON.stringify(e.replyTo.text)}` : ''
          return `${e.authorName}${reply}: ${[e.text, images].filter(Boolean).join(' ')}`
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
    const thread = this.threads.get(prompt.threadId)
    if (thread?.mode === 'plan') lines.push(``, PLAN_INSTRUCTIONS)
    else if (thread?.plan) lines.push(``, `The plan this thread agreed on:`, thread.plan)
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
        const text = this.reactionTarget(reaction.targetId, this.ghostOf(prompt.threadId)?.events ?? [])
          ?.text.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180)
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
        for (const ref of this.crewRefsIn(event.text ?? '')) {
          if (ref.kind === 'doc') add(ref.key)
        }
      }
    }
    for (const ref of prompt.docMentions) add(resolveDocRef(docs, ref))
    return pages
  }

  private referencedBoards(prompt: QueuedPrompt): DesignBoardMeta[] {
    const boards = this.boardList()
    const found: DesignBoardMeta[] = []
    const add = (id: string | null) => {
      const board = id ? boards.find(candidate => candidate.id === id) : undefined
      if (board && !found.some(seen => seen.id === board.id)) found.push(board)
    }
    for (const event of this.threadContext(prompt.threadId)) {
      if (event.kind === 'message' && event.boardMentions) {
        for (const ref of event.boardMentions) add(resolveBoardRef(boards, ref))
        continue
      }
      for (const ref of this.crewRefsIn(event.text ?? '')) {
        if (ref.kind === 'board') add(ref.key)
      }
    }
    for (const ref of prompt.boardMentions) add(resolveBoardRef(boards, ref))
    return found
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

  // Only the owner renames their own agent. Everyone sees the new name, and
  // the owner's machine is told so the local definition keeps up.
  private handleRename(member: Member, id: string, label: string): void {
    const agent = this.agents.get(id)
    if (!agent || agent.ownerId !== member.id) return
    const wanted = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT)
    if (!wanted || wanted === agent.label) return
    agent.label = this.uniqueLabel(wanted, id)
    for (const thread of this.threads.values()) {
      if (thread.agentId === id) thread.agentLabel = agent.label
    }
    const renamed: ServerMessage = { type: 'agent.renamed', agentId: id, label: agent.label }
    this.broadcast(renamed)
    if (agent.runner) this.send(agent.runner, renamed)
    this.persistMeta()
  }

  // Your own face, and nobody else's: the message carries no id, so the only
  // member it can reach is the one who sent it. Taking the photo off puts back
  // the initial, which comes from the name.
  private handleMemberAvatar(member: Member, image: OutgoingAttachment | null): void {
    if (image) {
      const saved = this.saveAttachment(image.mime, image.name, Buffer.from(image.data, 'base64'))
      if (!saved) return
      member.avatar = saved.file
    } else {
      if (!member.avatar) return
      delete member.avatar
    }
    this.broadcast({ type: 'member.avatar', memberId: member.id, file: member.avatar ?? null })
    this.persistMeta()
  }

  // Only the owner sets a photo on their own agent. Taking the photo off puts
  // back the generated icon, which comes from the agent id and never changes.
  private handleAvatar(member: Member, id: string, image: OutgoingAttachment | null): void {
    const agent = this.agents.get(id)
    if (!agent || agent.ownerId !== member.id) return
    if (image) {
      const saved = this.saveAttachment(image.mime, image.name, Buffer.from(image.data, 'base64'))
      if (!saved) return
      agent.avatar = saved.file
    } else {
      if (!agent.avatar) return
      delete agent.avatar
    }
    this.broadcast({ type: 'agent.avatar', agentId: id, file: agent.avatar ?? null })
    this.persistMeta()
  }

  // Anyone can remove any agent: the pool is shared, and a stale agent in it is
  // everyone's problem.
  private handleRemove(id: string): void {
    const agent = this.agents.get(id)
    if (agent) this.dropAgent(agent)
  }

  private registerAgent(ws: WebSocket, member: Member, llm: RegisteredLlm): void {
    const id = llm.id ?? agentId(member.name, llm.instanceId)
    if (this.removedAgents.has(id)) {
      this.send(ws, { type: 'agent.removed', agentId: id })
      return
    }
    const meta = this.meta.get(ws)
    const existing = this.agents.get(id)
    if (existing) {
      if (existing.runner && existing.ownerId !== member.id) return
      if (existing.dropTimer) {
        clearTimeout(existing.dropTimer)
        existing.dropTimer = null
      }
      existing.runner = ws
      existing.fields = llm.fields
      existing.steerable = llm.steerable === true
      existing.settings = resolveSettings(llm.fields, existing.settings)
      // The owner is whoever runs it now: the same person can come back under a
      // different name, and their agents come with them.
      const moved = existing.ownerId !== member.id
      existing.ownerId = member.id
      existing.ownerName = member.name
      meta?.agentIds.push(id)
      if (moved) this.broadcast({ type: 'agent.added', agent: this.pooled(existing) })
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'agent.online', agentId: id, label: existing.label })
      this.runThreadsOf(existing)
      if (moved) this.persistMeta()
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

  private deregisterAgent(id: string): void {
    const agent = this.agents.get(id)
    if (agent) this.dropAgent(agent)
  }

  private dropAgent(agent: AgentState): void {
    if (agent.dropTimer) {
      clearTimeout(agent.dropTimer)
      agent.dropTimer = null
    }
    this.clearQueues(agent, `${agent.label} was removed before getting to this.`)
    this.dropRunning(agent, `${agent.label} was removed.`)
    this.agents.delete(agent.id)
    this.removedAgents.add(agent.id)
    for (const meta of this.meta.values()) meta.agentIds = meta.agentIds.filter(a => a !== agent.id)
    const removed: ServerMessage = { type: 'agent.removed', agentId: agent.id }
    this.broadcast(removed)
    if (agent.runner) this.send(agent.runner, removed)
    this.persistMeta()
  }

  private uniqueLabel(base: string, exceptId?: string): string {
    const taken = new Set([...this.agents.values()].filter(a => a.id !== exceptId).map(a => a.label.toLowerCase()))
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

  // Work in a ghost thread does not count here. Busy is the one thing about a
  // run that reaches everyone, and an agent reading as busy with no thread
  // anywhere to point at says a hidden one is going.
  private statusOf(agent: AgentState): AgentStatus {
    if (!agent.runner) return 'offline'
    for (const promptId of agent.running) {
      if (!this.ghostOf(this.prompts.get(promptId)?.threadId)) return 'busy'
    }
    return 'idle'
  }

  private pooled(agent: AgentState): PooledAgent {
    const { runner, running, runs, dropTimer, ...rest } = agent
    const live: Record<string, LiveRun> = {}
    for (const [promptId, run] of runs) {
      // A run in a ghost thread is nobody's to catch up on, including the window
      // it belongs to: that window has been watching it since it started.
      if (this.ghostOf(this.prompts.get(promptId)?.threadId)) continue
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
    if (meta.role === 'ui') {
      this.handleHuddleLeave(ws)
      this.dropGhosts(ws)
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

  // A ghost thread is the window's, so it goes when the window does: whatever it
  // was running is stopped, and its transcript is dropped rather than left in
  // memory for the rest of the session.
  private dropGhosts(ws: WebSocket): void {
    for (const [file, held] of this.ghostFiles) {
      if (held.ws === ws) this.ghostFiles.delete(file)
    }
    for (const [threadId, ghost] of this.ghosts) {
      if (ghost.ws !== ws) continue
      ghost.events.length = 0
      const thread = this.threads.get(threadId)
      this.threads.delete(threadId)
      if (!thread) continue
      thread.queue = []
      if (thread.running) this.handleCancel(thread.running)
    }
  }

  private systemMessage(text: string, threadId?: string, to?: WebSocket): void {
    this.emit(
      {
        id: randomUUID(),
        ts: Date.now(),
        kind: 'message',
        authorId: SYSTEM_AUTHOR_ID,
        authorName: SYSTEM_AUTHOR_NAME,
        text,
        mentions: [],
        threadId
      },
      { to }
    )
  }

  // Everything a thread emits carries its id, so one question here is what
  // keeps a ghost thread off the log and off everyone else's screen: it is kept
  // in memory for the one window it belongs to, and the wire is never touched.
  private ghostOf(threadId: string | undefined): Ghost | undefined {
    return threadId ? this.ghosts.get(threadId) : undefined
  }

  private ghostEventOf(event: SessionEvent): Ghost | undefined {
    return this.ghostOf('threadId' in event ? event.threadId : undefined)
  }

  // The one window's copy of what a ghost thread has said, which is what an
  // agent's next turn in it is built from. Any other thread reads the session.
  private eventsOf(threadId: string): SessionEvent[] {
    return this.ghostOf(threadId)?.events ?? this.events
  }

  private ghostEventsFor(ws: WebSocket): SessionEvent[] {
    const seen: SessionEvent[] = []
    for (const ghost of this.ghosts.values()) {
      if (ghost.ws === ws) seen.push(...ghost.events)
    }
    return seen
  }

  private toThread(threadId: string, msg: ServerMessage): void {
    const ghost = this.ghostOf(threadId)
    if (ghost) {
      this.send(ghost.ws, msg)
      return
    }
    this.broadcast(msg)
  }

  // A thread somebody else opened as a ghost is not there to be written in,
  // however its id was come by.
  private hiddenFrom(ws: WebSocket, threadId: string): boolean {
    const ghost = this.ghostOf(threadId)
    return ghost !== undefined && ghost.ws !== ws
  }

  private emit(event: SessionEvent, opts: { persist?: boolean; to?: WebSocket } = {}): void {
    const ghost = this.ghostEventOf(event)
    if (ghost || opts.to) {
      ghost?.events.push(event)
      this.send(opts.to ?? ghost!.ws, { type: 'event', event })
      return
    }
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
      members: [...this.members.values()].map(m => ({ id: m.id, name: m.name, avatar: m.avatar })),
      agents: [...this.agents.values()].map(({ runner, running, runs, dropTimer, ...agent }) => agent),
      removedAgents: [...this.removedAgents]
    })
  }
}
