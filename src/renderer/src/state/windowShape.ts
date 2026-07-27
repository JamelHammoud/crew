import { useSyncExternalStore } from 'react'

export type WindowShape = { square: boolean; full: boolean }

const listeners = new Set<() => void>()
let full = false

export function fullScreen(): boolean {
  return full
}

// Zoomed and fullscreen both square the corners, and only fullscreen takes the
// stoplights away with it, so the two are held apart rather than read as one.
export function setFullScreen(next: boolean): void {
  if (next === full) return
  full = next
  for (const listener of listeners) listener()
}

export function useFullScreen(): boolean {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, fullScreen)
}
