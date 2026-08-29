import type { SessionEvent } from './events'
import { stripMention } from './llm'

export interface LiveThread {
  id: string
  title: string
  working: boolean
  preview: {
    author: string
    text: string
  }
}

// Which events a thread is built from. Almost every one of them names the
// thread it happened on, and helper events are the exception: they
// name the helper's own thread and belong to the one that sent it out. Read
// the plain way, a chip lands inside the helper pointing at itself and never
// lands in the thread that has something to say about it, which is a spawn
// that leaves no mark on screen anywhere. The host reads it too, since what it
// hands back for one thread has to be what that thread is drawn from.
export const eventsOfThread = (events: SessionEvent[], threadId: string): SessionEvent[] =>
  events.filter(event =>
    event.kind === 'subagent.started' || event.kind === 'subagent.ended' || event.kind === 'subagent.said'
      ? event.parentThreadId === threadId
      : 'threadId' in event && event.threadId === threadId
  )

export const listTitle = (title: string): string => title.charAt(0).toUpperCase() + title.slice(1)

const liveTitle = (title: string, agentLabel: string): string =>
  listTitle(stripMention(title, agentLabel) || 'Untitled')

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

export function activeThreads(events: SessionEvent[], working: (threadId: string) => boolean): LiveThread[] {
  const open = new Map<
    string,
    { title: string; agentLabel: string; at: number; preview: LiveThread['preview'] }
  >()
  const messages = new Map<string, Extract<SessionEvent, { kind: 'message' }>>()
  for (const event of events) {
    switch (event.kind) {
      case 'message':
        messages.set(event.id, event)
        break
      case 'thread.started':
        if (event.parentThreadId || event.aside) break
        open.set(event.threadId, {
          title: event.title,
          agentLabel: event.agentLabel,
          at: event.ts,
          preview: { author: event.byName, text: event.title }
        })
        break
      case 'thread.archived':
        open.delete(event.threadId)
        break
      case 'thread.status':
        if (event.status === 'open') break
        open.delete(event.threadId)
        break
      case 'thread.renamed': {
        const thread = open.get(event.threadId)
        if (thread) thread.title = event.title
        break
      }
      case 'thread.deleted':
        open.delete(event.threadId)
        break
      case 'agent.start': {
        if (!event.threadId) break
        const thread = open.get(event.threadId)
        if (thread) thread.preview = { author: event.byName, text: event.promptText }
        break
      }
      case 'agent.end': {
        if (!event.threadId) break
        const thread = open.get(event.threadId)
        const text = event.ok ? event.text?.trim() : event.error?.trim()
        if (thread && text) thread.preview = { author: event.agentLabel, text }
        break
      }
      case 'message.route': {
        const thread = open.get(event.threadId)
        const message = messages.get(event.messageId)
        if (thread && message) {
          thread.preview = {
            author: message.authorName,
            text: message.text.trim() || (message.attachments?.length ? 'Attachments' : thread.preview.text)
          }
        }
        break
      }
    }
    const stirred = stirs(event)
    const thread = stirred ? open.get(stirred) : undefined
    if (thread) thread.at = event.ts
  }
  return [...open]
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([id, thread]) => ({
      id,
      title: liveTitle(thread.title, thread.agentLabel),
      working: working(id),
      preview: thread.preview
    }))
}
