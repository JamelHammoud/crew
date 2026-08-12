import { useSyncExternalStore } from 'react'
import { customEmojiNameIn, customEmojiUrl, findCustomEmoji, type CustomEmoji } from '../../../shared/customEmoji'

// The crew's own emoji, looked up the way the sheet's are: by name, from here,
// with nothing handed in. A picture drawn from a name has to be reachable from a
// DOM walk over rendered markdown and from a component a dozen callers deep, and
// threading the list and the address through every one of them to draw one
// picture is the plumbing this exists instead of.
//
// The store is what keeps it fed, off the snapshot and off every `emoji.set`.

let held: readonly CustomEmoji[] = []
let base = ''
// What has been drawn already was drawn against the sheet as it stood. An emoji
// added while a message naming it is on screen has to reach that message, and
// what draws it is memoized on the words alone, so the sheet says when it has
// changed and anything drawing from it works its picture out again.
let version = 0
const listeners = new Set<() => void>()

export function holdCustomEmoji(list: readonly CustomEmoji[], httpBase: string): void {
  // The store says this on every change it makes, so only a real change to the
  // sheet is worth redrawing the app for.
  if (list === held && httpBase === base) return
  held = list
  base = httpBase
  version += 1
  for (const listener of listeners) listener()
}

export function useCustomEmoji(): number {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version
  )
}

export function customEmojiSheet(): readonly CustomEmoji[] {
  return held
}

export interface CustomEmojiPicture {
  emoji: CustomEmoji
  url: string
}

export function lookupCustomEmoji(name: string): CustomEmojiPicture | undefined {
  const emoji = findCustomEmoji(held, name)
  // Before a session is up there is nowhere to read a picture from, so a name
  // that has no address yet is nothing rather than a broken picture.
  if (!emoji || !base) return undefined
  return { emoji, url: customEmojiUrl(base, emoji.file) }
}

// The same lookup for a value that is the whole of a `:name:`, which is what a
// reaction and what the picker hands back both are.
export function lookupCustomEmojiRef(value: string): CustomEmojiPicture | undefined {
  const name = customEmojiNameIn(value)
  return name ? lookupCustomEmoji(name) : undefined
}

export function searchCustomEmoji(query: string, limit = 36): CustomEmoji[] {
  const needle = query.trim().toLowerCase().replace(/^:|:$/g, '')
  if (!needle) return []
  return held
    .filter(emoji => emoji.name.includes(needle))
    .sort((a, b) => Number(b.name.startsWith(needle)) - Number(a.name.startsWith(needle)))
    .slice(0, limit)
}
