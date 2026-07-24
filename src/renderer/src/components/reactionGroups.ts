import type { SessionEvent } from '../../../shared/events'
import type { ReactionEmoji } from '../../../shared/reactions'

export interface ReactionGroup {
  emoji: ReactionEmoji
  count: number
  names: string[]
  self: boolean
}

export function reactionGroups(events: SessionEvent[], selfId: string): Map<string, ReactionGroup[]> {
  const latest = new Map<string, Extract<SessionEvent, { kind: 'message.reaction' }>>()
  for (const event of events) {
    if (event.kind !== 'message.reaction') continue
    latest.set(JSON.stringify([event.targetId, event.memberId, event.emoji]), event)
  }
  const targets = new Map<string, Map<ReactionEmoji, Array<{ id: string; name: string }>>>()
  for (const event of latest.values()) {
    if (!event.active) continue
    const groups = targets.get(event.targetId) ?? new Map()
    const members = groups.get(event.emoji) ?? []
    members.push({ id: event.memberId, name: event.memberName })
    groups.set(event.emoji, members)
    targets.set(event.targetId, groups)
  }
  return new Map(
    [...targets].map(([targetId, groups]) => [
      targetId,
      [...groups].map(([emoji, members]) => ({
        emoji,
        count: members.length,
        names: members.map(member => member.name),
        self: members.some(member => member.id === selfId)
      }))
    ])
  )
}
