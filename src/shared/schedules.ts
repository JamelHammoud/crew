import { cleanTool, NAME_LIMIT, type ToolAction } from './toolbox'

export interface Schedule {
  id: string
  name: string
  mark: string
  when: Cadence
  action: ToolAction
  zone: string
  paused?: boolean
  createdBy: string
  ts: number
  lastRunAt?: number
  lastThreadId?: string
}

export type Cadence =
  | { kind: 'every'; minutes: number }
  | { kind: 'daily'; at: number }
  | { kind: 'weekly'; days: number[]; at: number }
  | { kind: 'monthly'; day: number; at: number }

export const SCHEDULE_LIMIT = 40
export const EVERY_MIN = 15
export const EVERY_MAX = 60 * 24 * 7
export const DAY_MINUTES = 60 * 24

export const SCHEDULE_FULL = `The crew has as many scheduled tasks as it can hold. Take one out before adding another.`

// A tool is pressed by somebody, so it may open a page, a terminal or a file on
// the screen they are standing at. A schedule has nobody standing anywhere: it
// fires on the host at four in the morning with every window shut. So the ones
// that can be scheduled are the ones that are the crew's rather than a machine's,
// and everything else is refused rather than firing into nothing.
export const SCHEDULABLE = ['prompt', 'say', 'todo', 'note', 'music', 'chain'] as const

export const schedulable = (action: ToolAction): boolean =>
  (SCHEDULABLE as readonly string[]).includes(action?.kind)

const whole = (raw: unknown, low: number, high: number): number | null => {
  const n = typeof raw === 'number' ? Math.floor(raw) : NaN
  return Number.isFinite(n) && n >= low && n <= high ? n : null
}

// A zone is only ever used to say where a wall clock is read, so one this
// machine cannot read is the machine's own rather than a schedule that throws
// every time it is asked when it next runs.
export const cleanZone = (raw: unknown): string => {
  const zone = typeof raw === 'string' ? raw.trim().slice(0, 64) : ''
  if (!zone) return here()
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return zone
  } catch {
    return here()
  }
}

export const here = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function cleanCadence(raw: unknown): Cadence | null {
  const when = raw as Cadence
  if (when?.kind === 'every') {
    const minutes = whole(when.minutes, EVERY_MIN, EVERY_MAX)
    return minutes === null ? null : { kind: 'every', minutes }
  }
  if (when?.kind === 'daily') {
    const at = whole(when.at, 0, DAY_MINUTES - 1)
    return at === null ? null : { kind: 'daily', at }
  }
  if (when?.kind === 'weekly') {
    const at = whole(when.at, 0, DAY_MINUTES - 1)
    const list = Array.isArray(when.days) ? when.days : []
    const days = [...new Set(list.map(d => whole(d, 0, 6)).filter((d): d is number => d !== null))].sort()
    return at === null || days.length === 0 ? null : { kind: 'weekly', days, at }
  }
  if (when?.kind === 'monthly') {
    const at = whole(when.at, 0, DAY_MINUTES - 1)
    const day = whole(when.day, 1, 28)
    return at === null || day === null ? null : { kind: 'monthly', day, at }
  }
  return null
}

// What arrives over the wire is whatever the other end sent. One with no name,
// nothing to do, or nothing to say about when, is not a schedule and comes back
// as null rather than as a row that sits there never firing.
export function cleanSchedule(
  name: string,
  mark: string,
  when: unknown,
  action: ToolAction,
  zone: unknown
): { name: string; mark: string; when: Cadence; action: ToolAction; zone: string } | null {
  const cadence = cleanCadence(when)
  if (!cadence) return null
  if (!schedulable(action)) return null
  const tool = cleanTool(name, mark, action)
  if (!tool) return null
  return { name: tool.name, mark: tool.mark, when: cadence, action: tool.action, zone: cleanZone(zone) }
}

interface Wall {
  y: number
  m: number
  d: number
  hh: number
  mm: number
  weekday: number
}

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const readers = new Map<string, Intl.DateTimeFormat>()

const reader = (zone: string): Intl.DateTimeFormat => {
  const held = readers.get(zone)
  if (held) return held
  const made = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  })
  readers.set(zone, made)
  return made
}

export function wallIn(ts: number, zone: string): Wall {
  const held: Record<string, string> = {}
  for (const part of reader(zone).formatToParts(ts)) held[part.type] = part.value
  return {
    y: Number(held.year),
    m: Number(held.month),
    d: Number(held.day),
    // A zone that rolls midnight over reads hour 24 rather than hour 0.
    hh: Number(held.hour) % 24,
    mm: Number(held.minute),
    weekday: Math.max(0, WEEK.indexOf(held.weekday))
  }
}

const offsetAt = (ts: number, zone: string): number => {
  const w = wallIn(ts, zone)
  return Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm) - Math.floor(ts / 60000) * 60000
}

// The inverse of reading a wall clock: which instant is it 9am in Lisbon on this
// date. The offset is read at the guess and then at the answer, because the
// offset itself moves on the two days a year a zone changes, and reading it once
// puts the run an hour out on both of them.
export function instantOf(y: number, m: number, d: number, minutes: number, zone: string): number {
  const guess = Date.UTC(y, m - 1, d, 0, minutes)
  const once = guess - offsetAt(guess, zone)
  return guess - offsetAt(once, zone)
}

const dayAfter = (y: number, m: number, d: number, step: number): [number, number, number] => {
  const at = new Date(Date.UTC(y, m - 1, d + step))
  return [at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()]
}

// When it next runs, strictly after `from`. Every cadence but the interval is a
// wall clock in the schedule's own zone, so each one is worked out by walking
// candidate days rather than by adding milliseconds: a day is not always 24
// hours long, and a month never is.
export function nextRun(schedule: Schedule, from: number): number {
  const { when, zone } = schedule
  if (when.kind === 'every') {
    const step = when.minutes * 60000
    const since = schedule.lastRunAt ?? schedule.ts
    if (from < since) return since + step
    return since + step * (Math.floor((from - since) / step) + 1)
  }
  const start = wallIn(from, zone)
  let [y, m, d] = [start.y, start.m, start.d]
  for (let walked = 0; walked < 400; walked++) {
    if (walked > 0) [y, m, d] = dayAfter(y, m, d, 1)
    if (when.kind === 'weekly') {
      const on = wallIn(instantOf(y, m, d, 12 * 60, zone), zone).weekday
      if (!when.days.includes(on)) continue
    }
    if (when.kind === 'monthly' && d !== when.day) continue
    const at = instantOf(y, m, d, when.at, zone)
    if (at > from) return at
  }
  return from + DAY_MINUTES * 60000
}

// A laptop that was asleep, or a Crew that was shut, comes back to a schedule
// that should have fired six times. It fires once and the rest are gone: a
// morning of catching up is a crew watching six of the same run land at once,
// which is worse than the one that was missed.
export function due(schedule: Schedule, now: number): boolean {
  if (schedule.paused) return false
  const since = schedule.lastRunAt ?? schedule.ts
  return nextRun({ ...schedule, lastRunAt: since }, since) <= now
}

const clock = (minutes: number): string => {
  const hh = Math.floor(minutes / 60)
  const mm = minutes % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

const WEEKDAYS = [1, 2, 3, 4, 5]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const listed = (words: string[]): string =>
  words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`

const ordinal = (day: number): string => {
  const tens = day % 100
  if (tens > 3 && tens < 21) return `${day}th`
  return `${day}${['th', 'st', 'nd', 'rd'][day % 10] ?? 'th'}`
}

// What the row says about when it runs. Never a cron line and never a count of
// milliseconds: it is read by whoever wrote it and by everyone else in the crew.
export function sayCadence(when: Cadence): string {
  if (when.kind === 'every') {
    if (when.minutes % DAY_MINUTES === 0) {
      const days = when.minutes / DAY_MINUTES
      return days === 1 ? 'Every day' : `Every ${days} days`
    }
    if (when.minutes % 60 === 0) {
      const hours = when.minutes / 60
      return hours === 1 ? 'Every hour' : `Every ${hours} hours`
    }
    return `Every ${when.minutes} minutes`
  }
  if (when.kind === 'daily') return `Every day at ${clock(when.at)}`
  if (when.kind === 'monthly') return `The ${ordinal(when.day)} of the month at ${clock(when.at)}`
  const days = when.days
  if (days.length === 7) return `Every day at ${clock(when.at)}`
  if (days.length === 5 && WEEKDAYS.every(d => days.includes(d))) return `Weekdays at ${clock(when.at)}`
  if (days.length === 2 && days.includes(0) && days.includes(6)) return `Weekends at ${clock(when.at)}`
  return `Every ${listed(days.map(d => DAY_NAMES[d]))} at ${clock(when.at)}`
}
