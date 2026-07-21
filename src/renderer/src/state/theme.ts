import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'crew.theme'
const listeners = new Set<() => void>()

export function storedTheme(): Theme {
  return globalThis.localStorage?.getItem(KEY) === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light')
  globalThis.localStorage?.setItem(KEY, theme)
  for (const listener of listeners) listener()
}

export function useTheme(): Theme {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, storedTheme)
}
