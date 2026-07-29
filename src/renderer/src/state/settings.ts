import { useSyncExternalStore } from 'react'

export type SettingsTab = 'you' | 'appearance' | 'sound' | 'people' | 'agents' | 'helpers'

// Which page of the settings is open, or none. It is held here rather than in
// the top bar so anything can raise it, the way a toast is raised, and so the
// card never stands inside the menu that opened it.
let showing: SettingsTab | null = null

const listeners = new Set<() => void>()

function say(): void {
  for (const listener of listeners) listener()
}

export function openSettings(tab: SettingsTab = 'you'): void {
  showing = tab
  say()
}

export function closeSettings(): void {
  showing = null
  say()
}

export function useSettings(): SettingsTab | null {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => showing
  )
}
