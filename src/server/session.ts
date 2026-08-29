import { randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import type { WebSocket } from 'ws'
import { CODE_BYTES } from '../shared/link'
import {
  attachmentBytes,
  cleanAttachmentMb,
  DEFAULT_ATTACHMENT_MB,
  extensionUsedFor,
  isImageType,
  MAX_ATTACHMENTS,
  mimeForFile,
  type Attachment,
  type OutgoingAttachment
} from '../shared/attachments'
import {
  fallbackTitle,
  pageCode,
  pageCodeOf,
  resolveDocRef,
  ROOT_PAGE,
  ROOT_TEXT,
  ROOT_TITLE,
  type DocMentionRef,
  type DocPage,
  type DocScope
} from '../shared/docs'
import { stripDocTableMarks } from '../shared/docTables'
import { boardMentionsOf, crewRefs, docMentionsOf, refsIn, type CrewRef } from '../shared/refs'
import {
  huddleRecordId,
  markDeletedReplies,
  olderEvents,
  trimEvents,
  SYSTEM_AUTHOR_ID,
  SYSTEM_AUTHOR_NAME,
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
import { TYPING_TTL, type Typist } from '../shared/typing'
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
import { ASIDE_INSTRUCTIONS } from '../shared/aside'
import {
  cleanMemoryLine,
  cleanMemoryLines,
  memoryKey,
  MEMORY_FULL,
  MEMORY_LIMIT,
  shortId,
  type CrewMemory
} from '../shared/memory'
import {
  cleanPlugin,
  currentPluginInstallation,
  pluginKey,
  PLUGIN_FULL,
  PLUGIN_LIMIT,
  type CrewPlugin
} from '../shared/plugins'
import { cleanCommands, type CommandName } from '../shared/commands'
import { goalCondition } from '../shared/goal'
import { IMPLEMENT_PROMPT, PLAN_INSTRUCTIONS } from '../shared/plan'
import { POST_INSTRUCTIONS } from '../shared/post'
import {
  ASK_LIMIT,
  ASSUMED_LIMIT,
  cleanColumn,
  cleanOptions,
  cleanTitles,
  isTicketEvent,
  LIST_LIMIT,
  NOTE_LIMIT,
  ticketLine,
  TITLE_LIMIT as TICKET_TITLE_LIMIT,
  type TicketEvent
} from '../shared/tickets'
import { pageName } from '../shared/urls'
import { PAGE_LIMIT, pagesNamed, pageTitle } from '../shared/showPage'
import { RESHAPES_THREADS } from '../shared/places'
import { activeThreads, eventsOfThread, type LiveThread } from '../shared/threads'
import { VOICE_INSTRUCTIONS } from '../shared/voice'
import {
  agentId,
  agentMentionRefsIn,
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
import { cleanMemberName, memberMentionRefsIn } from '../shared/people'
import {
  cleanSchedule,
  due,
  nextRun,
  schedulable,
  SCHEDULE_FULL,
  SCHEDULE_LIMIT,
  type Schedule
} from '../shared/schedules'
import { cleanTool, PROMPT_LIMIT, STEP_LIMIT, type CrewTool, type ToolAction } from '../shared/toolbox'
import {
  cleanHelperName,
  cleanPrefs,
  DEFAULT_PREFS,
  DEPTH_LIMIT,
  FAN_LIMIT,
  RETURN_COALESCE_MS,
  returnText,
  RUN_LIMIT,
  SUBAGENT_INSTRUCTIONS,
  SUBJECT_LIMIT,
  TASK_LIMIT,
  WAIT_MS,
  WAKE_LIMIT,
  type HelperPrefs,
  type SubagentReturn
} from '../shared/subagents'
import {
  agentEndReactionTarget,
  agentStepReactionTarget,
  isReactionEmoji,
  messageReactionTarget
} from '../shared/reactions'
import {
  cleanCustomEmojiName,
  customEmojiExtension,
  customEmojiNameIn,
  customEmojiNameTaken,
  CUSTOM_EMOJI_MAX_BYTES,
  MAX_CUSTOM_EMOJI,
  type CustomEmoji
} from '../shared/customEmoji'
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
  // What this person lets helpers do on their machine. It rides in memory the
  // way a call does: their window says it on every connect, so there is nothing
  // here to write down or read back.
  helpers?: HelperPrefs
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
  cost: number | null
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
  voice?: boolean
  goal?: boolean
  // The plugin this one message was sent with, if the crew still holds it.
  plugin?: string
  // A helper coming back is not something anybody said, so it opens a turn
  // without writing a message into the thread for people to scroll past. The
  // chip is the record, and the chip opens onto the whole thing.
  silent?: boolean
  // Whether this message has already been handed to a fallback once. One hop and
  // no more, or a pair of agents naming each other burns an afternoon.
  fellBack?: boolean
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
  silent?: boolean
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
  // Who takes over when a run here ends badly. Nothing reads it until one does,
  // so naming somebody changes nothing about how this thread queues or steers.
  fallbackId?: string
  boardId?: string
  ghost?: boolean
  voice?: boolean
  // Whether the work in this thread is reported onto a board beside it.
  tickets?: boolean
  // The thread a question on the side was asked from. It is read for context and
  // nothing is ever said back into it, so the work in it carries on untouched.
  aside?: string
  // The thread this one carried on from, and the moment it was carried. The talk
  // before that moment is read for context and the thread it came from is left
  // exactly as it was, so several forks off one good place all start there.
  forkedFrom?: string
  forkedAt?: number
  // A thread another one sent out. It reads inside its parent rather than as a
  // card of its own, and it answers back into whatever the parent is doing.
  parentThreadId?: string
  parentPromptId?: string
  // The name the agent that sent it out made it up under, and what it is doing.
  helper?: string
  subject?: string
  depth?: number
  // A model the parent asked for, over whatever the agent running it is set to.
  helperSettings?: AgentSettings
  // Whether finishing wakes the parent. Off is send-and-forget.
  notify?: boolean
  startedAt?: number
}

// A helper that has come back and not yet been handed over, held for a breath
// so a run of them arriving together is one interruption rather than three.
interface PendingReturn {
  timer: NodeJS.Timeout
  parentThreadId: string
  agentId: string
  items: Array<SubagentReturn & { endedId: string; promptId: string; threadId: string }>
}

// A parent parked on a wait, and what it is waiting for.
interface PendingWait {
  threadIds: string[]
  timer: NodeJS.Timeout
  settle: () => void
}

// A thread only the window that opened it can see: the socket it belongs to,
// and the transcript it is read back from. Nothing here is ever written to the
// log or handed to anybody else.
interface Ghost {
  ws: WebSocket | null
  events: SessionEvent[]
  post?: boolean
}

interface DesignBoard {
  id: string
  name: string
  document: DesignDocument | null
  presence: Map<string, DesignPresence>
  saveTimer: NodeJS.Timeout | null
}

const THREAD_STATUSES = new Set<ThreadStatus>(['open', 'done', 'archived'])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
type TicketAdded = Extract<SessionEvent, { kind: 'ticket.added' }>

// What every route over the session's own http is refused with when the run it
// names is not one going here. Only a model reads it, so it is a sentence.
const NOT_RUNNING = 'That promptId is not a run this session has going.'

const GHOST_MEMORY = 'This thread is hidden, so nothing in it can go in the crew memory.'
const MEMORY_OFF = 'Crew memory is turned off.'

// A call over http either happened or is refused in words, and nothing about
// one is worth a code.
type Done = { ok: true } | { error: string }

const SNAPSHOT_EVENT_LIMIT = 500

// A board is a handful of lines per thread, so this is a backstop against a
// session that has run for months rather than a size anyone should reach.
const TICKET_HISTORY_LIMIT = 600
const HISTORY_PAGE = 200

// How much of one thread is handed back at once. A thread runs to a handful of
// messages and the runs between them, so this is the backstop against one that
// has been worked in all year rather than a length anybody reaches.
const THREAD_HISTORY_LIMIT = 500
const CONTEXT_EVENT_LIMIT = 20

// How far back down a line of forks one is read. A fork always points at a
// thread older than itself so the walk ends on its own, and this is the backstop
// against a session that has been forked all afternoon.
const FORK_DEPTH_LIMIT = 20
const MAX_DOC_PROMPT_CHARS = 8000
const UNFINISHED_PROGRESS_LIMIT = 6000
const UNFINISHED_OUTPUT_LIMIT = 2000
const TITLE_LIMIT = 80
const LABEL_LIMIT = 40
const CANCEL_REPORT_TIMEOUT_MS = 15000
const RESUME_GRACE_MS = 60000
const STEP_FLUSH_MS = 80
const DESIGN_SAVE_MS = 500

const CLOCK_MAX_MS = 10 * 60 * 1000
const DESIGN_CURSOR_STEP_MS = 140
const DESIGN_CURSOR_STEPS_MAX = 25

// The chat's own events. A board is folded off the thread it belongs to rather
// than scrolled past here, so what an agent said about its own work is left out
// of what a window is handed, the way a high score and a track on the shelf are.
const chatEvents = (events: SessionEvent[]): SessionEvent[] => events.filter(event => !isTicketEvent(event.kind))

const THREAD_EVENT_KINDS = new Set<SessionEvent['kind']>([
  'thread.started',
  'thread.plan',
  'thread.implement',
  'thread.archived',
  'thread.agent',
  'thread.status',
  'thread.renamed',
  'thread.deleted',
  'message.route'
])

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
  private memories = new Map<string, CrewMemory>()
  private plugins = new Map<string, CrewPlugin>()
  private schedules = new Map<string, Schedule>()
  private clock: ReturnType<typeof setTimeout> | null = null
  // How big a file may be, in megabytes. The crew's own, folded off the log the
  // way the toolbox is.
  private attachmentMb = DEFAULT_ATTACHMENT_MB
  // What a helper said, held from the moment it finished until whatever the
  // parent is doing can take it.
  private returns = new Map<string, PendingReturn>()
  private waits = new Set<PendingWait>()
  // How many times each parent thread has been woken by a helper coming back,
  // and how many it has sent out in its life.
  private wakes = new Map<string, number>()
  private events: SessionEvent[] = []
  private docs = new Map<string, DocPage>()
  private ghostDocOwners = new Map<string, WebSocket>()
  private designs = new Map<string, DesignBoard>()
  private designCursorTimers = new Map<string, NodeJS.Timeout[]>()
  // Who is writing right now, keyed by the connection writing it, so two windows
  // on one folder are two people at two keyboards. None of it is written down.
  private typing = new Map<WebSocket, Typist & { at: number }>()
  private typingSweep: NodeJS.Timeout | null = null
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
  // The emoji the crew drew themselves, written down the way the shelf is: one
  // somebody added is still theirs tomorrow.
  private emoji = new Map<string, CustomEmoji>()
  private memoryEnabled = false
  private docTitles = new Map<string, string>()
  private docRenames = new Map<string, { to: string; ts: number }>()
  private meta = new Map<WebSocket, ConnMeta>()
  private removedAgents = new Set<string>()
  private prompts = new Map<string, PromptRef>()
  private stopping = new Set<string>()
  private steers = new Map<string, PendingSteer[]>()
  private emittedMessages = new Set<string>()
  private cancelTimeoutMs: number
  private resumeGraceMs: number
  private stepFlushMs: number
  private stepFlushes = new Map<string, { timer: NodeJS.Timeout; dirty: boolean }>()
  onSyncNeeded: (() => void) | null = null
  onEvent: ((event: SessionEvent) => void) | null = null

  constructor(
    private store: Store,
    opts: { cancelTimeoutMs?: number; resumeGraceMs?: number; stepFlushMs?: number } = {}
  ) {
    this.cancelTimeoutMs = opts.cancelTimeoutMs ?? CANCEL_REPORT_TIMEOUT_MS
    this.resumeGraceMs = opts.resumeGraceMs ?? RESUME_GRACE_MS
    this.stepFlushMs = opts.stepFlushMs ?? STEP_FLUSH_MS
    const persisted = store.loadSession()
    this.code = persisted?.code ?? randomBytes(CODE_BYTES).toString('hex')
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
    const deletedThreads = new Set(loaded.filter(e => e.kind === 'thread.deleted').map(e => e.threadId))
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
            !('threadId' in e && typeof e.threadId === 'string' && deletedThreads.has(e.threadId) && e.kind !== 'thread.deleted') &&
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
          boardId: event.boardId,
          voice: event.voice,
          tickets: event.tickets,
          parentThreadId: event.parentThreadId,
          parentPromptId: event.parentPromptId,
          helper: event.helper,
          subject: event.subject,
          depth: event.depth,
          notify: event.notify,
          startedAt: event.ts
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
      if (event.kind === 'thread.renamed') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.title = event.title
      }
      if (event.kind === 'thread.deleted') this.threads.delete(event.threadId)
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
      if (event.kind === 'memory.added') {
        this.memories.set(event.memoryId, {
          id: event.memoryId,
          text: event.text,
          by: event.byName,
          byAgentId: event.agentId,
          ts: event.ts
        })
      }
      if (event.kind === 'memory.edited') {
        const memory = this.memories.get(event.memoryId)
        if (memory) {
          memory.text = event.text
          memory.by = event.byName
          memory.byAgentId = event.agentId
        }
      }
      if (event.kind === 'memory.removed') {
        this.memories.delete(event.memoryId)
      }
      if (event.kind === 'memory.setting') {
        this.memoryEnabled = event.enabled
      }
      if (event.kind === 'plugin.added') {
        if (!currentPluginInstallation(event.plugin)) continue
        this.plugins.set(event.pluginId, {
          id: event.pluginId,
          ...event.plugin,
          by: event.byName,
          byAgentId: event.agentId,
          ts: event.ts
        })
      }
      if (event.kind === 'plugin.removed') {
        this.plugins.delete(event.pluginId)
      }
      if (event.kind === 'schedule.added') {
        this.schedules.set(event.scheduleId, {
          id: event.scheduleId,
          name: event.name,
          mark: event.mark,
          when: event.when,
          action: event.action,
          zone: event.zone,
          createdBy: event.byName,
          ts: event.ts
        })
      }
      if (event.kind === 'schedule.edited') {
        const held = this.schedules.get(event.scheduleId)
        if (held)
          this.schedules.set(event.scheduleId, {
            ...held,
            name: event.name,
            mark: event.mark,
            when: event.when,
            action: event.action,
            zone: event.zone
          })
      }
      if (event.kind === 'schedule.removed') {
        this.schedules.delete(event.scheduleId)
      }
      if (event.kind === 'schedule.paused') {
        const held = this.schedules.get(event.scheduleId)
        if (held) this.schedules.set(event.scheduleId, { ...held, paused: event.paused })
      }
      if (event.kind === 'schedule.ran') {
        const held = this.schedules.get(event.scheduleId)
        if (held)
          this.schedules.set(event.scheduleId, {
            ...held,
            lastRunAt: event.ts,
            lastThreadId: event.threadId ?? held.lastThreadId
          })
      }
      if (event.kind === 'attachment.limit') {
        this.attachmentMb = cleanAttachmentMb(event.mb) ?? this.attachmentMb
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
      // An emoji whose picture has gone is left out rather than handed over as a
      // name that draws nothing, the same rule the shelf holds.
      if (event.kind === 'emoji.added' && this.store.customEmojiPath(event.file)) {
        this.emoji.set(event.emojiId, {
          id: event.emojiId,
          name: event.name,
          file: event.file,
          by: event.byName,
          ts: event.ts
        })
      }
      if (event.kind === 'emoji.renamed') {
        const emoji = this.emoji.get(event.emojiId)
        if (emoji) emoji.name = event.name
      }
      if (event.kind === 'emoji.removed') {
        this.emoji.delete(event.emojiId)
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
      if (event.kind === 'thread.fallback') {
        const thread = this.threads.get(event.threadId)
        if (thread) thread.fallbackId = event.agentId
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
      const thread = event.threadId ? this.threads.get(event.threadId) : undefined
      if (thread?.parentThreadId) {
        const returned = this.events.some(
          one => one.kind === 'subagent.ended' && one.threadId === thread.id && one.promptId === event.promptId
        )
        if (!returned) {
          const home: SessionEvent = {
            id: randomUUID(),
            ts: close.ts,
            kind: 'subagent.ended',
            threadId: thread.id,
            parentThreadId: thread.parentThreadId,
            promptId: event.promptId,
            ok: false,
            ms: Math.max(0, close.ts - event.ts)
          }
          this.events.push(home)
          store.appendEvent(home)
        }
      }
    }
    const delivered = new Set(
      this.events.filter(event => event.kind === 'subagent.returned').map(event => event.endedId)
    )
    for (const event of this.events) {
      if (event.kind !== 'subagent.ended' || !event.promptId || event.stopped || delivered.has(event.id)) continue
      const thread = this.threads.get(event.threadId)
      if (!thread || thread.notify === false) continue
      const end = this.events.find(
        one => one.kind === 'agent.end' && one.promptId === event.promptId && one.threadId === event.threadId
      )
      if (!end || end.kind !== 'agent.end') continue
      this.holdSubagentReturn(thread, event, end.text ?? end.error ?? '')
    }
    for (const [page, doc] of Object.entries(store.loadDocs())) this.docs.set(page, doc)
    for (const [page, doc] of Object.entries(store.loadPrivateDocs())) this.docs.set(page, doc)
    if (!this.docs.has(ROOT_PAGE)) {
      const welcome: DocPage = { title: ROOT_TITLE, text: ROOT_TEXT }
      this.docs.set(ROOT_PAGE, welcome)
      try {
        store.saveDoc(ROOT_PAGE, welcome)
      } catch {}
    }
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
    this.armClock()
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

  // What every board is folded from. It is left out of the events a window is
  // handed and carried here instead, so a board survives a reload the way the
  // shelf and the todos do rather than emptying every time somebody comes back.
  // A ghost's are never in here, because they were never written to the log.
  private ticketHistory(): TicketEvent[] {
    const said = this.events.filter((event): event is TicketEvent => isTicketEvent(event.kind))
    return said.length > TICKET_HISTORY_LIMIT ? said.slice(said.length - TICKET_HISTORY_LIMIT) : said
  }

  snapshot(ws?: WebSocket): SessionSnapshot {
    const recent = olderEvents(this.events, undefined, SNAPSHOT_EVENT_LIMIT)
    return {
      code: this.code,
      members: [...this.members.values()].map(m => ({
        id: m.id,
        name: m.name,
        connected: m.connections.size > 0,
        avatar: m.avatar
      })),
      agents: [...this.agents.values()].map(agent => this.pooled(agent)),
      events: chatEvents(recent.events),
      threadEvents: this.events.filter(event => THREAD_EVENT_KINDS.has(event.kind)),
      threadPrompts: Object.fromEntries(
        [...this.threads.values()].flatMap(thread =>
          thread.running && !thread.ghost ? [[thread.id, thread.running]] : []
        )
      ),
      moreEvents: recent.more,
      tickets: this.ticketHistory(),
      docs: this.visibleDocs(ws),
      queues: Object.fromEntries(
        [...this.threads.values()]
          .filter(thread => thread.queue.length > 0 && !thread.ghost)
          .map(thread => [thread.id, this.queueItems(thread)])
      ),
      todos: [...this.todos.values()],
      tools: [...this.tools.values()],
      memories: [...this.memories.values()],
      memoryEnabled: this.memoryEnabled,
      plugins: [...this.plugins.values()],
      schedules: [...this.schedules.values()],
      attachmentMb: this.attachmentMb,
      boards: this.boardList(),
      huddle: this.huddleRoom(),
      music: this.musicRoom(),
      musicUploads: [...this.uploads.values()],
      musicPlaylists: this.playlistList(),
      gameScores: [...this.scores.values()],
      emoji: [...this.emoji.values()]
    }
  }

  private handleHello(ws: WebSocket, msg: Extract<ClientMessage, { type: 'hello' }>): void {
    const member = this.memberFor(msg.name)
    const wasOffline = member.connections.size === 0
    member.connections.add(ws)
    this.meta.set(ws, { role: msg.role, memberKey: member.name.toLowerCase(), agentIds: [] })
    this.send(ws, { type: 'welcome', selfId: member.id, snapshot: this.snapshot(ws) })
    // Typing is too short lived to ride in the snapshot and too quiet to reach a
    // window on its own: a ping only broadcasts when it changes something, so a
    // window that arrives mid-sentence is told once and hears the rest.
    if (msg.role === 'ui' && this.typing.size > 0) this.send(ws, { type: 'typing.room', typists: this.typists() })
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
          this.stopTyping(ws)
          this.handleChat(
            ws,
            member,
            msg.text,
            msg.mentions,
            msg.threadId,
            msg.attachments,
            msg.boardId,
            msg.replyTo,
            msg.commands,
            msg.forkId,
            msg.usePlugin,
            msg.startId
          )
        }
        break
      case 'history':
        if (meta.role === 'ui') this.sendHistory(ws, msg.before)
        break
      case 'thread.history':
        if (meta.role === 'ui') this.sendThreadHistory(ws, msg.threadId)
        break
      case 'typing':
        if (meta.role === 'ui') this.handleTyping(ws, member, msg.where, msg.on)
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
      case 'thread.rename':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) {
          this.handleThreadRename(member, msg.threadId, msg.title)
        }
        break
      case 'thread.delete':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) {
          this.handleThreadDelete(ws, member, msg.threadId)
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
      case 'memory.add':
        if (meta.role === 'ui') this.handleMemoryAdd(member, msg.text)
        break
      case 'memory.edit':
        if (meta.role === 'ui') this.handleMemoryEdit(member, msg.memoryId, msg.text)
        break
      case 'memory.remove':
        if (meta.role === 'ui') this.handleMemoryRemove(member, msg.memoryId)
        break
      case 'memory.set':
        if (meta.role === 'ui') this.handleMemorySetting(member, msg.enabled)
        break
      case 'plugin.add':
        if (meta.role === 'ui') this.handlePluginAdd(ws, member, msg.plugin, msg.requestId)
        break
      case 'plugin.remove':
        if (meta.role === 'ui') this.handlePluginRemove(member, msg.pluginId)
        break
      case 'schedule.add':
        if (meta.role === 'ui') this.handleScheduleAdd(ws, member, msg.name, msg.mark, msg.when, msg.action, msg.zone)
        break
      case 'schedule.edit':
        if (meta.role === 'ui')
          this.handleScheduleEdit(member, msg.scheduleId, msg.name, msg.mark, msg.when, msg.action, msg.zone)
        break
      case 'schedule.remove':
        if (meta.role === 'ui') this.handleScheduleRemove(member, msg.scheduleId)
        break
      case 'schedule.pause':
        if (meta.role === 'ui') this.handleSchedulePause(member, msg.scheduleId, msg.paused)
        break
      case 'schedule.run':
        if (meta.role === 'ui') this.runSchedule(msg.scheduleId, member.name, false)
        break
      case 'chat.post':
        if (meta.role === 'ui') this.handleChatPost(ws, member, msg.text, msg.agentId)
        break
      case 'attachment.limit':
        if (meta.role === 'ui') this.handleAttachmentLimit(member, msg.mb)
        break
      case 'subagent.stop':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId)) this.stopSubagent(msg.threadId)
        break
      case 'subagent.restart':
        if (meta.role === 'ui' && !this.hiddenFrom(ws, msg.threadId) && !this.restartSubagent(msg.threadId))
          this.refuse('That helper cannot be run again.', ws, msg.threadId)
        break
      case 'subagent.prefs':
        if (meta.role === 'ui') member.helpers = cleanPrefs(msg)
        break
      case 'doc.update':
        if (meta.role === 'ui') this.handleDoc(ws, member, msg.page, msg.text, msg.title, msg.scope)
        break
      case 'doc.retitle':
        if (meta.role === 'ui') this.handleDocRetitle(ws, member, msg.page, msg.title)
        break
      case 'doc.title':
        if (meta.role === 'ui') this.handleDocTitle(ws, member, msg.page, msg.title)
        break
      case 'doc.rename':
        if (meta.role === 'ui') this.handleDocRename(ws, member, msg.from, msg.to, msg.title)
        break
      case 'doc.delete':
        if (meta.role === 'ui') this.handleDocDelete(ws, member, msg.page)
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
      case 'emoji.add':
        if (meta.role === 'ui') this.handleEmojiAdd(ws, member, msg.name, msg.mime, msg.data)
        break
      case 'emoji.rename':
        if (meta.role === 'ui') this.handleEmojiRename(ws, member, msg.emojiId, msg.name)
        break
      case 'emoji.remove':
        if (meta.role === 'ui') this.handleEmojiRemove(member, msg.emojiId)
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
      case 'queue.send':
        if (meta.role === 'ui') this.handleQueueSend(member, msg.promptId)
        break
      case 'queue.take':
        if (meta.role === 'ui') this.handleQueueTake(ws, member, msg.promptId)
        break
      case 'queue.move':
        if (meta.role === 'ui') this.handleQueueMove(member, msg.promptId, msg.to)
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
      case 'member.rename':
        if (meta.role === 'ui') this.handleMemberRename(member, msg.name)
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
        this.handleTokens(meta, msg.promptId, msg.tokens, msg.cost)
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
    replyTargetId?: string,
    asked?: CommandName[],
    forkId?: string,
    usePlugin?: string,
    startId?: string
  ): void {
    // A command rides beside the message rather than in it, so nothing is ever
    // cut out of what somebody wrote. The chat's commands open a thread, so
    // inside one they are ignored, and a thread's are read only there. Talking
    // is the exception: it says how this one message arrived, which is still
    // true of a message sent into a thread.
    const asking = cleanCommands(asked)
    const commands = threadId ? [] : asking
    const planning = commands.includes('plan')
    const ghosting = commands.includes('ghost')
    const talking = asking.includes('voice')
    const reporting = commands.includes('tickets')
    const goal = asking.includes('goal')
    const holding = threadId ? asking.includes('queue') : false
    const beside = threadId ? asking.includes('btw') : false
    const forking = threadId ? asking.includes('fork') : false
    const naming = threadId ? asking.includes('fallback') : false
    const trimmed = text.trim()
    // A plugin picked on the composer only means anything while the crew still
    // holds it, so it is looked up here rather than taken at its word: a name
    // nothing answers to is nothing, the way naming an agent who is not here is.
    const wanted = usePlugin ? pluginKey(usePlugin) : ''
    const plugin = wanted
      ? ([...this.plugins.values()].find(held => pluginKey(held.name) === wanted)?.name ?? undefined)
      : undefined
    // A question on the side opens a ghost of its own, so a picture sent with
    // one is held for the window the way any ghost's is, whatever the thread it
    // was asked from does with its own.
    const hidden = threadId ? beside || this.ghostOf(threadId) !== undefined : ghosting
    const attachments = this.saveAttachments(incoming, hidden ? ws : undefined)
    // Taking a fallback off is an empty box with the chip on it, so that one send
    // is the exception to nothing typed being nothing sent.
    if (!trimmed && attachments.length === 0 && !naming) return
    const replyTo = this.replyReference(ws, replyTargetId)
    if (threadId) {
      const thread = this.threads.get(threadId)
      if (!thread || this.hiddenFrom(ws, threadId)) return
      if (naming) {
        this.setFallback(ws, member, thread, mentions, hidden)
        return
      }
      if (beside) {
        this.startAside(ws, member, thread, mentions, trimmed, attachments, plugin)
        return
      }
      if (forking) {
        this.startFork(ws, member, thread, mentions, trimmed, attachments, forkId, plugin)
        return
      }
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
        this.enqueuePrompt(agent, member, trimmed, threadId, attachments, {
          messageId,
          mentions: targets,
          replyTo,
          voice: talking,
          holding: holding || goal,
          goal,
          plugin
        })
      }
      return
    }
    const named = [...new Set(mentions)].filter(id => this.agents.has(id))
    const ids = ghosting ? named.filter(id => this.ownAgent(member, id)) : named
    const mode: ThreadMode = planning ? 'plan' : 'build'
    const ghost = ghosting ? ws : undefined
    if (ids.length === 0) {
      // The one asking is the only one who knows a ghost thread was meant, so
      // saying why it did not open goes to them and nowhere else. An agent was
      // named here, so nobody else stands in for it.
      if (ghosting && named.length > 0) {
        this.refuse("That agent runs on somebody else's machine. Mention one of your own.", ws, boardId)
        return
      }
      // A command needs someone to take it. With one agent here that is not a
      // question worth asking, and a ghost thread only ever goes to an agent of
      // your own, so one of yours takes it rather than being asked for.
      // Talking names nobody: the mic was pressed on an agent already picked,
      // so whoever is here takes it. Anybody's, unlike a ghost thread, because
      // a spoken thread is the crew's the way a typed one is.
      const taker = ghosting
        ? (this.agentsHere(member.id)[0] ?? null)
        : talking
          ? (this.agentsHere()[0] ?? null)
          : planning || goal
            ? this.soloAgent()
            : null
      if (taker) {
        this.startThread(member, taker, trimmed, attachments, {
          boardId,
          mode,
          ghost,
          replyTo,
          voice: talking,
          tickets: reporting,
          goal,
          plugin,
          threadId: startId
        })
        return
      }
      if (talking) {
        this.systemMessage('No agent is here to talk to.', undefined, ws)
        return
      }
      if (ghosting) {
        this.refuse('No agent of yours is here to take it.', ws, boardId)
        return
      }
      if (planning) {
        this.refuse('Mention an agent with @ to say who should write the plan.', ws, boardId)
        return
      }
      if (goal) {
        this.refuse('Mention an agent with @ to say who should take this.', ws, boardId)
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
        ...this.refsOf(trimmed, hidden ? ws : undefined),
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
        replyTo,
        voice: talking,
        tickets: reporting,
        goal,
        plugin,
        threadId: startId
      })
    }
  }

  private handleChatPost(ws: WebSocket, member: Member, text: string, agentId?: string): void {
    const trimmed = text?.trim().slice(0, PROMPT_LIMIT)
    if (!trimmed) return
    if (!this.startPost(member, trimmed, agentId)) this.refuse('No agent is here to write it.', ws)
  }

  private agentToTake(agentId?: string): AgentState | null {
    const named = this.agents.get(agentId ?? '')
    if (named?.runner) return named
    return [...this.agents.values()].find(one => one.runner !== null) ?? null
  }

  private startPost(member: Member, text: string, agentId?: string): boolean {
    const taking = this.agentToTake(agentId)
    if (!taking) return false
    this.startThread(member, taking, text, [], { post: true })
    return true
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

  // Who takes over when a run here ends badly. They are named by mentioning
  // them, which is the one way the app already names an agent in a composer, and
  // naming nobody takes it off. Nothing is emitted into the thread as a message,
  // because an arrangement is not something somebody said.
  private setFallback(ws: WebSocket, member: Member, thread: Thread, mentions: string[], hidden: boolean): void {
    const named = [...new Set(mentions)].filter(id => this.agents.has(id))
    const id = named[0]
    if (!id) {
      if (mentions.length > 0) {
        this.refuse('Mention an agent with @ to say who takes over.', ws, thread.id)
        return
      }
      if (thread.fallbackId === undefined) return
      thread.fallbackId = undefined
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'thread.fallback',
        threadId: thread.id,
        byName: member.name
      })
      return
    }
    // A hidden thread only ever goes to an agent of your own, so the one that
    // would take it over is held to the same rule as the one on it now.
    if (hidden && !this.ownAgent(member, id)) {
      this.refuse("That agent runs on somebody else's machine. Mention one of your own.", ws, thread.id)
      return
    }
    if (id === thread.agentId) {
      this.refuse('This thread is already on them. Mention somebody else to take over.', ws, thread.id)
      return
    }
    const agent = this.agents.get(id)!
    thread.fallbackId = id
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'thread.fallback',
      threadId: thread.id,
      agentId: id,
      agentLabel: agent.label,
      byName: member.name
    })
  }

  // A hand-off nobody made carries no name. That is the fallback taking a thread
  // over after a run fell over, and the transcript draws it as its own line
  // rather than as somebody handing the thread on.
  private switchThreadAgent(thread: Thread, id: string, member?: Member): void {
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
      byName: member?.name
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
      hidden?: boolean
      post?: boolean
      mentions?: string[]
      replyTo?: MessageReply
      voice?: boolean
      tickets?: boolean
      goal?: boolean
      aside?: string
      plan?: string
      threadId?: string
      plugin?: string
      fork?: { from: string; at: number }
      subagent?: {
        parentThreadId: string
        parentPromptId: string
        name: string
        subject: string
        depth: number
        settings?: AgentSettings
        notify: boolean
      }
    } = {}
  ): string {
    // Whoever asks for a fork names the id it opens under, so a junk one or one
    // something else already answers to is named here instead.
    const asked = opts.threadId
    const threadId = asked && UUID.test(asked) && !this.threads.has(asked) ? asked : randomUUID()
    const boardId = opts.boardId
    const sent = opts.subagent
    const helperModel = sent
      ? sent.settings?.model ?? agent.settings.model ?? agent.fields.find(field => field.key === 'model')?.default
      : undefined
    const thread: Thread = {
      id: threadId,
      agentId: agent.id,
      agentLabel: agent.label,
      title: sent ? sent.subject : this.titleFrom(text || attachments.map(a => a.name).join(', ')),
      createdBy: member.name,
      status: 'open',
      mode: opts.mode ?? 'build',
      plan: opts.plan,
      queue: [],
      running: null,
      boardId: boardId && this.designs.has(boardId) ? boardId : undefined,
      ghost: opts.ghost !== undefined || opts.hidden === true || opts.post === true,
      voice: opts.voice === true,
      tickets: opts.tickets === true,
      aside: opts.aside,
      forkedFrom: opts.fork?.from,
      forkedAt: opts.fork?.at,
      parentThreadId: sent?.parentThreadId,
      parentPromptId: sent?.parentPromptId,
      helper: sent?.name,
      subject: sent?.subject,
      depth: sent?.depth,
      helperSettings: sent?.settings,
      notify: sent?.notify,
      startedAt: Date.now()
    }
    this.threads.set(threadId, thread)
    // Before the first word of it is emitted, or that word goes to everyone.
    if (opts.ghost || opts.hidden || opts.post)
      this.ghosts.set(threadId, { ws: opts.ghost ?? null, events: [], post: opts.post })
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
      ghost: thread.ghost ? true : undefined,
      voice: thread.voice ? true : undefined,
      tickets: thread.tickets ? true : undefined,
      aside: thread.aside,
      forkedFrom: thread.forkedFrom,
      forkedAt: thread.forkedAt,
      parentThreadId: sent?.parentThreadId,
      parentPromptId: sent?.parentPromptId,
      helper: sent?.name,
      subject: sent?.subject,
      depth: sent?.depth,
      helperModel,
      notify: sent?.notify
    })
    this.enqueuePrompt(agent, member, text, threadId, attachments, {
      messageId: randomUUID(),
      mentions: [agent.id],
      replyTo: opts.replyTo,
      voice: opts.voice,
      goal: opts.goal,
      plugin: opts.plugin
    })
    return threadId
  }

  // A question asked beside a thread rather than in it. Nothing about it reaches
  // the thread, so the work going on there is not interrupted and nobody else
  // scrolls past a question they never asked: it is a ghost, and it reads the
  // thread it was asked from for whatever the question needs.
  private startAside(
    ws: WebSocket,
    member: Member,
    parent: Thread,
    mentions: string[],
    text: string,
    attachments: Attachment[],
    plugin?: string
  ): void {
    if (!text) {
      this.refuse('Ask a question to go with it.', ws, parent.id)
      return
    }
    // A ghost only ever runs on your own machine, so a thread somebody else's
    // agent is on is still a thread you can ask about: one of yours answers it.
    const named = [...new Set(mentions)].filter(id => this.ownAgent(member, id) && this.agents.has(id))
    const mine = this.agentsHere(member.id)
    const agent =
      this.agents.get(named[0] ?? '') ??
      (this.ownAgent(member, parent.agentId) ? this.agents.get(parent.agentId) : undefined) ??
      mine[0]
    if (!agent) {
      this.refuse('No agent of yours is here to take it.', ws, parent.id)
      return
    }
    this.startThread(member, agent, text, attachments, { ghost: ws, aside: parent.id, plugin })
  }

  // The thread so far, carried on in one of its own. What was said up to this
  // moment is read for context and the thread it came from is left exactly as it
  // was, so a good place can be gone on from several ways at once. A fork of a
  // hidden thread is hidden, or a hidden thread leaks the moment anybody forks
  // it, and it takes the plan and the board with it because it is that
  // conversation carrying on rather than a new one.
  private startFork(
    ws: WebSocket,
    member: Member,
    parent: Thread,
    mentions: string[],
    text: string,
    attachments: Attachment[],
    forkId?: string,
    plugin?: string
  ): void {
    if (!text) {
      this.refuse('Say what to carry on with.', ws, parent.id)
      return
    }
    const hidden = this.ghostOf(parent.id)
    const ghost = hidden?.ws ?? undefined
    const named = [...new Set(mentions)].filter(
      id => this.agents.has(id) && (hidden === undefined || this.ownAgent(member, id))
    )
    const agent = this.agents.get(named[0] ?? '') ?? this.agents.get(parent.agentId)
    if (!agent) {
      this.refuse('Mention an agent with @ to say who should take it.', ws, parent.id)
      return
    }
    this.startThread(member, agent, text, attachments, {
      ghost,
      hidden: hidden !== undefined,
      threadId: forkId,
      mode: parent.mode,
      plan: parent.plan,
      boardId: parent.boardId,
      tickets: parent.tickets,
      plugin,
      mentions: named.length > 0 ? named : [agent.id],
      fork: { from: parent.id, at: Date.now() }
    })
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
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'todo.edited',
      todoId,
      text: trimmed,
      agentId,
      byName: member.name
    })
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

  private memoryLike(text: string, except = ''): CrewMemory | null {
    const key = memoryKey(text)
    for (const memory of this.memories.values()) {
      if (memory.id !== except && memoryKey(memory.text) === key) return memory
    }
    return null
  }

  private writeMemory(text: string, byName: string, agentId?: string): string {
    const memory: CrewMemory = {
      id: shortId(new Set(this.memories.keys())),
      text,
      by: byName,
      byAgentId: agentId,
      ts: Date.now()
    }
    this.memories.set(memory.id, memory)
    this.emit({
      id: randomUUID(),
      ts: memory.ts,
      kind: 'memory.added',
      memoryId: memory.id,
      text,
      agentId,
      byName
    })
    return memory.id
  }

  private rewriteMemory(memory: CrewMemory, text: string, byName: string, agentId?: string): void {
    memory.text = text
    memory.by = byName
    memory.byAgentId = agentId
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'memory.edited', memoryId: memory.id, text, agentId, byName })
  }

  private handleMemoryAdd(member: Member, raw: string): void {
    const text = cleanMemoryLine(raw)
    if (!text || this.memoryLike(text) || this.memories.size >= MEMORY_LIMIT) return
    this.writeMemory(text, member.name)
  }

  private handleMemoryEdit(member: Member, memoryId: string, raw: string): void {
    const memory = this.memories.get(memoryId)
    const text = cleanMemoryLine(raw)
    if (!memory || !text || text === memory.text || this.memoryLike(text, memoryId)) return
    this.rewriteMemory(memory, text, member.name)
  }

  private handleMemoryRemove(member: Member, memoryId: string): void {
    if (!this.memories.delete(memoryId)) return
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'memory.removed', memoryId, byName: member.name })
  }

  private pluginLike(name: string): CrewPlugin | null {
    const key = pluginKey(name)
    for (const plugin of this.plugins.values()) {
      if (pluginKey(plugin.name) === key) return plugin
    }
    return null
  }

  private writePlugin(said: NonNullable<ReturnType<typeof cleanPlugin>>, byName: string, agentId?: string): string {
    const plugin: CrewPlugin = {
      id: shortId(new Set(this.plugins.keys())),
      ...said,
      by: byName.slice(0, BY_LIMIT),
      byAgentId: agentId,
      ts: Date.now()
    }
    this.plugins.set(plugin.id, plugin)
    this.emit({
      id: randomUUID(),
      ts: plugin.ts,
      kind: 'plugin.added',
      pluginId: plugin.id,
      plugin: said,
      agentId,
      byName: plugin.by
    })
    return plugin.id
  }

  private handlePluginAdd(ws: WebSocket, member: Member, raw: unknown, requestId?: string): void {
    const result = (ok: boolean, message?: string): void => {
      if (requestId) this.send(ws, { type: 'plugin.result', requestId, ok, message })
    }
    const said = cleanPlugin(raw)
    if (!said || !currentPluginInstallation(said)) {
      result(false, 'That plugin is not available.')
      return
    }
    if (this.pluginLike(said.name)) {
      result(false, 'The crew already has that one.')
      return
    }
    if (this.plugins.size >= PLUGIN_LIMIT) {
      this.notice(PLUGIN_FULL, ws)
      result(false, PLUGIN_FULL)
      return
    }
    this.writePlugin(said, member.name)
    result(true)
  }

  private handlePluginRemove(member: Member, pluginId: string): void {
    if (!this.plugins.delete(pluginId)) return
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'plugin.removed', pluginId, byName: member.name })
  }

  private handleScheduleAdd(
    ws: WebSocket,
    member: Member,
    name: string,
    mark: string,
    when: unknown,
    action: ToolAction,
    zone: string
  ): void {
    const clean = cleanSchedule(name, mark, when, action, zone)
    if (!clean) return
    if (this.schedules.size >= SCHEDULE_LIMIT) {
      this.notice(SCHEDULE_FULL, ws)
      return
    }
    const schedule: Schedule = {
      id: shortId(new Set(this.schedules.keys())),
      ...clean,
      createdBy: member.name.slice(0, BY_LIMIT),
      ts: Date.now()
    }
    this.schedules.set(schedule.id, schedule)
    this.emit({
      id: randomUUID(),
      ts: schedule.ts,
      kind: 'schedule.added',
      scheduleId: schedule.id,
      name: schedule.name,
      mark: schedule.mark,
      when: schedule.when,
      action: schedule.action,
      zone: schedule.zone,
      byName: schedule.createdBy
    })
    this.armClock()
  }

  private handleScheduleEdit(
    member: Member,
    scheduleId: string,
    name: string,
    mark: string,
    when: unknown,
    action: ToolAction,
    zone: string
  ): void {
    const held = this.schedules.get(scheduleId)
    const clean = cleanSchedule(name, mark, when, action, zone)
    if (!held || !clean) return
    this.schedules.set(scheduleId, { ...held, ...clean })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'schedule.edited',
      scheduleId,
      name: clean.name,
      mark: clean.mark,
      when: clean.when,
      action: clean.action,
      zone: clean.zone,
      byName: member.name
    })
    this.armClock()
  }

  private handleScheduleRemove(member: Member, scheduleId: string): void {
    if (!this.schedules.delete(scheduleId)) return
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'schedule.removed', scheduleId, byName: member.name })
    this.armClock()
  }

  private handleSchedulePause(member: Member, scheduleId: string, paused: boolean): void {
    const held = this.schedules.get(scheduleId)
    if (!held || held.paused === (paused === true)) return
    this.schedules.set(scheduleId, { ...held, paused: paused === true })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'schedule.paused',
      scheduleId,
      paused: paused === true,
      byName: member.name
    })
    this.armClock()
  }

  private armClock(): void {
    if (this.clock) clearTimeout(this.clock)
    this.clock = null
    const now = Date.now()
    let soonest = Infinity
    for (const schedule of this.schedules.values()) {
      if (schedule.paused) continue
      const since = schedule.lastRunAt ?? schedule.ts
      soonest = Math.min(soonest, nextRun({ ...schedule, lastRunAt: since }, since))
    }
    if (soonest === Infinity) return
    this.clock = setTimeout(() => this.strike(), Math.min(Math.max(soonest - now, 0), CLOCK_MAX_MS))
    this.clock.unref?.()
  }

  private strike(): void {
    this.clock = null
    const now = Date.now()
    for (const schedule of [...this.schedules.values()]) {
      if (due(schedule, now)) this.runSchedule(schedule.id, schedule.createdBy, true)
    }
    this.armClock()
  }

  private runSchedule(scheduleId: string, byName: string, onTime: boolean): void {
    const schedule = this.schedules.get(scheduleId)
    if (!schedule) return
    const threadId = this.performScheduled(schedule.action, schedule, new Set())
    if (!onTime) return
    const ts = Date.now()
    this.schedules.set(scheduleId, { ...schedule, lastRunAt: ts, lastThreadId: threadId ?? schedule.lastThreadId })
    this.emit({ id: randomUUID(), ts, kind: 'schedule.ran', scheduleId, threadId, byName })
  }

  private performScheduled(action: ToolAction, schedule: Schedule, walked: Set<string>): string | undefined {
    const member: Member = {
      id: SYSTEM_AUTHOR_ID,
      name: schedule.createdBy,
      connections: new Set()
    }
    if (action.kind === 'say') {
      this.systemMessage(action.text)
      return undefined
    }
    if (action.kind === 'todo') {
      this.handleTodoAdd(member, action.text, action.agentId)
      return undefined
    }
    if (action.kind === 'prompt') {
      const taking = this.agentToTake(action.agentId)
      if (!taking) return undefined
      return this.startThread(member, taking, action.text, [])
    }
    if (action.kind === 'post') {
      this.startPost(member, action.text, action.agentId)
      return undefined
    }
    if (action.kind === 'music') {
      if (action.trackId) this.handleMusicSet(member, action.trackId, true, 0, action.playlistId ?? null)
      return undefined
    }
    if (action.kind === 'note') {
      const page = this.followRenames(action.page)
      const doc = this.docs.get(page)
      if (!doc) return undefined
      this.handleDoc(null, member, page, doc.text ? `${doc.text.replace(/\s*$/, '')}\n\n${action.text}` : action.text)
      return undefined
    }
    if (action.kind === 'chain') {
      for (const toolId of action.toolIds) {
        if (walked.has(toolId)) continue
        walked.add(toolId)
        if (walked.size > STEP_LIMIT) return undefined
        const tool = this.tools.get(toolId)
        if (tool && schedulable(tool.action)) this.performScheduled(tool.action, schedule, walked)
      }
      return undefined
    }
    return undefined
  }

  private handleMemorySetting(member: Member, enabled: boolean): void {
    if (enabled === this.memoryEnabled) return
    this.memoryEnabled = enabled
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'memory.setting', enabled, byName: member.name })
  }

  // The size limit is the crew's, so it is refused from a runner the way the
  // music controls are: an agent's machine is connected the whole time it is
  // joined.
  private handleAttachmentLimit(member: Member, mb: number): void {
    const clean = cleanAttachmentMb(mb)
    if (clean === null || clean === this.attachmentMb) return
    this.attachmentMb = clean
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'attachment.limit', mb: clean, byName: member.name })
  }

  // What the host will take, which is what every window is told and what both
  // ways in ask before they keep a byte.
  attachmentLimit(): number {
    return attachmentBytes(this.attachmentMb)
  }

  // Every route names a promptId, and the host takes it only while that prompt
  // is one it is running right now. A board being drawn on is a different weight
  // of thing from a shell running on somebody's laptop, so the live prompt is
  // the credential: it costs one lookup, and nothing has to be handed around.
  private askingThread(promptId: string): Thread | null {
    const ref = this.prompts.get(promptId)
    if (!ref) return null
    return this.threads.get(ref.threadId) ?? null
  }

  private helperOf(promptId: string, threadId: string): Thread | null {
    const parent = this.askingThread(promptId)
    const child = this.threads.get(threadId)
    if (!parent || !child) return null
    let at: Thread | undefined = child
    while (at?.parentThreadId) {
      if (at.parentThreadId === parent.id) return child
      at = this.threads.get(at.parentThreadId)
    }
    return null
  }

  subagentSpawn(
    promptId: string,
    named: string,
    subject: string,
    task: string,
    opts: { provider?: string; model?: string; notify?: boolean } = {}
  ): { id: string; threadId: string } | { error: string } {
    const parent = this.askingThread(promptId)
    if (!parent) return { error: NOT_RUNNING }
    return this.spawnSubagent({ threadId: parent.id, promptId, byName: parent.agentLabel }, named, subject, task, opts)
  }

  subagentSay(promptId: string, threadId: string, text: string): boolean {
    return this.helperOf(promptId, threadId) ? this.saySubagent(threadId, text) : false
  }

  subagentStop(promptId: string, threadId: string): boolean {
    return this.helperOf(promptId, threadId) ? this.stopSubagent(threadId) : false
  }

  subagentLook(promptId: string, threadId: string): ReturnType<CrewSession['subagentState']> {
    return this.helperOf(promptId, threadId) ? this.subagentState(threadId) : null
  }

  subagentWait(promptId: string, threadIds: string[], ms: number): Promise<{ finished: string[]; pending: string[] }> {
    const mine = threadIds.filter(id => this.helperOf(promptId, id))
    return this.waitSubagents(mine, ms)
  }

  subagentList(promptId: string): ReturnType<CrewSession['subagentState']>[] | null {
    const parent = this.askingThread(promptId)
    if (!parent) return null
    return [...this.threads.values()]
      .filter(thread => this.helperOf(promptId, thread.id))
      .map(thread => this.subagentState(thread.id))
      .filter(state => state !== null)
  }

  subagentRestart(promptId: string, threadId: string): boolean {
    return this.helperOf(promptId, threadId) ? this.restartSubagent(threadId) : false
  }

  // The board is a thread, so what a call writes is decided by the run asking
  // rather than by anything in the body. Every one of these goes through emit,
  // which is what keeps a ghost thread's board on its own transcript and off
  // the log without any of it being said again here.
  private ticketsOn(threadId: string): TicketAdded[] {
    return this.eventsOf(threadId).filter(
      (event): event is TicketAdded => event.kind === 'ticket.added' && event.threadId === threadId
    )
  }

  ticketPut(promptId: string, raw: unknown): { ids: string[] } | { error: string } {
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    const titles = cleanTitles(raw)
    if (titles.length === 0) return { error: 'Say what the pieces of work are.' }
    const already = this.ticketsOn(thread.id)
    // An id carries on from what the thread already holds rather than starting
    // again, so a second call is more of the same board and not a second one.
    const seen = new Set(already.map(event => event.title.toLowerCase()))
    const ids: string[] = []
    let held = already.length
    for (const title of titles) {
      if (held >= LIST_LIMIT) break
      if (seen.has(title.toLowerCase())) continue
      seen.add(title.toLowerCase())
      held++
      const ticketId = String(held)
      ids.push(ticketId)
      this.emit({ id: randomUUID(), ts: Date.now(), kind: 'ticket.added', threadId: thread.id, ticketId, title })
    }
    return { ids }
  }

  ticketMove(promptId: string, ticketId: string, rawColumn: unknown, rawNote: unknown): Done {
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    const column = cleanColumn(rawColumn)
    if (!column) return { error: 'The columns are todo, doing, review and done.' }
    if (!this.ticketsOn(thread.id).some(event => event.ticketId === ticketId)) {
      return { error: 'No ticket with that id on this thread. Put the work up first.' }
    }
    // A note is what to look at, which is only a thing to say on the way into
    // review. The board reads it there and nowhere else.
    const note = ticketLine(rawNote, NOTE_LIMIT)
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'ticket.moved', threadId: thread.id, ticketId, column, note })
    return { ok: true }
  }

  ticketDecide(promptId: string, ticketId: string, rawText: unknown): Done {
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    const text = ticketLine(rawText, NOTE_LIMIT)
    if (!text) return { error: 'Say what was decided.' }
    // A decision naming nothing hangs off whatever is on doing, so an empty id
    // is written as it stands rather than refused.
    const id = ticketLine(ticketId, TICKET_TITLE_LIMIT)
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'ticket.decided', threadId: thread.id, ticketId: id, text })
    return { ok: true }
  }

  ticketAsk(promptId: string, raw: Record<string, unknown>): Done {
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    const ask = ticketLine(raw.ask, ASK_LIMIT)
    if (!ask) return { error: 'Say what the question is.' }
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'ticket.asked',
      threadId: thread.id,
      askId: randomUUID(),
      ticketId: ticketLine(raw.ticketId, TICKET_TITLE_LIMIT),
      ask,
      assumed: ticketLine(raw.assumed, ASSUMED_LIMIT),
      options: cleanOptions(raw.options)
    })
    return { ok: true }
  }

  private memoryFrom(promptId: string): Thread | { error: string } {
    if (!this.memoryEnabled) return { error: MEMORY_OFF }
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    if (this.ghostOf(thread.id)) return { error: GHOST_MEMORY }
    return thread
  }

  memoryPut(promptId: string, raw: unknown): { ids: string[] } | { error: string } {
    const asking = this.memoryFrom(promptId)
    if ('error' in asking) return asking
    const lines = cleanMemoryLines(raw)
    if (lines.length === 0) return { error: 'Say what to write down.' }
    if (this.memories.size + lines.filter(text => !this.memoryLike(text)).length > MEMORY_LIMIT) {
      return { error: MEMORY_FULL }
    }
    const ids = lines.map(text => {
      const already = this.memoryLike(text)
      return already ? already.id : this.writeMemory(text, asking.agentLabel, asking.agentId)
    })
    return { ids }
  }

  memoryEdit(promptId: string, memoryId: string, raw: unknown): Done {
    const asking = this.memoryFrom(promptId)
    if ('error' in asking) return asking
    const memory = this.memories.get(memoryId)
    if (!memory) return { error: 'No memory with that id. The list is in front of you.' }
    const text = cleanMemoryLine(raw)
    if (!text) return { error: 'Say what it should say instead.' }
    const already = this.memoryLike(text, memoryId)
    if (already) return { error: 'The crew already knows that one.' }
    this.rewriteMemory(memory, text, asking.agentLabel, asking.agentId)
    return { ok: true }
  }

  memoryForget(promptId: string, memoryId: string): Done {
    const asking = this.memoryFrom(promptId)
    if ('error' in asking) return asking
    if (!this.memories.delete(memoryId)) return { error: 'No memory with that id. The list is in front of you.' }
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'memory.removed',
      memoryId,
      byName: asking.agentLabel
    })
    return { ok: true }
  }

  memoryRead(promptId: string): { memories: CrewMemory[] } | { error: string } {
    const asking = this.memoryFrom(promptId)
    if ('error' in asking) return asking
    return { memories: [...this.memories.values()] }
  }

  // What an agent wants looked at. It goes through emit like everything else a
  // run says about itself, so a ghost thread's page is shown to the one window
  // that opened the thread and is never written down.
  showPage(promptId: string, rawUrl: unknown, rawTitle: unknown): Done {
    const thread = this.askingThread(promptId)
    if (!thread) return { error: NOT_RUNNING }
    const pages = pagesNamed(rawUrl)
    if (!pages) {
      return {
        error: `Give the full path to a file, an address on this machine like localhost:5173, or a link. Up to ${PAGE_LIMIT} at a time, as a list.`
      }
    }
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'page.shown',
      threadId: thread.id,
      promptId,
      pages,
      title: pageTitle(rawTitle) || (pages.length === 1 ? pageName(pages[0]) : ''),
      agentId: thread.agentId,
      agentLabel: thread.agentLabel
    })
    return { ok: true }
  }

  private subagentThreads(parentThreadId: string): Thread[] {
    return [...this.threads.values()].filter(thread => thread.parentThreadId === parentThreadId)
  }

  private subagentRunning(thread: Thread): boolean {
    return thread.running !== null || thread.queue.length > 0
  }

  // Who runs a role: an agent of the provider it asks for, owned by whoever the
  // parent belongs to and here, then any agent of that provider here, then the
  // parent's own agent. A role naming nothing runs on the parent's own, which
  // keeps the common case on one machine.
  private runnerFor(provider: string | undefined, parent: AgentState): AgentState | null {
    // Somebody who has turned helpers off never has one land on their machine,
    // whoever asked for it and whatever CLI it asked for.
    const willing = (agent: AgentState): boolean => this.helpersFor(agent.ownerId).on
    if (!willing(parent)) return null
    if (!provider) return parent.runner ? parent : null
    // A CLI asked for by name is asked for. Falling back to the parent's own
    // would run the work on something it explicitly did not pick, which reads
    // as the request being ignored.
    const here = this.agentsHere().filter(agent => agent.provider === provider && willing(agent))
    return here.find(agent => agent.ownerId === parent.ownerId) ?? here[0] ?? null
  }

  // The CLIs a helper could be put on, which is only ever what somebody here
  // is actually running.
  private spawnProviders(): string[] {
    return [...new Set(this.agentsHere().map(agent => agent.provider))].sort()
  }

  // A member is keyed by name here, so who somebody is is asked once rather
  // than walked for at every place that needs to know.
  private helpersFor(ownerId: string): HelperPrefs {
    for (const member of this.members.values()) {
      if (member.id === ownerId) return member.helpers ?? DEFAULT_PREFS
    }
    return DEFAULT_PREFS
  }

  // The whole of what a parent may do. Every refusal is a sentence rather than
  // a code, because the only thing that reads them is a model.
  spawnSubagent(
    from: { threadId: string; promptId?: string; byName: string },
    named: string,
    subject: string,
    task: string,
    opts: { provider?: string; model?: string; notify?: boolean } = {}
  ): { id: string; threadId: string } | { error: string } {
    const name = cleanHelperName(named)
    const parent = this.threads.get(from.threadId)
    if (!parent) return { error: 'That thread is not open.' }
    const cleanTask = task.trim().slice(0, TASK_LIMIT)
    if (!cleanTask) return { error: 'Say what the helper should do.' }
    if ((parent.depth ?? 0) >= DEPTH_LIMIT)
      return { error: 'A helper this far down cannot send out helpers of its own.' }
    const born = this.subagentThreads(from.threadId)
    if (born.length >= RUN_LIMIT) return { error: `This thread has already run ${RUN_LIMIT} helpers.` }
    const parentAgent = this.agents.get(parent.agentId)
    if (!parentAgent) return { error: 'That thread has no agent on it.' }
    // How many at once is the owner's own answer, held under the crew's cap.
    const fan = Math.min(this.helpersFor(parentAgent.ownerId).fan, FAN_LIMIT)
    if (!this.helpersFor(parentAgent.ownerId).on) return { error: 'Helpers are turned off on this machine.' }
    const out = born.filter(thread => this.subagentRunning(thread))
    if (out.length >= fan) return { error: `You already have ${fan} running. Wait for one to come back.` }
    const asked = opts.provider?.trim() || undefined
    const agent = this.runnerFor(asked, parentAgent)
    if (!agent) {
      return { error: asked ? `Nobody here is running ${asked}.` : `No agent is here to run ${name}.` }
    }
    const asker: Member = { id: parentAgent.id, name: from.byName, connections: new Set() }
    const model = opts.model?.trim()
    const threadId = this.startThread(asker, agent, cleanTask, [], {
      ghost: this.ghostOf(from.threadId)?.ws ?? undefined,
      hidden: this.ghostOf(from.threadId) !== undefined,
      subagent: {
        parentThreadId: from.threadId,
        parentPromptId: from.promptId ?? '',
        name,
        subject: (subject || cleanTask).replace(/\s+/g, ' ').trim().slice(0, SUBJECT_LIMIT),
        depth: (parent.depth ?? 0) + 1,
        settings: model ? { model } : undefined,
        notify: opts.notify !== false
      }
    })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'subagent.started',
      threadId,
      parentThreadId: from.threadId,
      parentPromptId: from.promptId ?? '',
      name,
      subject: this.threads.get(threadId)?.subject ?? '',
      agentId: agent.id,
      agentLabel: agent.label,
      byName: from.byName
    })
    return { id: threadId, threadId }
  }

  // Another turn for a helper still going, which a steerable one takes mid-run
  // for the same reason a person typing into a thread does.
  saySubagent(threadId: string, text: string): boolean {
    const thread = this.threads.get(threadId)
    const trimmed = text.trim().slice(0, TASK_LIMIT)
    if (!thread?.parentThreadId || !trimmed) return false
    const agent = this.agents.get(thread.agentId)
    if (!agent) return false
    const parentAgent = this.agents.get(this.threads.get(thread.parentThreadId)?.agentId ?? '')
    const asker: Member = {
      id: parentAgent?.id ?? SYSTEM_AUTHOR_ID,
      name: parentAgent?.label ?? SYSTEM_AUTHOR_NAME,
      connections: new Set()
    }
    thread.notify = true
    this.enqueuePrompt(agent, asker, trimmed, threadId, [], { messageId: randomUUID(), mentions: [agent.id] })
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'subagent.said',
      threadId,
      parentThreadId: thread.parentThreadId,
      name: thread.helper ?? 'Helper',
      text: trimmed
    })
    return true
  }

  restartSubagent(threadId: string): boolean {
    const thread = this.threads.get(threadId)
    if (!thread?.parentThreadId || this.subagentRunning(thread)) return false
    const events = this.eventsOf(threadId)
    const end = [...events]
      .reverse()
      .find(
        (event): event is Extract<SessionEvent, { kind: 'agent.end' }> =>
          event.kind === 'agent.end' && event.threadId === threadId
      )
    if (!end || end.ok) return false
    const start = events.find(
      (event): event is Extract<SessionEvent, { kind: 'agent.start' }> =>
        event.kind === 'agent.start' && event.promptId === end.promptId
    )
    const agent = this.agents.get(thread.agentId)
    if (!start?.promptText.trim() || !agent || (!agent.runner && !agent.dropTimer)) return false
    const parentAgent = this.parentAgentOf(thread)
    const asker: Member = {
      id: parentAgent?.id ?? SYSTEM_AUTHOR_ID,
      name: parentAgent?.label ?? SYSTEM_AUTHOR_NAME,
      connections: new Set()
    }
    thread.notify = true
    this.enqueuePrompt(agent, asker, start.promptText, threadId, [], {
      messageId: randomUUID(),
      mentions: [agent.id]
    })
    return true
  }

  // A helper somebody stopped does not wake anybody. Its work was called off,
  // so waking the parent with it would open a turn on a run that was just
  // cancelled.
  stopSubagent(threadId: string): boolean {
    const thread = this.threads.get(threadId)
    if (!thread?.parentThreadId) return false
    thread.notify = false
    thread.queue = []
    this.broadcastQueue(thread)
    if (thread.running) this.handleCancel(thread.running)
    return true
  }

  // Where a helper has got to, for a parent that would rather look than wait.
  subagentState(threadId: string): {
    id: string
    parentId: string
    subject: string
    helper: string
    agent: string
    state: 'working' | 'done' | 'stopped' | 'failed'
    ms: number
    said: string
    tokens: number
    files: string[]
  } | null {
    const thread = this.threads.get(threadId)
    if (!thread?.parentThreadId) return null
    const events = this.eventsOf(threadId)
    const end = [...events]
      .reverse()
      .find(
        (event): event is Extract<SessionEvent, { kind: 'agent.end' }> =>
          event.kind === 'agent.end' && event.threadId === threadId
      )
    const working = this.subagentRunning(thread)
    const files = new Set<string>()
    let tokens = 0
    for (const event of events) {
      if (event.kind !== 'agent.step' || event.threadId !== threadId) continue
      for (const file of event.step.files ?? []) files.add(file.path)
    }
    for (const [promptId, run] of this.agents.get(thread.agentId)?.runs ?? []) {
      if (this.prompts.get(promptId)?.threadId === threadId) tokens += run.tokens
    }
    const active = thread.running ? this.agents.get(thread.agentId)?.runs.get(thread.running) : undefined
    return {
      id: threadId,
      parentId: thread.parentThreadId,
      subject: thread.subject ?? thread.title,
      helper: thread.helper ?? '',
      agent: thread.agentLabel,
      state: working ? 'working' : end?.stopped ? 'stopped' : end?.ok === false ? 'failed' : 'done',
      ms: working ? (active ? Math.max(0, Date.now() - active.startedAt) : 0) : (end?.ms ?? 0),
      said: working ? '' : (end?.text ?? end?.error ?? ''),
      tokens,
      files: [...files]
    }
  }

  // The one case where a parent has nothing of its own left to do. It is bounded
  // rather than open, because a run with no output at all is killed for idling
  // long before a helper doing real work would come back.
  waitSubagents(threadIds: string[], ms: number): Promise<{ finished: string[]; pending: string[] }> {
    const watched = threadIds.filter(id => this.threads.get(id)?.parentThreadId)
    const going = (id: string): boolean => {
      const thread = this.threads.get(id)
      return thread !== undefined && this.subagentRunning(thread)
    }
    const settled = (): boolean => watched.every(id => !going(id))
    const answer = (): { finished: string[]; pending: string[] } => ({
      finished: watched.filter(id => !going(id)),
      pending: watched.filter(going)
    })
    if (watched.length === 0 || settled()) return Promise.resolve(answer())
    return new Promise(resolve => {
      const done = (): void => {
        clearTimeout(wait.timer)
        this.waits.delete(wait)
        resolve(answer())
      }
      const timer = setTimeout(done, Math.min(Math.max(1000, ms), WAIT_MS))
      timer.unref?.()
      const wait: PendingWait = {
        threadIds: watched,
        timer,
        settle: () => {
          if (settled()) done()
        }
      }
      this.waits.add(wait)
    })
  }

  private parentAgentOf(thread: Thread): AgentState | undefined {
    const start = thread.parentPromptId
      ? this.eventsOf(thread.parentThreadId ?? '').find(
          (event): event is Extract<SessionEvent, { kind: 'agent.start' }> =>
            event.kind === 'agent.start' && event.promptId === thread.parentPromptId
        )
      : undefined
    return this.agents.get(start?.agentId ?? this.threads.get(thread.parentThreadId ?? '')?.agentId ?? '')
  }

  private returnKey(parentThreadId: string, agentId: string): string {
    return `${parentThreadId}\n${agentId}`
  }

  private holdSubagentReturn(
    thread: Thread,
    ended: Extract<SessionEvent, { kind: 'subagent.ended' }>,
    text: string
  ): void {
    const parentId = thread.parentThreadId
    const target = this.parentAgentOf(thread)
    if (!parentId || !target || !ended.promptId) return
    const key = this.returnKey(parentId, target.id)
    const item = {
      endedId: ended.id,
      promptId: ended.promptId,
      threadId: thread.id,
      name: thread.helper ?? thread.agentLabel,
      subject: thread.subject ?? thread.title,
      ok: ended.ok,
      stopped: ended.stopped,
      ms: ended.ms,
      text
    }
    const held = this.returns.get(key)
    if (held) {
      if (!held.items.some(one => one.endedId === ended.id)) held.items.push(item)
      return
    }
    const timer = setTimeout(() => this.deliverReturns(key), RETURN_COALESCE_MS)
    timer.unref?.()
    this.returns.set(key, { timer, parentThreadId: parentId, agentId: target.id, items: [item] })
  }

  private subagentReturn(
    thread: Thread,
    promptId: string,
    ok: boolean,
    text: string,
    stopped = false,
    elapsed?: number
  ): void {
    const parentId = thread.parentThreadId
    if (!parentId) return
    for (const wait of [...this.waits]) {
      if (wait.threadIds.includes(thread.id)) wait.settle()
    }
    const ms = elapsed ?? Math.max(0, Date.now() - (thread.startedAt ?? Date.now()))
    const ended: Extract<SessionEvent, { kind: 'subagent.ended' }> = {
      id: randomUUID(),
      ts: Date.now(),
      kind: 'subagent.ended',
      threadId: thread.id,
      parentThreadId: parentId,
      promptId,
      ok,
      ms,
      stopped: stopped || undefined
    }
    this.emit(ended)
    if (thread.notify === false) return
    const woken = this.wakes.get(parentId) ?? 0
    if (woken >= WAKE_LIMIT) return
    this.holdSubagentReturn(thread, ended, text)
  }

  private deliverReturns(key: string): void {
    const held = this.returns.get(key)
    if (!held) return
    const parent = this.threads.get(held.parentThreadId)
    const agent = this.agents.get(held.agentId)
    if (!parent || !agent) {
      this.returns.delete(key)
      return
    }
    if (!agent.runner && !agent.dropTimer) return
    this.returns.delete(key)
    this.wakes.set(held.parentThreadId, (this.wakes.get(held.parentThreadId) ?? 0) + 1)
    const stillOut = this.subagentThreads(held.parentThreadId)
      .filter(thread => this.subagentRunning(thread))
      .map(thread => thread.helper ?? thread.agentLabel)
    const text = returnText(held.items, stillOut)
    const steer: PendingSteer = {
      messageId: randomUUID(),
      text,
      byName: SYSTEM_AUTHOR_NAME,
      authorId: SYSTEM_AUTHOR_ID,
      threadId: held.parentThreadId,
      attachments: [],
      silent: true
    }
    for (const item of held.items) {
      this.emit({
        id: randomUUID(),
        ts: Date.now(),
        kind: 'subagent.returned',
        threadId: item.threadId,
        parentThreadId: held.parentThreadId,
        endedId: item.endedId
      })
    }
    const running = parent.running ? this.prompts.get(parent.running)?.agentId : undefined
    if (agent.runner && parent.running && running === agent.id && agent.steerable) {
      this.sendSteer(agent, parent.running, steer)
      return
    }
    this.requeueSteer(agent, steer)
  }

  private deliverReturnsFor(agentId: string): void {
    for (const [key, held] of this.returns) {
      if (held.agentId === agentId) this.deliverReturns(key)
    }
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
      replyTo: entry.replyTo,
      voice: entry.voice ? true : undefined
    })
  }

  private visibleDocs(ws?: WebSocket): Record<string, DocPage> {
    return Object.fromEntries(
      [...this.docs].filter(([page, doc]) => doc.scope !== 'ghost' || this.ghostDocOwners.get(page) === ws)
    )
  }

  private refsOf(text: string, ws?: WebSocket): { docMentions: DocMentionRef[]; boardMentions: BoardMentionRef[] } {
    const refs = this.crewRefsIn(text, ws)
    return { docMentions: docMentionsOf(refs), boardMentions: boardMentionsOf(refs) }
  }

  private crewRefsIn(text: string, ws?: WebSocket): CrewRef[] {
    return refsIn(text, crewRefs(this.visibleDocs(ws), this.boardList()))
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
    const written = agentMentionRefsIn(
      text,
      [...this.agents.values()].map(agent => this.pooled(agent))
    )
    for (const ref of written) refs.set(ref.id, ref)
    for (const id of ids) {
      const agent = this.agents.get(id)
      if (agent) refs.set(agent.id, { id: agent.id, label: agent.label })
    }
    return [...refs.values()]
  }

  // Reading back into the history. It goes to the one person who asked for it
  // and is never written down, and a ghost thread is not in the log to reach.
  private sendHistory(ws: WebSocket, before: string): void {
    const older = olderEvents(this.events, before, HISTORY_PAGE)
    this.send(ws, { type: 'history', events: chatEvents(older.events), more: older.more })
  }

  // One thread, whole. A window holds the tail of the log, so a thread opened
  // long after it ran is a row in the rail with nothing under it, and the way
  // back into it is asking for that thread rather than reading the whole chat
  // back a page at a time to reach it. It goes to the one who asked, and a
  // ghost thread is that window's own or nobody's.
  private sendThreadHistory(ws: WebSocket, threadId: string): void {
    if (this.hiddenFrom(ws, threadId)) return
    const own = eventsOfThread(this.eventsOf(threadId), threadId)
    this.send(ws, {
      type: 'thread.history',
      threadId,
      events: chatEvents(trimEvents(own, THREAD_HISTORY_LIMIT))
    })
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
    // One off the sheet, or one of the crew's own. A `:name:` nothing here
    // answers to is refused rather than written down, so a reaction can never
    // stand for a picture that was never there.
    if (!isReactionEmoji(emoji) && !this.hasCustomEmoji(emoji)) return
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
          if (entry.step.kind !== 'text' || agentStepReactionTarget(promptId, entry.step.id) !== targetId) {
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

  private handleThreadRename(member: Member, threadId: string, title: string): void {
    const thread = this.threads.get(threadId)
    const clean = this.titleFrom(title)
    if (!thread || !clean || clean === thread.title) return
    thread.title = clean
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.renamed', threadId, title: clean, byName: member.name })
  }

  private handleThreadDelete(ws: WebSocket, member: Member, threadId: string): void {
    const thread = this.threads.get(threadId)
    if (!thread) return
    if (thread.running || thread.queue.length > 0) {
      this.refuse('Wait for this chat to finish before deleting it.', ws)
      return
    }
    this.threads.delete(threadId)
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'thread.deleted', threadId, byName: member.name })
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

  // A face is a picture and nothing else, whatever a message may carry. The
  // window that sends one already knows that, and the host is not the place to
  // take a window's word for it.
  savePhoto(mime: string, name: string, data: Buffer): Attachment | null {
    return isImageType(mime) ? this.saveAttachment(mime, name, data) : null
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

  // A picture is kept under the type it says it is, since that is the one thing
  // a browser reports reliably. For everything else the extension it arrived
  // with decides, and the type recorded is the type it will be served as, so
  // what the app reads off the record is what really comes back off the wire.
  private attachmentOf(mime: string, name: string, data: Buffer): Attachment | null {
    if (data.length === 0 || data.length > this.attachmentLimit()) return null
    const id = randomUUID()
    const file = `${id}.${extensionUsedFor(mime, name)}`
    return {
      id,
      name: this.safeName(name, mime),
      mime: isImageType(mime) ? mime : mimeForFile(file),
      size: data.length,
      file
    }
  }

  private safeName(name: string, mime: string): string {
    const flat = name.replace(/[\r\n]+/g, ' ').trim()
    return flat.slice(0, 120) || (isImageType(mime) ? 'image' : 'file')
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
        if (this.docs.get(from)?.scope === 'private') this.store.renamePrivateDoc(from, to)
        else this.store.renameDoc(from, to)
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

  private ownsGhostDoc(ws: WebSocket | null, page: string): boolean {
    return this.docs.get(page)?.scope !== 'ghost' || (ws !== null && this.ghostDocOwners.get(page) === ws)
  }

  private docParent(page: string): string | null {
    const at = page.lastIndexOf('/')
    return at < 0 ? null : page.slice(0, at)
  }

  private saveDoc(page: string, doc: DocPage): void {
    if (doc.scope === 'ghost') return
    if (doc.scope === 'private') this.store.savePrivateDoc(page, doc)
    else this.store.saveDoc(page, doc)
  }

  private syncDoc(scope: DocScope | undefined): void {
    if (scope === undefined) this.onSyncNeeded?.()
  }

  private sendDocEvent(event: SessionEvent, page: string, scope: DocScope | undefined): void {
    const to = scope === 'ghost' ? this.ghostDocOwners.get(page) : undefined
    this.emit(event, { persist: false, to })
    this.syncDoc(scope)
  }

  private handleDoc(
    ws: WebSocket | null,
    member: Member,
    page: string,
    text: string,
    title?: string,
    askedScope?: DocScope
  ): void {
    page = this.followRenames(page)
    const existing = this.docs.get(page)
    if (existing && !this.ownsGhostDoc(ws, page)) return
    const parent = this.docParent(page)
    const parentDoc = parent ? this.docs.get(parent) : undefined
    if (parent && parentDoc && !this.ownsGhostDoc(ws, parent)) return
    if (!existing && parentDoc && askedScope !== undefined && askedScope !== parentDoc.scope) return
    const scope = existing?.scope ?? parentDoc?.scope ?? askedScope
    if (scope === 'ghost' && ws === null) return
    const doc: DocPage = { title: title ?? existing?.title ?? fallbackTitle(page), text, scope }
    if (scope === 'ghost' && !existing && ws) this.ghostDocOwners.set(page, ws)
    try {
      this.saveDoc(page, doc)
    } catch {
      if (!existing) this.ghostDocOwners.delete(page)
      return
    }
    this.docs.set(page, doc)
    if (scope === undefined && title !== undefined && this.docTitles.delete(page)) {
      this.store.saveTitles(Object.fromEntries(this.docTitles))
    }
    this.sendDocEvent(
      { id: randomUUID(), ts: Date.now(), kind: 'doc', page, text, title: doc.title, scope, byName: member.name },
      page,
      scope
    )
  }

  private handleDocRetitle(ws: WebSocket, member: Member, page: string, title: string): void {
    page = this.followRenames(page)
    const existing = this.docs.get(page)
    if (!existing || !this.ownsGhostDoc(ws, page) || existing.title === title) return
    const doc: DocPage = { ...existing, title }
    try {
      this.saveDoc(page, doc)
    } catch {
      return
    }
    this.docs.set(page, doc)
    if (doc.scope === undefined && this.docTitles.delete(page)) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.sendDocEvent(
      { id: randomUUID(), ts: Date.now(), kind: 'doc', page, text: doc.text, title, scope: doc.scope, byName: member.name },
      page,
      doc.scope
    )
  }

  private handleDocTitle(ws: WebSocket, member: Member, page: string, title: string): void {
    page = this.followRenames(page)
    const existing = this.docs.get(page)
    if (!existing || !this.ownsGhostDoc(ws, page)) return
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, TITLE_LIMIT)
    const doc: DocPage = { ...existing, title: clean || fallbackTitle(page) }
    try {
      this.saveDoc(page, doc)
    } catch {
      return
    }
    this.docs.set(page, doc)
    if (doc.scope === undefined) {
      if (clean) this.docTitles.set(page, clean)
      else this.docTitles.delete(page)
      this.store.saveTitles(Object.fromEntries(this.docTitles))
    }
    this.sendDocEvent(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.titled', page, title: clean, byName: member.name },
      page,
      doc.scope
    )
  }

  private handleDocDelete(ws: WebSocket, member: Member, page: string): void {
    const existing = this.docs.get(page)
    if (page === ROOT_PAGE || !existing || !this.ownsGhostDoc(ws, page)) return
    try {
      if (existing.scope === 'private') this.store.deletePrivateDoc(page)
      else if (existing.scope === undefined) this.store.deleteDoc(page)
    } catch {
      return
    }
    for (const key of [...this.docs.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) {
        this.docs.delete(key)
        this.ghostDocOwners.delete(key)
      }
    }
    let titlesChanged = false
    for (const key of [...this.docTitles.keys()]) {
      if (key === page || key.startsWith(`${page}/`)) {
        this.docTitles.delete(key)
        titlesChanged = true
      }
    }
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
    const to = existing.scope === 'ghost' ? ws : undefined
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.deleted', page, byName: member.name },
      { persist: false, to }
    )
    this.syncDoc(existing.scope)
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
    const stillHere = [...this.meta.values()].some(m => m.role === 'ui' && m.memberKey === member.name.toLowerCase())
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

  // One person is one typist wherever they are writing, however many windows
  // they have open on the folder.
  private typists(): Typist[] {
    const seen = new Map<string, Typist>()
    for (const { id, name, where } of this.typing.values()) {
      seen.set(`${id}:${where ?? ''}`, where === undefined ? { id, name } : { id, name, where })
    }
    return [...seen.values()]
  }

  private broadcastTyping(): void {
    this.broadcast({ type: 'typing.room', typists: this.typists() })
  }

  // Nothing typed in a ghost thread ever leaves the window it was typed in, so
  // one is not recorded at all rather than recorded and filtered on the way out.
  private handleTyping(ws: WebSocket, member: Member, rawWhere: string | undefined, on: boolean): void {
    const where = typeof rawWhere === 'string' && rawWhere.length > 0 ? rawWhere.slice(0, 200) : undefined
    if (where !== undefined && this.ghostOf(where)) return
    const before = this.typing.get(ws)
    if (on !== true) {
      if (!this.typing.delete(ws)) return
      this.broadcastTyping()
      return
    }
    // A ping that says what was already said is only the clock being wound. It
    // is nobody's news, so nothing goes out for it.
    const news = before === undefined || before.where !== where
    this.typing.set(ws, { id: member.id, name: member.name, where, at: Date.now() })
    this.armTypingSweep()
    if (news) this.broadcastTyping()
  }

  private stopTyping(ws: WebSocket): void {
    if (this.typing.delete(ws)) this.broadcastTyping()
  }

  // A window that dies mid-word never says it stopped, so the host lets go of it
  // on its own. The sweep is armed off the oldest entry and only while there is
  // one, rather than run on a clock that ticks through every quiet afternoon.
  private armTypingSweep(): void {
    if (this.typingSweep) clearTimeout(this.typingSweep)
    this.typingSweep = null
    const oldest = Math.min(...[...this.typing.values()].map(typist => typist.at))
    if (!Number.isFinite(oldest)) return
    const wait = Math.max(0, oldest + TYPING_TTL - Date.now())
    this.typingSweep = setTimeout(() => {
      this.typingSweep = null
      const cutoff = Date.now() - TYPING_TTL
      let dropped = false
      for (const [ws, typist] of [...this.typing]) {
        if (typist.at > cutoff) continue
        this.typing.delete(ws)
        dropped = true
      }
      this.armTypingSweep()
      if (dropped) this.broadcastTyping()
    }, wait + 1)
    this.typingSweep.unref?.()
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
  private handleHuddleJoin(ws: WebSocket, member: Member, rawPeerId: string, muted: boolean, camera: boolean): void {
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

  private handleHuddleUpdate(ws: WebSocket, change: { muted?: boolean; camera?: boolean; sharing?: boolean }): void {
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

  customEmojiPath(file: string): string | null {
    return this.store.customEmojiPath(file)
  }

  // Whether a reaction is one of the crew's own. It is asked of the value as it
  // was sent, so anything that is not a whole `:name:` is simply not one.
  private hasCustomEmoji(value: string): boolean {
    const name = customEmojiNameIn(value)
    return name !== null && customEmojiNameTaken([...this.emoji.values()], name)
  }

  // An emoji the crew drew themselves. The picture is kept beside the session the
  // way a track is, so everyone draws their own copy rather than reading it off
  // the machine that added it.
  private handleEmojiAdd(ws: WebSocket, member: Member, name: string, mime: string, data: string): void {
    const clean = cleanCustomEmojiName(name)
    const extension = customEmojiExtension(mime)
    if (!clean || !extension) return
    // The name is what everybody types to reach it, so a second picture cannot
    // take one that is already answering to something. It is said rather than
    // dropped, since the window that asked is holding a picture and a field.
    if (customEmojiNameTaken([...this.emoji.values()], clean)) {
      this.notice(`:${clean}: is already taken.`, ws)
      return
    }
    if (this.emoji.size >= MAX_CUSTOM_EMOJI) {
      this.notice('The crew has as many emoji as it can hold.', ws)
      return
    }
    const bytes = Buffer.from(data ?? '', 'base64')
    if (bytes.length === 0 || bytes.length > CUSTOM_EMOJI_MAX_BYTES) return
    const emojiId = randomUUID()
    const file = `${emojiId}.${extension}`
    try {
      this.store.saveCustomEmoji(file, bytes)
    } catch {
      return
    }
    const emoji: CustomEmoji = { id: emojiId, name: clean, file, by: member.name.slice(0, BY_LIMIT), ts: Date.now() }
    this.emoji.set(emojiId, emoji)
    this.emit({
      id: randomUUID(),
      ts: emoji.ts,
      kind: 'emoji.added',
      emojiId,
      name: emoji.name,
      file,
      byName: emoji.by
    })
    this.broadcastEmoji()
  }

  // Naming one again keeps the picture where it is. What has already been
  // reacted with under the old name still says the old name, which is the honest
  // record of what somebody pressed.
  private handleEmojiRename(ws: WebSocket, member: Member, emojiId: string, name: string): void {
    const emoji = this.emoji.get(emojiId)
    const clean = cleanCustomEmojiName(name)
    if (!emoji || !clean || clean === emoji.name) return
    if (customEmojiNameTaken([...this.emoji.values()], clean)) {
      this.notice(`:${clean}: is already taken.`, ws)
      return
    }
    emoji.name = clean
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'emoji.renamed', emojiId, name: clean, byName: member.name })
    this.broadcastEmoji()
  }

  private handleEmojiRemove(member: Member, emojiId: string): void {
    const emoji = this.emoji.get(emojiId)
    if (!emoji) return
    this.emoji.delete(emojiId)
    this.store.deleteCustomEmoji(emoji.file)
    this.emit({ id: randomUUID(), ts: Date.now(), kind: 'emoji.removed', emojiId, byName: member.name })
    this.broadcastEmoji()
  }

  private broadcastEmoji(): void {
    this.broadcast({ type: 'emoji.set', emoji: [...this.emoji.values()] })
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
      playlistId: playlistId && (this.playlists.has(playlistId) || isMusicSet(playlistId)) ? playlistId : null,
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
    const done = setTimeout(
      () => {
        board.presence.delete(agentKey)
        this.designCursorTimers.delete(key)
        this.broadcast({
          type: 'design.presence',
          boardId: board.id,
          presence: {
            userId: agentKey,
            name: label,
            kind: 'agent',
            cursor: null,
            selection: [],
            pageId: null,
            ts: Date.now()
          }
        })
      },
      steps.length * DESIGN_CURSOR_STEP_MS + 6000
    )
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
    const { docMentions, boardMentions } = this.refsOf(trimmed, this.ghostOf(found.thread.id)?.ws ?? undefined)
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

  private handleQueueSend(member: Member, promptId: string): void {
    const found = this.queuedEntry(promptId)
    if (!found || found.entry.authorId !== member.id || !found.thread.running) return
    const agent = this.agents.get(found.entry.agentId)
    const runningAgentId = this.prompts.get(found.thread.running)?.agentId
    if (!agent?.runner || !agent.steerable || runningAgentId !== agent.id) return
    found.thread.queue = found.thread.queue.filter(item => item.promptId !== promptId)
    this.broadcastQueue(found.thread)
    this.emitThreadMessage(found.entry)
    this.sendSteer(agent, found.thread.running, {
      messageId: found.entry.messageId,
      text: found.entry.text,
      byName: found.entry.byName,
      authorId: found.entry.authorId,
      threadId: found.thread.id,
      attachments: found.entry.attachments,
      replyTo: found.entry.replyTo
    })
  }

  private handleQueueTake(ws: WebSocket, member: Member, promptId: string): void {
    const found = this.queuedEntry(promptId)
    if (!found || found.entry.authorId !== member.id) return
    const attachments = found.entry.attachments.map(attachment => {
      try {
        const ghost = this.ghostFiles.get(attachment.file)?.data
        const stored = this.store.attachmentPath(attachment.file)
        const data = ghost ?? (stored ? fs.readFileSync(stored) : null)
        return data ? { name: attachment.name, mime: attachment.mime, data: data.toString('base64') } : null
      } catch {
        return null
      }
    })
    if (attachments.some(item => item === null)) {
      this.send(ws, { type: 'queue.take.failed', promptId, message: 'One of the files could not be opened.' })
      return
    }
    found.thread.queue = found.thread.queue.filter(item => item.promptId !== promptId)
    const shared =
      found.thread.queue.some(item => item.messageId === found.entry.messageId) ||
      [...this.prompts.values()].some(ref => ref.messageId === found.entry.messageId)
    if (this.emittedMessages.has(found.entry.messageId) && !shared) {
      this.handleDeleteMessage(member, found.entry.messageId)
    }
    this.broadcastQueue(found.thread)
    this.send(ws, {
      type: 'queue.taken',
      threadId: found.thread.id,
      item: this.queueItem(found.entry),
      attachments: attachments.filter((item): item is OutgoingAttachment => item !== null)
    })
  }

  private handleQueueMove(member: Member, promptId: string, to: number): void {
    const found = this.queuedEntry(promptId)
    if (!found || found.entry.authorId !== member.id || !Number.isInteger(to)) return
    const from = found.thread.queue.findIndex(item => item.promptId === promptId)
    if (from < 0) return
    const next = found.thread.queue.slice()
    const [entry] = next.splice(from, 1)
    const at = Math.max(0, Math.min(to, next.length))
    next.splice(at, 0, entry)
    if (next.every((item, index) => item === found.thread.queue[index])) return
    found.thread.queue = next
    this.broadcastQueue(found.thread)
  }

  private handleDocRename(ws: WebSocket, member: Member, from: string, to: string, title?: string): void {
    const existing = this.docs.get(from)
    if (from === to || from === ROOT_PAGE || !existing || !this.ownsGhostDoc(ws, from)) return
    if (to === from || to.startsWith(`${from}/`) || this.docs.has(to)) return
    const parent = this.docParent(to)
    const parentDoc = parent ? this.docs.get(parent) : undefined
    if (parentDoc && (parentDoc.scope !== existing.scope || !this.ownsGhostDoc(ws, parent!))) return
    try {
      if (existing.scope === 'private') this.store.renamePrivateDoc(from, to)
      else if (existing.scope === undefined) this.store.renameDoc(from, to)
    } catch {
      return
    }
    for (const [page, doc] of [...this.docs.entries()]) {
      if (page !== from && !page.startsWith(`${from}/`)) continue
      this.docs.delete(page)
      this.docs.set(to + page.slice(from.length), doc)
      const owner = this.ghostDocOwners.get(page)
      if (owner) {
        this.ghostDocOwners.delete(page)
        this.ghostDocOwners.set(to + page.slice(from.length), owner)
      }
    }
    const moved = this.docs.get(to)
    if (title !== undefined && moved && moved.title !== title) {
      const doc: DocPage = { title, text: moved.text }
      if (moved.scope) doc.scope = moved.scope
      try {
        this.saveDoc(to, doc)
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
    if (existing.scope === undefined && title !== undefined && this.docTitles.delete(to)) titlesChanged = true
    if (titlesChanged) this.store.saveTitles(Object.fromEntries(this.docTitles))
    this.docRenames.set(from, { to, ts: Date.now() })
    for (const [key, move] of this.docRenames) {
      if (Date.now() - move.ts > 10000) this.docRenames.delete(key)
    }
    const owner = existing.scope === 'ghost' ? ws : undefined
    this.emit(
      { id: randomUUID(), ts: Date.now(), kind: 'doc.renamed', from, to, title, byName: member.name },
      { persist: false, to: owner }
    )
    this.syncDoc(existing.scope)
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

  // The count only climbs, and the price rides with whatever the run last said
  // rather than with the highest it ever reached: a turn that ends is priced
  // whole by the CLI, and that figure can land under the estimate that led to
  // it. A run that never says a price keeps the last one it gave.
  private handleTokens(meta: ConnMeta, promptId: string, tokens: number, cost?: number): void {
    const agent = this.ownedAgent(meta, promptId)
    const ref = this.prompts.get(promptId)
    const run = agent?.runs.get(promptId)
    if (!agent || !ref || !run) return
    run.tokens = Math.max(run.tokens, tokens)
    if (typeof cost === 'number') run.cost = cost
    this.toThread(ref.threadId, {
      type: 'agent.tokens',
      promptId,
      agentId: agent.id,
      threadId: ref.threadId,
      tokens: run.tokens,
      cost: run.cost ?? undefined
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
      todos: step.todos ?? existing?.todos,
      text: (existing?.text ?? '') + (step.text ?? '') || undefined
    }
    run.steps.set(step.id, { step: merged, persisted: false })
    if (merged.status === 'done') {
      const pending = this.stepFlushes.get(`${promptId}:${step.id}`)
      if (pending) {
        clearTimeout(pending.timer)
        this.stepFlushes.delete(`${promptId}:${step.id}`)
      }
      this.toThread(ref.threadId, {
        type: 'agent.step',
        promptId,
        agentId: agent.id,
        threadId: ref.threadId,
        step: merged
      })
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
    // What a killed CLI says on its way out is that CLI's own words, and they
    // arrive as an ordinary error a moment later. The stop is remembered here
    // instead, so whichever way the run comes back it is written down as the
    // thing somebody did rather than as a thing that went wrong.
    if (ref) this.stopping.add(promptId)
    // Stopping a run stops the helpers it sent out. They are its work, being
    // done somewhere else, so leaving them running would be leaving a stopped
    // turn writing to the project.
    for (const thread of [...this.threads.values()]) {
      if (thread.parentPromptId === promptId) this.stopSubagent(thread.id)
    }
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
      error: 'Stopped',
      stopped: true
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
        const thread = ref ? this.threads.get(ref.threadId) : undefined
        if (!ref || !entry || !thread || !agent.runner) {
          this.finishPrompt(agent, promptId, { ok: false, error: `${agent.label} lost this prompt.` })
          continue
        }
        this.send(agent.runner, this.promptMessage(agent, thread, entry, this.assignedReactions(promptId)))
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
    route?: {
      messageId: string
      mentions: string[]
      replyTo?: MessageReply
      voice?: boolean
      holding?: boolean
      goal?: boolean
      plugin?: string
    }
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
      ...this.refsOf(text, this.ghostOf(threadId)?.ws ?? undefined),
      attachments,
      messageId: route?.messageId ?? randomUUID(),
      replyTo: route?.replyTo,
      voice: route?.voice,
      goal: route?.goal,
      plugin: route?.plugin
    }
    if (!agent.runner && !agent.dropTimer) {
      this.emitThreadMessage(entry)
      this.systemMessage(`${agent.label} is not here right now.`, threadId)
      return
    }
    // A message that arrives mid-run goes straight into the run when it is for
    // the agent doing the running and that agent can take it, so it steers the
    // work in progress instead of waiting. Asking for it to wait is the one
    // thing that overrides that, since the only way to hold a message back was
    // to sit on it until the turn ended.
    const runningAgentId = thread.running ? this.prompts.get(thread.running)?.agentId : undefined
    if (
      !route?.holding &&
      !route?.plugin &&
      agent.runner &&
      thread.running &&
      runningAgentId === agent.id &&
      agent.steerable
    ) {
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
    this.runThread(thread)
    if (thread.queue.some(item => item.promptId === entry.promptId)) this.broadcastQueue(thread)
  }

  private queueItem(entry: QueuedPrompt): QueuedItem {
    return {
      promptId: entry.promptId,
      authorId: entry.authorId,
      authorName: entry.byName,
      text: entry.text,
      agentId: entry.agentId,
      agentLabel: this.agents.get(entry.agentId)?.label ?? '',
      attachments: entry.attachments.length > 0 ? entry.attachments : undefined,
      replyTo: entry.replyTo
    }
  }

  private queueItems(thread: Thread): QueuedItem[] {
    return thread.queue.map(entry => this.queueItem(entry))
  }

  private broadcastQueue(thread: Thread): void {
    this.toThread(thread.id, { type: 'queue.state', threadId: thread.id, items: this.queueItems(thread) })
  }

  private sendSteer(agent: AgentState, promptId: string, steer: PendingSteer): void {
    const waiting = this.steers.get(promptId) ?? []
    waiting.push(steer)
    this.steers.set(promptId, waiting)
    // A helper coming back points at no message, so saying it was routed would
    // fill the log with routes aimed at nothing.
    if (!steer.silent) this.routed(steer.messageId, steer.threadId, promptId, 'steered')
    this.send(agent.runner!, {
      type: 'steer',
      promptId,
      text: steer.text,
      byName: steer.byName,
      attachments: steer.attachments,
      ghost: this.ghostOf(steer.threadId) ? true : undefined,
      from: steer.silent ? { kind: 'subagent' } : undefined
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
      ...this.refsOf(steer.text, this.ghostOf(steer.threadId)?.ws ?? undefined),
      attachments: steer.attachments,
      messageId: steer.messageId,
      replyTo: steer.replyTo,
      silent: steer.silent
    })
    if (!steer.silent) this.routed(steer.messageId, steer.threadId, promptId, 'queued')
    this.runThread(thread)
    if (thread.queue.some(item => item.promptId === promptId)) this.broadcastQueue(thread)
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
    if (!next.silent) this.emitThreadMessage(next)
    thread.running = next.promptId
    agent.running.add(next.promptId)
    agent.runs.set(next.promptId, { steps: new Map(), tokens: 0, cost: null, startedAt: Date.now(), entry: next })
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
      messageId: next.messageId,
      byName: next.byName,
      threadId: thread.id,
      reactionIds: reactions.length > 0 ? reactions.map(reaction => reaction.id) : undefined
    })
    this.send(agent.runner, this.promptMessage(agent, thread, next, reactions))
  }

  // A model the parent pinned wins over whatever the agent running it is set
  // to, which is the whole of "run this one on the small one". How much room is
  // left rides along so the machine can write the words about helpers, since it
  // is the side that knows the address they are reached at.
  private promptMessage(
    agent: AgentState,
    thread: Thread,
    entry: QueuedPrompt,
    reactions: ReactionEvent[]
  ): ServerMessage {
    const born = this.subagentThreads(thread.id)
    const out = born.filter(one => this.subagentRunning(one)).length
    const prefs = this.helpersFor(agent.ownerId)
    const fan = Math.min(prefs.fan, FAN_LIMIT)
    const room = Math.max(0, Math.min(fan - out, RUN_LIMIT - born.length))
    // A question on the side answers itself. Sending work out of one would put
    // helpers on a thread nobody can see and nobody asked for work in.
    const canSend = prefs.on && !thread.aside && !thread.voice && (thread.depth ?? 0) < DEPTH_LIMIT
    const helperAccess = canSend || born.length > 0
    return {
      type: 'prompt',
      promptId: entry.promptId,
      agentId: agent.id,
      threadId: thread.id,
      text: this.buildPrompt(agent, entry, reactions),
      settings: thread.helperSettings ? { ...agent.settings, ...thread.helperSettings } : agent.settings,
      attachments: entry.attachments,
      designBoard: this.boardOf(thread),
      designBoards: this.referencedBoards(entry),
      ghost: this.ghostOf(thread.id) ? true : undefined,
      spawnRoom: canSend ? room : 0,
      spawnProviders: canSend ? this.spawnProviders() : undefined,
      helpers: helperAccess || undefined,
      tickets: thread.tickets,
      voice: thread.voice ? true : undefined,
      goal: entry.goal ? goalCondition(entry.text) || undefined : undefined,
      memories: this.memoryEnabled ? [...this.memories.values()] : undefined,
      plugins: this.plugins.size > 0 ? [...this.plugins.values()] : undefined,
      usePlugin: entry.plugin
    }
  }

  private finishPrompt(
    agent: AgentState,
    promptId: string,
    result: { ok: boolean; text?: string; error?: string }
  ): void {
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
    const run = agent.runs.get(promptId)
    agent.runs.delete(promptId)
    const stopped = this.stopping.delete(promptId) && !result.ok
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.end',
      promptId,
      agentId: agent.id,
      agentLabel: agent.label,
      threadId,
      ms: run ? Math.max(0, Date.now() - run.startedAt) : undefined,
      tokens: run && run.tokens > 0 ? run.tokens : undefined,
      cost: run?.cost ?? undefined,
      ...result,
      ...(stopped ? { error: 'Stopped', stopped: true } : {})
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
    // A run that fell over on its own goes to whoever the thread named, and the
    // thread moves with it. One hop per message: the retry carries a mark, so a
    // fallback that fails too is the end of it rather than a pair of agents
    // handing one message back and forth. A run somebody stopped never falls
    // over, since that was a decision rather than a fault, and a fallback nobody
    // is running takes nothing, or the message would sit at the head of the
    // queue holding up everything behind it.
    const entry = run?.entry
    const taker = thread?.fallbackId ? this.agents.get(thread.fallbackId) : undefined
    if (
      thread &&
      entry &&
      taker &&
      !result.ok &&
      !stopped &&
      !entry.fellBack &&
      taker.id !== agent.id &&
      (taker.runner || taker.dropTimer)
    ) {
      this.switchThreadAgent(thread, taker.id)
      thread.queue.unshift({ ...entry, promptId: randomUUID(), agentId: taker.id, fellBack: true })
      this.broadcastQueue(thread)
    }
    // Steers the run never acknowledged died with it, so give them a turn of
    // their own rather than losing them.
    const orphaned = this.steers.get(promptId) ?? []
    this.steers.delete(promptId)
    for (const steer of orphaned) this.requeueSteer(agent, steer)
    if (thread) this.runThread(thread)
    // A helper is back only once its thread has gone quiet with nothing behind
    // it. A turn that lands mid-queue is still the same piece of work.
    if (thread?.parentThreadId && !this.subagentRunning(thread)) {
      this.subagentReturn(
        thread,
        promptId,
        result.ok,
        result.text ?? result.error ?? '',
        stopped,
        run ? Math.max(0, Date.now() - run.startedAt) : undefined
      )
    }
    if (thread && this.ghostOf(thread.id)?.post && !this.subagentRunning(thread)) {
      const out = this.subagentThreads(thread.id).some(one => this.subagentRunning(one))
      if (!out) this.postReturn(thread, agent, result.text ?? '', { ok: result.ok, stopped })
    }
  }

  private postReturn(thread: Thread, agent: AgentState, text: string, run: { ok: boolean; stopped: boolean }): void {
    this.ghosts.delete(thread.id)
    this.threads.delete(thread.id)
    thread.queue = []
    if (run.stopped) return
    const said = run.ok ? text.trim() : ''
    if (!said) return
    this.emit({
      id: randomUUID(),
      ts: Date.now(),
      kind: 'message',
      authorId: agent.id,
      authorName: agent.label,
      text: said,
      mentions: [],
      ...this.refsOf(said),
      memberMentionRefs: this.memberRefs(said)
    })
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
    return this.events.filter((event): event is ReactionEvent => event.kind === 'message.reaction' && ids.has(event.id))
  }

  private threadContext(
    threadId: string,
    until = Infinity
  ): Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>> {
    return this.eventsOf(threadId)
      .filter(
        (e): e is Extract<SessionEvent, { kind: 'message' | 'agent.end' }> =>
          (e.kind === 'message' || e.kind === 'agent.end') && e.threadId === threadId && e.ts <= until
      )
      .slice(-CONTEXT_EVENT_LIMIT)
  }

  private forkThreadContext(
    threadId: string,
    until: number
  ): Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>> {
    const events = this.eventsOf(threadId)
    const ended = new Set(
      events
        .filter(event => event.kind === 'agent.end' && event.threadId === threadId && event.ts <= until)
        .map(event => event.promptId)
    )
    const unfinished = new Set(
      events
        .filter(
          event =>
            event.kind === 'agent.start' &&
            event.threadId === threadId &&
            event.ts <= until &&
            !ended.has(event.promptId)
        )
        .map(event => event.promptId)
    )
    const omitted = new Set(
      events
        .filter(
          event =>
            (event.kind === 'agent.start' && unfinished.has(event.promptId) && event.messageId !== undefined) ||
            (event.kind === 'message.route' &&
              event.threadId === threadId &&
              event.ts <= until &&
              unfinished.has(event.promptId))
        )
        .map(event => (event.kind === 'agent.start' ? event.messageId : event.messageId))
        .filter((messageId): messageId is string => messageId !== undefined)
    )
    return this.threadContext(threadId, until).filter(event => event.kind !== 'message' || !omitted.has(event.id))
  }

  // What a fork carries in from the thread it came from, and from whatever that
  // one came from. Each link is read up to the moment the fork under it was made,
  // so a fork of a fork reads the whole line it came down and none of what any of
  // those threads went on to do afterwards.
  private forkContext(thread: Thread | undefined): Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>> {
    const chain: Array<{ threadId: string; until: number }> = []
    let at = thread
    while (at?.forkedFrom && chain.length < FORK_DEPTH_LIMIT) {
      const from: string = at.forkedFrom
      chain.unshift({ threadId: from, until: at.forkedAt ?? Infinity })
      at = this.threads.get(from)
    }
    return chain.flatMap(link => this.forkThreadContext(link.threadId, link.until)).slice(-CONTEXT_EVENT_LIMIT)
  }

  private transcriptOf(context: Array<Extract<SessionEvent, { kind: 'message' | 'agent.end' }>>): string {
    return context
      .map(e => {
        if (e.kind === 'message') {
          const shared = (e.attachments ?? [])
            .map(a => `[${isImageType(a.mime) ? 'image' : 'file'}: ${a.name}]`)
            .join(' ')
          const reply = e.replyTo ? `, replying to ${e.replyTo.authorName}: ${JSON.stringify(e.replyTo.text)}` : ''
          return `${e.authorName}${reply}: ${[e.text, shared].filter(Boolean).join(' ')}`
        }
        if (e.ok && e.text) return `${e.agentLabel}: ${e.text}`
        const progress = this.unfinishedProgress(e)
        if (progress) {
          const ending = e.stopped ? 'was stopped before finishing' : `could not finish${e.error ? `: ${e.error}` : ''}`
          return `${e.agentLabel} ${ending}. Work already shown in that run:\n${progress}`
        }
        if (e.stopped) return `${e.agentLabel} was stopped before finishing.`
        return null
      })
      .filter(Boolean)
      .join('\n')
  }

  private unfinishedProgress(event: Extract<SessionEvent, { kind: 'agent.end' }>): string {
    if (event.ok || !event.threadId) return ''
    const parts: string[] = []
    const steps = this.eventsOf(event.threadId).filter(
      (candidate): candidate is Extract<SessionEvent, { kind: 'agent.step' }> =>
        candidate.kind === 'agent.step' && candidate.promptId === event.promptId
    )
    for (const { step } of steps) {
      if (step.kind === 'thinking') continue
      if (step.kind === 'text') {
        const text = step.text?.trim()
        if (text) parts.push(text)
        continue
      }
      const activity = [step.name, step.detail].filter(Boolean).join(': ')
      if (activity) parts.push(`[${step.kind === 'subagent' ? 'Helper' : 'Tool'}: ${activity}]`)
      const output = step.output?.trim()
      if (output) parts.push(`[Output: ${output.slice(-UNFINISHED_OUTPUT_LIMIT)}]`)
      if (step.files?.length) {
        parts.push(`[Files touched: ${step.files.map(file => `${file.path} (+${file.added} -${file.removed})`).join(', ')}]`)
      }
      if (step.todos?.length) {
        parts.push(`[Tasks: ${step.todos.map(todo => `${todo.status}: ${todo.text}`).join(' | ')}]`)
      }
    }
    const progress = parts.join('\n')
    if (progress.length <= UNFINISHED_PROGRESS_LIMIT) return progress
    return `[Earlier unfinished work omitted]\n${progress.slice(-UNFINISHED_PROGRESS_LIMIT)}`
  }

  private buildPrompt(agent: AgentState, prompt: QueuedPrompt, reactions: ReactionEvent[]): string {
    const people = [...this.members.values()].map(m => m.name).join(', ')
    const thread = this.threads.get(prompt.threadId)
    // A conversation on the side is about a thread it is not in, so it reads
    // that thread and then the talk beside it, as two blocks rather than one run
    // of lines.
    const beside = thread?.aside ? this.threadContext(thread.aside) : []
    // A fork is that conversation carrying on rather than one about it, so what
    // was said before it stands in the same run of talk as what has been said
    // since, and nothing anywhere says a fork was made.
    const own = [...this.forkContext(thread), ...this.threadContext(prompt.threadId)]
    const context = [...beside, ...own]
    const transcript = this.transcriptOf(own)
    const others = [...this.agents.values()].filter(a => a.id !== agent.id).map(a => a.label)
    // A helper sees its task and its own turns, and none of the room. It was
    // sent out on one piece of work by somebody who could see the room, and the
    // whole point of it is that it does not have to carry the rest.
    const lines = thread?.parentThreadId
      ? [
          `You are ${agent.label}, sent out as ${thread.helper ?? 'a helper'} on one piece of work in a crew session.`,
          `You share a project folder and can read and edit files in it.`,
          ``,
          SUBAGENT_INSTRUCTIONS
        ]
      : [
          `You are ${agent.label}, one of several agents in a crew session with ${people}.`,
          `You share a project folder and can read and edit files in it.`,
          ...(this.ghostOf(prompt.threadId)?.post
            ? []
            : [`You are in a focused thread. Only this thread's messages are shown here.`])
        ]
    if (others.length > 0 && !thread?.parentThreadId) {
      lines.push(
        `Other agents in the session: ${others.join(', ')}. A mention like @name in a thread hands that message to the named agent, so replies from several agents can appear here.`
      )
    }
    if (this.ghostOf(prompt.threadId)?.post) lines.push(``, POST_INSTRUCTIONS)
    if (thread?.voice) lines.push(``, VOICE_INSTRUCTIONS)
    if (thread?.aside) lines.push(``, ASIDE_INSTRUCTIONS)
    if (thread?.mode === 'plan') lines.push(``, PLAN_INSTRUCTIONS)
    else if (thread?.plan) lines.push(``, `The plan this thread agreed on:`, thread.plan)
    if (thread?.aside) {
      lines.push(``, `The thread, which you are not in:`, this.transcriptOf(beside) || '(nothing yet)')
      lines.push(``, `Your conversation on the side:`, transcript || '(nothing yet)')
    } else {
      lines.push(``, thread?.parentThreadId ? `Your work:` : `Thread so far:`, transcript || '(nothing yet)')
    }
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
    lines.push(
      ``,
      thread?.parentThreadId
        ? `Do the work above, then answer with what you found or what you changed.`
        : thread?.aside
          ? `Answer the last question from ${prompt.byName}.`
          : `Continue as ${agent.label}. Reply to the latest message from ${prompt.byName}.`
    )
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

  private docExcerpt(raw: string): string {
    const text = stripDocTableMarks(raw)
    if (text.length <= MAX_DOC_PROMPT_CHARS) return text
    return `${text.slice(0, MAX_DOC_PROMPT_CHARS)}\n[doc cut off here]`
  }

  private handleSettings(id: string, settings: AgentSettings): void {
    const agent = this.agents.get(id)
    if (!agent) return
    agent.settings = resolveSettings(agent.fields, { ...agent.settings, ...settings })
    const event: SessionEvent = {
      id: randomUUID(),
      ts: Date.now(),
      kind: 'agent.updated',
      agentId: id,
      settings: agent.settings
    }
    this.emit(event)
    if (agent.runner) this.send(agent.runner, { type: 'event', event })
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

  private handleMemberRename(member: Member, name: string): void {
    const wanted = cleanMemberName(name)
    if (!wanted || wanted === member.name) return
    const fromId = member.id
    const oldKey = member.name.toLowerCase()
    const key = wanted.toLowerCase()
    const existing = this.members.get(key)
    const target = existing && existing !== member ? existing : member

    if (target !== member) {
      for (const connection of member.connections) target.connections.add(connection)
      member.connections.clear()
      if (!target.avatar && member.avatar) target.avatar = member.avatar
      this.members.delete(oldKey)
    } else {
      this.members.delete(oldKey)
      this.members.set(key, member)
    }
    target.name = wanted

    for (const meta of this.meta.values()) {
      if (meta.memberKey === oldKey) meta.memberKey = key
    }
    for (const agent of this.agents.values()) {
      if (agent.ownerId !== fromId) continue
      agent.ownerId = target.id
      agent.ownerName = wanted
    }
    for (const thread of this.threads.values()) {
      for (const queued of thread.queue) {
        if (queued.authorId !== fromId) continue
        queued.authorId = target.id
        queued.byName = wanted
      }
    }
    for (const typist of this.typing.values()) {
      if (typist.id !== fromId) continue
      typist.id = target.id
      typist.name = wanted
    }
    for (const peer of this.huddle.values()) {
      if (peer.memberId !== fromId) continue
      peer.memberId = target.id
      peer.name = wanted
    }
    if (this.huddleNamed.delete(fromId)) this.huddleNamed.add(target.id)
    for (const board of this.designs.values()) {
      const presence = board.presence.get(fromId)
      if (!presence) continue
      board.presence.delete(fromId)
      board.presence.set(target.id, { ...presence, userId: target.id, name: wanted })
    }

    this.broadcast({
      type: 'member.renamed',
      fromId,
      member: { id: target.id, name: wanted, connected: target.connections.size > 0, avatar: target.avatar }
    })
    if (this.typing.size > 0) this.broadcastTyping()
    if (this.huddle.size > 0) this.broadcastHuddle()
    this.persistMeta()
  }

  // Your own face, and nobody else's: the message carries no id, so the only
  // member it can reach is the one who sent it. Taking the photo off puts back
  // the initial, which comes from the name.
  private handleMemberAvatar(member: Member, image: OutgoingAttachment | null): void {
    if (image) {
      const saved = this.savePhoto(image.mime, image.name, Buffer.from(image.data, 'base64'))
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
      const saved = this.savePhoto(image.mime, image.name, Buffer.from(image.data, 'base64'))
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
      this.deliverReturnsFor(existing.id)
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
    this.deliverReturnsFor(agent.id)
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
        cost: run.cost ?? undefined,
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
      this.stopTyping(ws)
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
    for (const [page, owner] of this.ghostDocOwners) {
      if (owner !== ws) continue
      this.ghostDocOwners.delete(page)
      this.docs.delete(page)
    }
  }

  // Why something did not happen, to the one who asked for it. It is a moment
  // rather than a record, so it goes to that window and no further: nothing is
  // written down, and nobody else scrolls past an answer to a question they
  // never asked.
  private notice(text: string, to: WebSocket): void {
    this.send(to, { type: 'notice', text })
  }

  // A message the host would not take is a message that never happened, so the
  // words go back in the box they were typed in rather than being spent on a
  // refusal. `where` is that box, the way typing names one.
  private refuse(text: string, to: WebSocket, where?: string): void {
    this.send(to, { type: 'notice', text, unsent: true, where })
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
      if (ghost.ws) this.send(ghost.ws, msg)
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

  liveThreads(): LiveThread[] {
    const running = new Set([...this.prompts.values()].map(prompt => prompt.threadId))
    return activeThreads(this.events, threadId => running.has(threadId))
  }

  private emit(event: SessionEvent, opts: { persist?: boolean; to?: WebSocket } = {}): void {
    this.onEvent?.(event)
    const ghost = this.ghostEventOf(event)
    if (ghost || opts.to) {
      ghost?.events.push(event)
      const to = opts.to ?? ghost?.ws
      if (to) this.send(to, { type: 'event', event })
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
    if (RESHAPES_THREADS.has(event.kind)) this.broadcastRunners({ type: 'event', event })
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

  private broadcastRunners(msg: ServerMessage): void {
    for (const [ws, meta] of this.meta) {
      if (meta.role === 'runner') this.send(ws, msg)
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
