import type { Attachment, OutgoingAttachment } from './attachments'
import type { CommandName } from './commands'
import type { CustomEmoji } from './customEmoji'
import type { DesignBoardMeta, DesignDocument, DesignPresence } from './design'
import type { DocPage, DocScope } from './docs'
import type { MessageReply, SessionEvent, ThreadStatus, Todo } from './events'
import type { GameScore } from './games'
import type { HuddleRoom, HuddleSignal } from './huddle'
import type { AgentSettingField, AgentSettings, AgentStep, AgentUsage, PooledAgent, RunStep } from './llm'
import type { CrewMemory } from './memory'
import type { MusicPlaylist, MusicRoom, MusicUpload } from './music'
import type { CrewPlugin } from './plugins'
import type { ReactionEmoji } from './reactions'
import type { Schedule } from './schedules'
import type { TicketEvent } from './tickets'
import type { CrewTool, ToolAction } from './toolbox'
import type { Typist } from './typing'

// A message carries its files inside it, as text, so how big a frame may be is
// how big an attachment may be. `ws` caps a frame at a hundred megabytes of its
// own accord, which turned every size in the picker past that into a socket
// closing mid-send. Half a gigabyte is the real ceiling either way: base64 makes
// a file a third longer again, and a string longer than this is one V8 cannot
// hold, so nothing here could read the frame even if it arrived.
export const MAX_FRAME_BYTES = 512 * 1024 * 1024

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
  attachments?: Attachment[]
  replyTo?: MessageReply
}

export interface SessionSnapshot {
  code: string
  members: MemberInfo[]
  agents: PooledAgent[]
  events: SessionEvent[]
  threadEvents?: SessionEvent[]
  threadPrompts?: Record<string, string>
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
  memories?: CrewMemory[]
  memoryEnabled?: boolean
  plugins?: CrewPlugin[]
  schedules?: Schedule[]
  // How big a file the crew may send, in megabytes. Absent from a host running
  // an older build, whose limit is the one this shipped with.
  attachmentMb?: number
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
  // The emoji the crew drew themselves. They last, so they ride here the way the
  // shelf does rather than being scrolled past in the chat.
  emoji?: CustomEmoji[]
  // Whether the log holds anything older than the events here. Absent from a
  // host running an older build, which has nothing older to hand over, so
  // nobody is offered a way back into history that host cannot serve.
  moreEvents?: boolean
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[]; running?: string[] }
  | { type: 'member.rename'; name: string }
  | { type: 'member.avatar'; image: OutgoingAttachment | null }
  | {
      type: 'chat.send'
      text: string
      mentions: string[]
      commands?: CommandName[]
      threadId?: string
      startId?: string
      attachments?: OutgoingAttachment[]
      boardId?: string
      replyTo?: string
      // The id a fork is asked for under, so the window that made it opens it the
      // moment it lands rather than guessing which new thread was its own.
      forkId?: string
      // A plugin picked for this one message, by name. It is about the message
      // being written rather than a standing choice, so it goes out beside the
      // words and is never read back out of them.
      usePlugin?: string
    }
  | { type: 'chat.post'; text: string; agentId?: string }
  | { type: 'history'; before: string }
  // Everything one thread said. A window holds the tail of the log, so a thread
  // opened long after it ran has none of its own events left to draw from,
  // while the rail still lists it and the card still stands in the chat.
  | { type: 'thread.history'; threadId: string }
  // Said again every couple of seconds while somebody is still writing, and once
  // with `on` false the moment they stop or send.
  | { type: 'typing'; where?: string; on: boolean }
  | { type: 'chat.delete'; messageId: string }
  | { type: 'chat.edit'; messageId: string; text: string }
  | { type: 'chat.react'; targetId: string; emoji: ReactionEmoji }
  | { type: 'thread.archive'; threadId: string }
  | { type: 'thread.status'; threadId: string; status: ThreadStatus }
  | { type: 'thread.rename'; threadId: string; title: string }
  | { type: 'thread.delete'; threadId: string }
  | { type: 'thread.retry'; threadId: string }
  | { type: 'plan.implement'; threadId: string }
  | { type: 'todo.add'; text: string; agentId?: string }
  | { type: 'todo.edit'; todoId: string; text: string; agentId?: string }
  | { type: 'todo.remove'; todoId: string }
  | { type: 'todo.check'; todoId: string; checked: boolean }
  | { type: 'todo.do'; todoId: string; agentId?: string }
  | { type: 'tool.add'; name: string; mark: string; action: ToolAction }
  | { type: 'tool.edit'; toolId: string; name: string; mark: string; action: ToolAction }
  | { type: 'tool.remove'; toolId: string }
  | { type: 'memory.add'; text: string }
  | { type: 'memory.edit'; memoryId: string; text: string }
  | { type: 'memory.remove'; memoryId: string }
  | { type: 'memory.set'; enabled: boolean }
  | { type: 'plugin.add'; plugin: unknown; requestId?: string }
  | { type: 'plugin.remove'; pluginId: string }
  | { type: 'schedule.add'; name: string; mark: string; when: unknown; action: ToolAction; zone: string }
  | {
      type: 'schedule.edit'
      scheduleId: string
      name: string
      mark: string
      when: unknown
      action: ToolAction
      zone: string
    }
  | { type: 'schedule.remove'; scheduleId: string }
  | { type: 'schedule.pause'; scheduleId: string; paused: boolean }
  | { type: 'schedule.run'; scheduleId: string }
  | { type: 'attachment.limit'; mb: number }
  | { type: 'subagent.stop'; threadId: string }
  | { type: 'subagent.restart'; threadId: string }
  // What one person lets helpers do on their own machine. It is kept in that
  // window's own storage and said again on every connect, the way the volume is
  // kept, except this one has to reach the host to be worth anything.
  | { type: 'subagent.prefs'; on: boolean; fan: number }
  | { type: 'doc.update'; page: string; text: string; title?: string; scope?: DocScope }
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
  | { type: 'emoji.add'; name: string; mime: string; data: string }
  | { type: 'emoji.rename'; emojiId: string; name: string }
  | { type: 'emoji.remove'; emojiId: string }
  | { type: 'game.score'; gameId: string; score: number }
  | { type: 'queue.edit'; promptId: string; text: string }
  | { type: 'queue.remove'; promptId: string }
  | { type: 'queue.send'; promptId: string }
  | { type: 'queue.take'; promptId: string }
  | { type: 'queue.move'; promptId: string; to: number }
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
  // One thread read back out of the log, for the one window that asked. It is
  // kept beside the window's own events rather than folded into them, or a
  // thread from months ago would stand at the head of today's chat.
  | { type: 'thread.history'; threadId: string; events: SessionEvent[] }
  | { type: 'member.renamed'; fromId: string; member: MemberInfo }
  | { type: 'member.avatar'; memberId: string; file: string | null }
  | { type: 'queue.state'; threadId: string; items: QueuedItem[] }
  | {
      type: 'queue.taken'
      threadId: string
      item: QueuedItem
      attachments: OutgoingAttachment[]
    }
  | { type: 'queue.take.failed'; promptId: string; message: string }
  | { type: 'agent.added'; agent: PooledAgent }
  | { type: 'agent.removed'; agentId: string }
  | { type: 'agent.renamed'; agentId: string; label: string }
  | { type: 'agent.avatar'; agentId: string; file: string | null }
  | { type: 'agent.step'; promptId: string; agentId: string; threadId: string; step: AgentStep }
  | { type: 'agent.usage'; agentId: string; usage: AgentUsage }
  | { type: 'agent.tokens'; promptId: string; agentId: string; threadId: string; tokens: number; cost?: number }
  | { type: 'typing.room'; typists: Typist[] }
  | { type: 'huddle.room'; room: HuddleRoom }
  | { type: 'huddle.signal'; from: string; signal: HuddleSignal }
  | { type: 'music.room'; room: MusicRoom }
  | { type: 'music.shelf'; uploads: MusicUpload[] }
  | { type: 'music.playlists'; playlists: MusicPlaylist[] }
  | { type: 'emoji.set'; emoji: CustomEmoji[] }
  | { type: 'game.scores'; scores: GameScore[] }
  | { type: 'plugin.result'; requestId: string; ok: boolean; message?: string }
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
      helpers?: boolean
      // Whether this thread keeps a board. The machine turns it into the words
      // about one for the same reason: the board is reached over http, and only
      // that side knows the address.
      tickets?: boolean
      goal?: string
      memories?: CrewMemory[]
      plugins?: CrewPlugin[]
      // Which of them this message was assigned to. The machine turns it into
      // the words about it, since the plugins are already handed over here.
      usePlugin?: string
      // Somebody is sitting in silence waiting for this one to say its first
      // word, so the machine does not hold it behind a sync pass.
      voice?: boolean
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
  // later: it is never written down and never reaches anyone else. `unsent` says
  // the message it is about never happened, so what was typed goes back in the
  // box it was typed in, which `where` names the way typing does: a thread's id
  // or a board's id, and absent for the chat itself.
  | { type: 'notice'; text: string; unsent?: true; where?: string }
  | { type: 'error'; message: string }
