import { useSyncExternalStore } from 'react'
import { cleanPrefs, DEFAULT_PREFS, type HelperPrefs } from '../../../shared/subagents'

// What this person lets helpers do on this machine. A helper runs a real CLI
// here, so this is theirs the way the volume is: kept in the window's own
// storage, never written into the crew's log, and said again on every connect
// because the host is what has to honour it.

const KEY = 'crew.helpers'

let prefs: HelperPrefs = read()
const listeners = new Set<() => void>()
let publish: ((prefs: HelperPrefs) => void) | null = null

function read(): HelperPrefs {
  try {
    const held = localStorage.getItem(KEY)
    return held ? cleanPrefs(JSON.parse(held)) : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function say(): void {
  for (const listener of listeners) listener()
  publish?.(prefs)
}

export function setHelperPrefs(next: Partial<HelperPrefs>): void {
  prefs = cleanPrefs({ ...prefs, ...next })
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // A window with no storage keeps them for as long as it is open, which is
    // still better than refusing to change them.
  }
  say()
}

export function helperPrefs(): HelperPrefs {
  return prefs
}

// The socket says who to tell. It is handed over rather than reached for, so
// nothing here has to know what a session is.
export function onHelperPrefs(send: (prefs: HelperPrefs) => void): void {
  publish = send
}

export function useHelperPrefs(): HelperPrefs {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => prefs
  )
}
