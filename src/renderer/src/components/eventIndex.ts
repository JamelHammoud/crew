import { isImageType, type Attachment } from '../../../shared/attachments'
import type { SessionEvent } from '../../../shared/events'
import { messageReactionTarget } from '../../../shared/reactions'

type AgentEnd = Extract<SessionEvent, { kind: 'agent.end' }>

export interface EventIndex {
  replyAttachments: Map<string, Attachment>
  lastEnds: Map<string, AgentEnd>
  helperParents: Set<string>
  runsByThread: Map<string, string[]>
}

const held = new WeakMap<SessionEvent[], EventIndex>()

const build = (events: SessionEvent[]): EventIndex => {
  const replyAttachments = new Map<string, Attachment>()
  const lastEnds = new Map<string, AgentEnd>()
  const helperParents = new Set<string>()
  for (const event of events) {
    if (event.kind === 'message') {
      const target = messageReactionTarget(event.id)
      const carried = event.attachments
      if (!carried || carried.length === 0) replyAttachments.delete(target)
      else replyAttachments.set(target, carried.find(one => isImageType(one.mime)) ?? carried[0])
      continue
    }
    if (event.kind === 'agent.end' && event.threadId) lastEnds.set(event.threadId, event)
    if (event.kind === 'subagent.started') helperParents.add(event.parentThreadId)
  }
  return { replyAttachments, lastEnds, helperParents }
}

export function eventIndex(events: SessionEvent[]): EventIndex {
  const known = held.get(events)
  if (known) return known
  const made = build(events)
  held.set(events, made)
  return made
}
