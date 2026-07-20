import type { SessionEvent } from '../../../shared/events'

export interface ThreadItem {
  key: string
  ts: number
  kind: 'message' | 'reply' | 'note'
  author: string
  self: boolean
  text: string
  streaming: boolean
  promptId?: string
  agentId?: string
  error?: string
}

export function buildThread(events: SessionEvent[], streams: Record<string, string>, selfId: string): ThreadItem[] {
  const ended = new Set(events.filter(e => e.kind === 'agent.end').map(e => e.promptId))
  const items: ThreadItem[] = []
  for (const event of events) {
    if (event.kind === 'message') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: event.authorId === 'crew' ? 'note' : 'message',
        author: event.authorName,
        self: event.authorId === selfId,
        text: event.text,
        streaming: false
      })
    }
    if (event.kind === 'agent.start' && !ended.has(event.promptId)) {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'reply',
        author: event.agentLabel,
        self: false,
        text: streams[event.promptId] ?? '',
        streaming: true,
        promptId: event.promptId,
        agentId: event.agentId
      })
    }
    if (event.kind === 'agent.end') {
      items.push({
        key: event.id,
        ts: event.ts,
        kind: 'reply',
        author: event.agentLabel,
        self: false,
        text: event.ok ? (event.text ?? '') : (event.error ?? 'Something went wrong.'),
        streaming: false,
        error: event.ok ? undefined : (event.error ?? 'error')
      })
    }
  }
  return items
}
