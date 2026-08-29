export const VIEW_LIMIT = 10

export const NEAR_RIGHT = 96

export function nearRight(x: number, right: number, reach = NEAR_RIGHT): boolean {
  return right - x <= reach
}

const THREAD_HASH = '#thread='
export const PERSONAL_CHAT_HASH = '#personal'
export const BROWSER_WINDOW_HASH = '#browser'
export const STICKIES_HASH = '#stickies'
const STICKY_HASH = '#sticky='

export function threadWindowHash(threadId: string): string {
  return `${THREAD_HASH}${encodeURIComponent(threadId)}`
}

export function threadIdInHash(hash: string): string | null {
  if (!hash.startsWith(THREAD_HASH)) return null
  const id = decodeURIComponent(hash.slice(THREAD_HASH.length)).trim()
  return id ? id : null
}

export function stickyWindowHash(stickyId: string): string {
  return `${STICKY_HASH}${encodeURIComponent(stickyId)}`
}

export function stickyIdInHash(hash: string): string | null {
  if (!hash.startsWith(STICKY_HASH)) return null
  const id = decodeURIComponent(hash.slice(STICKY_HASH.length)).trim()
  return id ? id : null
}

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

export function focusAfterClose(open: string[], closing: string, focused: string | null): string | null {
  if (focused !== closing) return focused && open.includes(focused) ? focused : (open[0] ?? null)
  const at = open.indexOf(closing)
  const left = open.filter(id => id !== closing)
  return left[at] ?? left[at - 1] ?? null
}

export type ThreadOpenAction = 'open' | 'beside' | 'window' | 'close'

export function threadMenuActions(
  open: string[],
  threadId: string,
  here = true,
  limit = VIEW_LIMIT
): ThreadOpenAction[] {
  if (!here) return ['open', 'window']
  if (open.includes(threadId)) return ['window', 'close']
  if (open.length === 0) return ['open', 'window']
  if (isFull(open, limit)) return ['window']
  return ['beside', 'window']
}
