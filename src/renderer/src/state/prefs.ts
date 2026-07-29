import { useSyncExternalStore } from 'react'

// What a run says about itself while it works. The numbers are always gathered,
// whichever of these is on: this is what is drawn and nothing else. Both are
// yours alone, they sit on this machine, and nothing about them is ever sent.
export interface Prefs {
  tokens: boolean
  cost: boolean
}

const KEY = 'crew.prefs'
const DEFAULTS: Prefs = { tokens: true, cost: false }
const listeners = new Set<() => void>()

function parse(raw: string | null): Prefs {
  try {
    const saved = raw ? JSON.parse(raw) : null
    return {
      tokens: typeof saved?.tokens === 'boolean' ? saved.tokens : DEFAULTS.tokens,
      cost: typeof saved?.cost === 'boolean' ? saved.cost : DEFAULTS.cost
    }
  } catch {
    return DEFAULTS
  }
}

// The answer is worked out again only when what is written down has really
// changed. A store that hands back a new object every time is a render asking
// for another one forever, and one that reads once at load is wrong in a window
// whose storage arrived after it.
let seen: string | null = null
let held: Prefs = DEFAULTS

export function prefs(): Prefs {
  const raw = globalThis.localStorage?.getItem(KEY) ?? null
  if (raw !== seen) {
    seen = raw
    held = parse(raw)
  }
  return held
}

export function setPref(key: keyof Prefs, on: boolean): void {
  const next = { ...prefs(), [key]: on }
  globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, prefs)
}
