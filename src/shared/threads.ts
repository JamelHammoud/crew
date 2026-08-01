import type { SessionEvent } from './events'
import { stripMention } from './llm'

export interface LiveThread {
  id: string
  title: string
  working: boolean
}

export const THREAD_LIMIT = 6

const liveTitle = (title: string, agentLabel: string): string => {
  const clean = stripMention(title, agentLabel) || 'Untitled'
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export function activeThreads(
  events: SessionEvent[],
  working: (threadId: string) => boolean
): LiveThread[] {
  const open = new Map<string, { title: string; agentLabel: string }>()
  for (const event of events) {
    switch (event.kind) {
      case 'thread.started':
        if (event.parentThreadId || event.aside) break
        open.set(event.threadId, { title: event.title, agentLabel: event.agentLabel })
        break
      case 'thread.archived':
        open.delete(event.threadId)
        break
      case 'thread.status':
        if (event.status === 'open') break
        open.delete(event.threadId)
        break
    }
  }
  return [...open]
    .reverse()
    .slice(0, THREAD_LIMIT)
    .map(([id, thread]) => ({ id, title: liveTitle(thread.title, thread.agentLabel), working: working(id) }))
}
