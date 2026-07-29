import type { Attachment, OutgoingAttachment } from './attachments'
import type { CommandName } from './commands'
import type { DesignBoardMeta, DesignDocument, DesignPresence } from './design'
import type { DocPage } from './docs'
import type { SessionEvent, ThreadStatus, Todo } from './events'
import type { GameScore } from './games'
import type { HuddleRoom, HuddleSignal } from './huddle'
import type { AgentSettingField, AgentSettings, AgentStep, AgentUsage, PooledAgent, RunStep } from './llm'
import type { MusicPlaylist, MusicRoom, MusicUpload } from './music'
import type { ReactionEmoji } from './reactions'
import type { TicketEvent } from './tickets'
import type { CrewTool, ToolAction } from './toolbox'

export interface RegisteredLlm {
  // Absent only from machines running an older build, which have no minted id
  // yet; the host falls back to the owner name for those.
  id?: string
  instanceId: string
  provider: string
  label: string
  fields: AgentSettingField[]
  settings: AgentSettings
  steerable?: boolean
}

export interface MemberInfo {
  id: string
  name: string
  connected: boolean
  // The file a photo was saved under, absent for someone who has not put one on
  // and is still drawn as their initial.
  avatar?: string
}

export interface QueuedItem {
  promptId: string
  authorId: string
  authorName: string
  text: string
  agentId: string
  agentLabel: string
}

export interface SessionSnapshot {
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  docs: Record<string, DocPage>
  queues: Record<string, QueuedItem[]>
  todos: Todo[]
  // What every agent has said about its own work. A board is folded off these
  // rather than scrolled past in the chat, so they ride here as their own list
  // the way the todos and the shelf do, and are left out of the events above.
  // Without this a window that reloads finds every board empty.
  tickets?: TicketEvent[]
  // Absent from a host running an older build, which has no toolbox to send.
  tools?: CrewTool[]
  boards?: DesignBoardMeta[]
  // A call lives only as long as the people in it, so it rides in the snapshot
  // and never in the event log.
  huddle?: HuddleRoom
  // What is playing, for the same reason.
  music?: MusicRoom
  // What the crew has put on the shelf itself. Unlike the room, this lasts.
  musicUploads?: MusicUpload[]
  // The lists people have written for themselves. These last too.
  musicPlaylists?: MusicPlaylist[]
  // Everyone's best at each game, which lasts longest of all.
  gameScores?: GameScore[]
  // Whether the log holds anything older than the events here. Absent from a
  // host running an older build, which has nothing older to hand over, so
  // nobody is offered a way back into history that host cannot serve.
  moreEvents?: boolean
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[]; running?: string[] }
  | { type: 'member.avatar'; image: OutgoingAttachment | null }
  | {
      type: 'chat.send'
      text: string
      mentions: string[]
      commands?: CommandName[]
      threadId?: string
      attachments?: OutgoingAttachment[]
      boardId?: string
      replyTo?: string
    }
  | { type: 'history'; before: string }
  | { type: 'chat.delete'; messageId: string }
  | { type: 'chat.edit'; messageId: string; text: string }
  | { type: 'chat.react'; targetId: string; emoji: ReactionEmoji }
  | { type: 'thread.archive'; threadId: string }
  | { type: 'thread.status'; threadId: string; status: ThreadStatus }
  | { type: 'plan.implement'; threadId: string }
  | { type: 'todo.add'; text: string; agentId?: string }
  | { type: 'todo.edit'; todoId: string; text: string; agentId?: string }
  | { type: 'todo.remove'; todoId: string }
  | { type: 'todo.check'; todoId: string; checked: boolean }
  | { type: 'todo.do'; todoId: string; agentId?: string }
  | { type: 'tool.add'; name: string; mark: string; action: ToolAction }
  | { type: 'tool.edit'; toolId: string; name: string; mark: string; action: ToolAction }
  | { type: 'tool.remove'; toolId: string }
  | { type: 'subagent.stop'; threadId: string }
  // What one person lets helpers do on their own machine. It is kept in that
  // window's own storage and said again on every connect, the way the volume is
  // kept, except this one has to reach the host to be worth anything.
  | { type: 'subagent.prefs'; on: boolean; fan: number }
  | { type: 'doc.update'; page: string; text: string; title?: string }
  | { type: 'doc.title'; page: string; title: string }
  | { type: 'doc.retitle'; page: string; title: string }
  | { type: 'doc.rename'; from: string; to: string; title?: string }
  | { type: 'doc.delete'; page: string }
  | { type: 'design.create'; boardId: string; name: string }
  | { type: 'design.rename'; boardId: string; name: string }
  | { type: 'design.delete'; boardId: string }
  | { type: 'design.open'; boardId: string }
  | { type: 'design.peek'; boardId: string }
  | { type: 'design.init'; boardId: string; document: DesignDocument }
  | { type: 'design.apply'; boardId: string; put?: unknown[]; remove?: string[] }
  | {
      type: 'design.presence'
      boardId: string
      cursor: { x: number; y: number } | null
      selection: string[]
      pageId: string | null
    }
  | { type: 'huddle.join'; peerId: string; muted: boolean; camera: boolean }
  | { type: 'huddle.leave' }
  | { type: 'huddle.update'; muted?: boolean; camera?: boolean; sharing?: boolean }
  | { type: 'huddle.signal'; to: string; signal: HuddleSignal }
  | { type: 'huddle.delete'; huddleId: string }
  | { type: 'music.set'; trackId: string; playing: boolean; at: number; playlistId?: string | null }
  | { type: 'music.off' }
  | { type: 'music.loop'; loop: boolean }
  | { type: 'music.add'; name: string; mime: string; seconds: number; data: string }
  | { type: 'music.remove'; trackId: string }
  | { type: 'playlist.add'; name: string; playlistId?: string }
  | { type: 'playlist.remove'; playlistId: string }
  | { type: 'playlist.rename'; playlistId: string; name: string }
  | { type: 'playlist.track'; playlistId: string; trackId: string; on: boolean }
  | { type: 'game.score'; gameId: string; score: number }
  | { type: 'queue.edit'; promptId: string; text: string }
  | { type: 'queue.remove'; promptId: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.rename'; agentId: string; label: string }
  | { type: 'agent.avatar'; agentId: string; image: OutgoingAttachment | null }
  | { type: 'agent.remove'; agentId: string }
  | { type: 'agent.register'; llm: RegisteredLlm }
  | { type: 'agent.deregister'; agentId: string }
  | { type: 'agent.step'; promptId: string; step: RunStep }
  | { type: 'agent.usage'; agentId: string; usage: AgentUsage }
  | { type: 'agent.tokens'; promptId: string; tokens: number; cost?: number }
  | { type: 'agent.steered'; promptId: string; ok: boolean }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
  | { type: 'history'; events: SessionEvent[]; more: boolean }
  | { type: 'member.avatar'; memberId: string; file: string | null }
  | { type: 'queue.state'; threadId: string; items: QueuedItem[] }
  | { type: 'agent.added'; agent: PooledAgent }
  | { type: 'agent.removed'; agentId: string }
  | { type: 'agent.renamed'; agentId: string; label: string }
  | { type: 'agent.avatar'; agentId: string; file: string | null }
  | { type: 'agent.step'; promptId: string; agentId: string; threadId: string; step: AgentStep }
  | { type: 'agent.usage'; agentId: string; usage: AgentUsage }
  | { type: 'agent.tokens'; promptId: string; agentId: string; threadId: string; tokens: number; cost?: number }
  | { type: 'huddle.room'; room: HuddleRoom }
  | { type: 'huddle.signal'; from: string; signal: HuddleSignal }
  | { type: 'music.room'; room: MusicRoom }
  | { type: 'music.shelf'; uploads: MusicUpload[] }
  | { type: 'music.playlists'; playlists: MusicPlaylist[] }
  | { type: 'game.scores'; scores: GameScore[] }
  | { type: 'design.boards'; boards: DesignBoardMeta[] }
  | {
      type: 'design.snapshot'
      boardId: string
      name: string
      document: DesignDocument | null
      presence: DesignPresence[]
    }
  | { type: 'design.preview'; boardId: string; document: DesignDocument | null }
  | { type: 'design.changes'; boardId: string; put?: unknown[]; remove?: string[] }
  | { type: 'design.presence'; boardId: string; presence: DesignPresence }
  | {
      type: 'prompt'
      promptId: string
      agentId: string
      threadId: string
      text: string
      settings: AgentSettings
      attachments?: Attachment[]
      designBoard?: DesignBoardMeta
      designBoards?: DesignBoardMeta[]
      // A picture in a ghost thread is never kept beside the session, so the
      // machine running it says where it may put one.
      ghost?: boolean
      // How many helpers this run may still have going at once, and the CLIs it
      // could put one on. The machine turns those into the words about helpers,
      // because it is the side that knows the address they are reached at.
      spawnRoom?: number
      spawnProviders?: string[]
      // Whether this thread keeps a board. The machine turns it into the words
      // about one for the same reason: the board is reached over http, and only
      // that side knows the address.
      tickets?: boolean
    }
  | {
      type: 'steer'
      promptId: string
      text: string
      byName: string
      attachments?: Attachment[]
      ghost?: boolean
      // A helper coming back rather than somebody talking. The host has already
      // written the whole of what to read, so the machine hands it over as it
      // stands instead of framing it under a name.
      from?: { kind: 'subagent' }
    }
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  // A word to the one person it is about, and nothing anybody has to scroll past
  // later: it is never written down and never reaches anyone else.
  | { type: 'notice'; text: string }
  | { type: 'error'; message: string }
