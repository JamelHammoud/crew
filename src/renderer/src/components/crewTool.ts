export type CrewToolCall =
  | { kind: 'design'; boardId: string; action: 'read' | 'edit' }
  | { kind: 'hidden' }

const URL = /https?:\/\/[^\s'"`|;&<>()]+/gi
const BOARD_ID = /^[a-z0-9][a-z0-9-]*$/
const CREW_CODE = /^(?:[a-f0-9]{6,}|code)$/
const INTERNAL = new Set(['agents', 'memory', 'page', 'tickets'])

const local = (url: globalThis.URL): boolean => {
  const host = url.hostname.toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]'
}

const route = (url: globalThis.URL): string[] | null => {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'design' || INTERNAL.has(parts[0] ?? '')) return parts
  if (CREW_CODE.test(parts[0] ?? '') && (parts[1] === 'design' || INTERNAL.has(parts[1] ?? '')))
    return parts.slice(1)
  return null
}

const callAt = (raw: string): CrewToolCall | null => {
  let url: globalThis.URL
  try {
    url = new globalThis.URL(raw)
  } catch {
    return null
  }
  if (!local(url)) return null
  const parts = route(url)
  if (!parts) return null
  if (parts[0] !== 'design') return { kind: 'hidden' }
  if (parts.length < 2 || parts.length > 3 || !BOARD_ID.test(parts[1] ?? '')) return null
  if (parts.length === 3 && parts[2] !== 'ops') return null
  return { kind: 'design', boardId: parts[1], action: parts[2] === 'ops' ? 'edit' : 'read' }
}

export function crewToolCall(detail: string): CrewToolCall | null {
  let design: CrewToolCall | null = null
  for (const found of detail.matchAll(URL)) {
    const call = callAt(found[0])
    if (call?.kind === 'hidden') return call
    if (call) design = call
  }
  return design
}
