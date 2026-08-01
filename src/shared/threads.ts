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

// What counts as something happening in a thread: a run starting or ending in
// it, and a message landing in it. A step is left out on purpose, since a run
// already put its thread at the top and the next one is a few hundred
// milliseconds away.
const stirs = (event: SessionEvent): string | undefined => {
  switch (event.kind) {
    case 'agent.start':
    case 'agent.end':
    case 'message.route':
      return event.threadId
    default:
      return undefined
  }
}

export function activeThreads(
  events: SessionEvent[],
  working: (threadId: string) => boolean
): LiveThread[] {
  const open = new Map<string, { title: string; agentLabel: string; at: number }>()
  for (const event of events) {
    switch (event.kind) {
      case 'thread.started':
        if (event.parentThreadId || event.aside) break
        open.set(event.threadId, { title: event.title, agentLabel: event.agentLabel, at: event.ts })
        break
      case 'thread.archived':
        open.delete(event.threadId)
        break
      case 'thread.status':
        if (event.status === 'open') break
        open.delete(event.threadId)
        break
    }
    const stirred = stirs(event)
    const thread = stirred ? open.get(stirred) : undefined
    if (thread && event.ts > thread.at) thread.at = event.ts
  }
  return [...open]
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, THREAD_LIMIT)
    .map(([id, thread]) => ({ id, title: liveTitle(thread.title, thread.agentLabel), working: working(id) }))
}
