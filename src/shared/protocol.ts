import type { Attachment, OutgoingAttachment } from './attachments'
import type { DesignBoardMeta, DesignDocument, DesignPresence } from './design'
import type { DocPage } from './docs'
import type { SessionEvent, ThreadStatus, Todo } from './events'
import type { AgentSettingField, AgentSettings, AgentStep, AgentUsage, PooledAgent, RunStep } from './llm'

export interface RegisteredLlm {
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
  boards?: DesignBoardMeta[]
}

export type ClientMessage =
  | { type: 'hello'; role: 'ui'; name: string; code: string }
  | { type: 'hello'; role: 'runner'; name: string; code: string; llms: RegisteredLlm[]; running?: string[] }
  | {
      type: 'chat.send'
      text: string
      mentions: string[]
      threadId?: string
      attachments?: OutgoingAttachment[]
      boardId?: string
    }
  | { type: 'chat.delete'; messageId: string }
  | { type: 'thread.archive'; threadId: string }
  | { type: 'thread.status'; threadId: string; status: ThreadStatus }
  | { type: 'todo.add'; text: string; agentId?: string }
  | { type: 'todo.edit'; todoId: string; text: string; agentId?: string }
  | { type: 'todo.remove'; todoId: string }
  | { type: 'todo.check'; todoId: string; checked: boolean }
  | { type: 'todo.do'; todoId: string; agentId?: string }
  | { type: 'doc.update'; page: string; text: string; title?: string }
  | { type: 'doc.title'; page: string; title: string }
  | { type: 'doc.retitle'; page: string; title: string }
  | { type: 'doc.rename'; from: string; to: string; title?: string }
  | { type: 'doc.delete'; page: string }
  | { type: 'queue.edit'; promptId: string; text: string }
  | { type: 'queue.remove'; promptId: string }
  | { type: 'prompt.cancel'; promptId: string }
  | { type: 'agent.settings'; agentId: string; settings: AgentSettings }
  | { type: 'agent.register'; llm: RegisteredLlm }
  | { type: 'agent.deregister'; instanceId: string }
  | { type: 'agent.step'; promptId: string; step: RunStep }
  | { type: 'agent.usage'; instanceId: string; usage: AgentUsage }
  | { type: 'agent.tokens'; promptId: string; tokens: number }
  | { type: 'agent.steered'; promptId: string; ok: boolean }
  | { type: 'agent.done'; promptId: string; text: string }
  | { type: 'agent.error'; promptId: string; message: string }

export type ServerMessage =
  | { type: 'welcome'; selfId: string; snapshot: SessionSnapshot }
  | { type: 'event'; event: SessionEvent }
  | { type: 'queue.state'; threadId: string; items: QueuedItem[] }
  | { type: 'agent.added'; agent: PooledAgent }
  | { type: 'agent.removed'; agentId: string }
  | { type: 'agent.step'; promptId: string; agentId: string; threadId: string; step: AgentStep }
  | { type: 'agent.usage'; agentId: string; usage: AgentUsage }
  | { type: 'agent.tokens'; promptId: string; agentId: string; threadId: string; tokens: number }
  | {
      type: 'prompt'
      promptId: string
      agentId: string
      threadId: string
      text: string
      settings: AgentSettings
      attachments?: Attachment[]
    }
  | { type: 'steer'; promptId: string; text: string; byName: string; attachments?: Attachment[] }
  | { type: 'cancel'; promptId: string }
  | { type: 'ping' }
  | { type: 'error'; message: string }
