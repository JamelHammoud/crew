export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  if (minutes < 60) return `${minutes}m ${total % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(tokens < 10000 ? 1 : 0)}k`
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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
