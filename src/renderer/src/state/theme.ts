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

// Turning the theme over is the one moment the whole window changes color at
// once, and an instant swap from a dark app to a white one is a flash rather
// than a change. The fade is armed here and nowhere else: the theme the app
// boots in is the theme it is drawn in, so `applyTheme` on startup must not
// cross into it from the other one.
const FADE = 180

export function toggleTheme(): void {
  const root = document.documentElement
  root.classList.add('theming')
  setTimeout(() => root.classList.remove('theming'), FADE)
  applyTheme(storedTheme() === 'dark' ? 'light' : 'dark')
}

export function useTheme(): Theme {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, storedTheme)
}
