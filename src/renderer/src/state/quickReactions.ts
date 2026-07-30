import { useSyncExternalStore } from 'react'
import { cleanQuickReactions, MAX_QUICK_REACTIONS } from '../../../shared/reactions'

// The row of reactions that opens on a message. It is yours alone, the way the
// volume and the theme are: it sits in this window's own storage, nothing about
// it is ever sent, and the crew each get whatever they have chosen.

const KEY = 'crew.reactions.quick'
const listeners = new Set<() => void>()

// Worked out again only when what is written down has really changed. A store
// that hands back a new array every time is a render asking for another one
// forever, and one that reads once at load is wrong in a window whose storage
// arrived after it.
let seen: string | null = null
let held: string[] = cleanQuickReactions(null)

export function quickReactions(): string[] {
  const raw = globalThis.localStorage?.getItem(KEY) ?? null
  if (raw !== seen) {
    seen = raw
    try {
      held = cleanQuickReactions(raw === null ? null : JSON.parse(raw))
    } catch {
      held = cleanQuickReactions(null)
    }
  }
  return held
}

// An empty row is a real answer, so it is written down as one rather than read
// as nothing chosen. Nought and the default are the same absence otherwise, and
// the row would come back the moment somebody cleared it.
export function setQuickReactions(list: string[]): void {
  const next = cleanQuickReactions(list)
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  }
  for (const listener of listeners) listener()
}

export function addQuickReaction(emoji: string): void {
  const list = quickReactions()
  if (list.includes(emoji) || list.length >= MAX_QUICK_REACTIONS) return
  setQuickReactions([...list, emoji])
}

export function removeQuickReaction(emoji: string): void {
  setQuickReactions(quickReactions().filter(item => item !== emoji))
}

// One standing in for another, which is what changing a reaction is: the row is
// an order somebody chose, so it keeps its place rather than going to the end.
export function replaceQuickReaction(emoji: string, next: string): void {
  const list = quickReactions()
  if (!list.includes(emoji) || (list.includes(next) && next !== emoji)) return
  setQuickReactions(list.map(item => (item === emoji ? next : item)))
}

export function useQuickReactions(): string[] {
  return useSyncExternalStore(listener => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, quickReactions)
}
