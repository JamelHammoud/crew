import { useSyncExternalStore } from 'react'

// What a run says about itself while it works. Both of these are yours alone:
// they sit on this machine, nothing about them is ever sent, and the crew sees
// whatever each of them has chosen.
export interface Prefs {
  tokens: boolean
  cost: boolean
}

const KEY = 'crew.prefs'
const DEFAULTS: Prefs = { tokens: true, cost: false }
const listeners = new Set<() => void>()

function read(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    const saved = raw ? JSON.parse(raw) : null
    return {
      tokens: typeof saved?.tokens === 'boolean' ? saved.tokens : DEFAULTS.tokens,
      cost: typeof saved?.cost === 'boolean' ? saved.cost : DEFAULTS.cost
    }
  } catch {
    return DEFAULTS
  }
}

// Held rather than read on every call, because a store that hands back a new
// object each time is a render that asks for another one forever.
let held = read()

export function prefs(): Prefs {
  return held
}

export function setPref(key: keyof Prefs, on: boolean): void {
  if (held[key] === on) return
  held = { ...held, [key]: on }
  globalThis.localStorage?.setItem(KEY, JSON.stringify(held))
  for (const listener of listeners) listener()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, prefs)
}
