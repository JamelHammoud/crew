import { useSyncExternalStore } from 'react'
import { cleanAppIcon, DEFAULT_APP_ICON, type AppIconId } from '../../../shared/appIcon'

// Which icon the app wears is this machine's own, the way the theme and the
// volume are: it is kept where you sit, and nothing about it is ever sent.

const KEY = 'crew.appIcon'
const listeners = new Set<() => void>()

export function storedAppIcon(): AppIconId {
  return cleanAppIcon(globalThis.localStorage?.getItem(KEY) ?? DEFAULT_APP_ICON)
}

export function applyAppIcon(icon: AppIconId): void {
  globalThis.localStorage?.setItem(KEY, icon)
  void window.crew?.setAppIcon(icon)
  for (const listener of listeners) listener()
}

export function useAppIcon(): AppIconId {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, storedAppIcon)
}
