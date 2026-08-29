import { useSyncExternalStore } from 'react'

export const SIDEBAR_ITEM_IDS = [
  'files',
  'review',
  'terminal',
  'web',
  'plugins',
  'scheduled',
  'toolbox',
  'stickies',
  'browser',
  'mail'
] as const

export type SidebarItemId = (typeof SIDEBAR_ITEM_IDS)[number]

const KEY = 'crew.sidebar.pins'
const listeners = new Set<() => void>()
const valid = new Set<string>(SIDEBAR_ITEM_IDS)
let seen: string | null = null
let held: SidebarItemId[] = []

function read(raw: string | null): SidebarItemId[] {
  try {
    const saved: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(saved)) return []
    const pinned = new Set(saved.filter((id): id is SidebarItemId => typeof id === 'string' && valid.has(id)))
    return SIDEBAR_ITEM_IDS.filter(id => pinned.has(id))
  } catch {
    return []
  }
}

export function sidebarPins(): SidebarItemId[] {
  const raw = globalThis.localStorage?.getItem(KEY) ?? null
  if (raw !== seen) {
    seen = raw
    held = read(raw)
  }
  return held
}

export function setSidebarPinned(id: SidebarItemId, on: boolean): void {
  const pinned = new Set(sidebarPins())
  if (on) pinned.add(id)
  else pinned.delete(id)
  const next = SIDEBAR_ITEM_IDS.filter(item => pinned.has(item))
  const raw = JSON.stringify(next)
  globalThis.localStorage?.setItem(KEY, raw)
  seen = raw
  held = next
  for (const listener of listeners) listener()
}

export function useSidebarPins(): SidebarItemId[] {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, sidebarPins)
}
