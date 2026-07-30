import { isCustomEmojiRef } from '../../../shared/customEmoji'
import { quickReactions } from '../state/quickReactions'
import { lookupEmoji } from './emojiData'

const KEY = 'crew.emoji.recent'
const LIMIT = 27

// One of the crew's own is a recent emoji like any other, so a `:name:` survives
// the filter on being a ref rather than on being a picture that is still there:
// the picker looks one up as it draws it, so a name somebody has since taken
// away stands itself down rather than emptying the list behind it.
function shown(char: string): boolean {
  return isCustomEmojiRef(char) || Boolean(lookupEmoji(char))
}

// This is read outside React as well as in it, so the row comes from
// quickReactions() and never from the hook.
function row(): string[] {
  try {
    return quickReactions()
  } catch {
    return []
  }
}

// Seeded from that window's own row rather than from the four it ships with, so
// the picker opens on what the person in front of it really uses.
export function recentEmoji(): string[] {
  let stored: string[] = []
  try {
    const held = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]')
    stored = Array.isArray(held) ? held.filter(item => typeof item === 'string') : []
  } catch {
    stored = []
  }
  return [...new Set([...stored, ...row()].filter(shown))].slice(0, LIMIT)
}

export function rememberEmoji(char: string): void {
  const next = [char, ...recentEmoji().filter(item => item !== char)].slice(0, LIMIT)
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  }
}
