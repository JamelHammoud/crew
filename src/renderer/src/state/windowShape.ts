import { useSyncExternalStore } from 'react'

export type WindowShape = { square: boolean; full: boolean; pinned: boolean }

const listeners = new Set<() => void>()
let full = false
let pinned = false

export function fullScreen(): boolean {
  return full
}

export function windowPinned(): boolean {
  return pinned
}

// Zoomed and fullscreen both square the corners, and only fullscreen takes the
// stoplights away with it, so the two are held apart rather than read as one.
export function setFullScreen(next: boolean): void {
  if (next === full) return
  full = next
  for (const listener of listeners) listener()
}

export function setWindowPinned(next: boolean): void {
  if (next === pinned) return
  pinned = next
  for (const listener of listeners) listener()
}

export function useFullScreen(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, fullScreen)
}

export function useWindowPinned(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, windowPinned)
}
