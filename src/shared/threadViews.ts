export const VIEW_LIMIT = 10

const THREAD_HASH = '#thread='

export function threadWindowHash(threadId: string): string {
  return `${THREAD_HASH}${encodeURIComponent(threadId)}`
}

export function threadIdInHash(hash: string): string | null {
  if (!hash.startsWith(THREAD_HASH)) return null
  const id = decodeURIComponent(hash.slice(THREAD_HASH.length)).trim()
  return id ? id : null
}

export function openOne(threadId: string): string[] {
  return [threadId]
}

// Beside the one already open rather than in place of it. A thread already
// being watched is brought to the front of nothing: it stays where it stands,
// so the columns never reorder under somebody reading one of them.
export function openBeside(open: string[], threadId: string, limit = VIEW_LIMIT): string[] {
  if (open.includes(threadId)) return open
  if (open.length >= limit) return open
  return [...open, threadId]
}

export function isFull(open: string[], limit = VIEW_LIMIT): boolean {
  return open.length >= limit
}

export function closeOne(open: string[], threadId: string): string[] {
  return open.filter(id => id !== threadId)
}

// What the caret is in once a column has gone. The one that took its place is
// the one to the right, or the one before it where the last column went, so
// closing down a row never lands the focus back at the far end of it.
export function focusAfterClose(open: string[], closing: string, focused: string | null): string | null {
  if (focused !== closing) return focused && open.includes(focused) ? focused : (open[0] ?? null)
  const at = open.indexOf(closing)
  const left = open.filter(id => id !== closing)
  return left[at] ?? left[at - 1] ?? null
}
