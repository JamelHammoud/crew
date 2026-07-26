import type { SessionEvent } from '../../../../shared/events'

// What the chat knows about a call: who started it, everyone who came, and how
// long it ran. `ms` is null while it is still going.
export interface HuddleRecord {
  id: string
  ts: number
  by: string
  byId: string
  names: string[]
  ms: number | null
}

export function huddleRecords(events: SessionEvent[]): Map<string, HuddleRecord> {
  const records = new Map<string, HuddleRecord>()
  for (const event of events) {
    if (event.kind === 'huddle.started') {
      records.set(event.huddleId, {
        id: event.huddleId,
        ts: event.ts,
        by: event.byName,
        names: [event.byName],
        ms: null
      })
      continue
    }
    if (event.kind === 'huddle.joined') {
      const record = records.get(event.huddleId)
      if (record && !record.names.includes(event.name)) record.names.push(event.name)
      continue
    }
    if (event.kind === 'huddle.ended') {
      const record = records.get(event.huddleId)
      if (record) record.ms = event.ms
    }
  }
  return records
}

export function nameList(names: string[], max = 3): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const rest = names.length - max
  return `${names.slice(0, max).join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`
}
