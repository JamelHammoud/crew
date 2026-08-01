import type { SessionEvent } from './events'

export interface LiveThread {
  id: string
  title: string
  working: boolean
}

export const THREAD_LIMIT = 6

export function activeThreads(
  events: SessionEvent[],
  working: (threadId: string) => boolean
): LiveThread[] {
  const open = new Map<string, string>()
  for (const event of events) {
    switch (event.kind) {
      case 'thread.started':
        if (event.parentThreadId || event.aside) break
        open.set(event.threadId, event.title)
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
    .map(([id, title]) => ({ id, title, working: working(id) }))
}
