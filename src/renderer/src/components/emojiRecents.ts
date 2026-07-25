import { QUICK_REACTIONS } from '../../../shared/reactions'
import { lookupEmoji } from './emojiData'

const KEY = 'crew.emoji.recent'
const LIMIT = 27

export function recentEmoji(): string[] {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '[]')
    const chars = Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : []
    const seen = [...chars, ...QUICK_REACTIONS].filter(char => lookupEmoji(char))
    return [...new Set(seen)].slice(0, LIMIT)
  } catch {
    return [...QUICK_REACTIONS]
  }
}

export function rememberEmoji(char: string): void {
  const next = [char, ...recentEmoji().filter(item => item !== char)].slice(0, LIMIT)
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next))
  } catch {
    return
  }
}
