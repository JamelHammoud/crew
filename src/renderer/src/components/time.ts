export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m ${total % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

// How long something ran, in the words someone would use out loud.
export function formatSpan(ms: number): string {
  const minutes = Math.round(Math.max(0, ms) / 60000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const hour = `${hours} hour${hours === 1 ? '' : 's'}`
  if (rest === 0) return hour
  return `${hour} ${rest} minute${rest === 1 ? '' : 's'}`
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = `${total % 60}`.padStart(2, '0')
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}:${seconds}`
  return `${Math.floor(minutes / 60)}:${`${minutes % 60}`.padStart(2, '0')}:${seconds}`
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(tokens < 10000 ? 1 : 0)}k`
}

// A price stands beside a count, so it keeps its two figures and says there is
// less than one cent rather than rounding a real run down to nothing.
export function formatCost(cost: number): string {
  if (cost > 0 && cost < 0.01) return '<$0.01'
  return `$${cost.toFixed(2)}`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatShortDay(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const year = date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year })
}

export function isNewDay(prev: number | undefined, ts: number): boolean {
  if (prev === undefined) return true
  return new Date(prev).toDateString() !== new Date(ts).toDateString()
}

export function formatFullTime(ts: number): string {
  const date = new Date(ts)
  const day = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
  return `${day}, ${time}`
}
