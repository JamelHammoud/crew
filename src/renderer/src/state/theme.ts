import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'crew.theme'
const listeners = new Set<() => void>()

export function storedTheme(): Theme {
  return globalThis.localStorage?.getItem(KEY) === 'light' ? 'light' : 'dark'
}

// Wearing a theme without choosing it, which is what the tray panel does: it
// follows the window rather than deciding for it.
export function showTheme(theme: Theme): void {
  document.documentElement.classList.toggle('light', theme === 'light')
}

export function applyTheme(theme: Theme): void {
  showTheme(theme)
  globalThis.localStorage?.setItem(KEY, theme)
  void window.crew?.setTheme(theme)
  for (const listener of listeners) listener()
}

// The theme turns over at once. A fade across every color in the window was
// tried and taken back out: the flip is the answer to a press, and easing it
// reads as the app catching up rather than as the switch landing.
export function toggleTheme(): void {
  applyTheme(storedTheme() === 'dark' ? 'light' : 'dark')
}

export function useTheme(): Theme {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, storedTheme)
}
