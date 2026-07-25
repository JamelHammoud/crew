import source from 'emoji-datasource-twitter/emoji.json'
import sheetUrl from 'emoji-datasource-twitter/img/twitter/sheets-256/64.png'

interface SourceEmoji {
  name: string
  unified: string
  short_name: string
  short_names: string[]
  sheet_x: number
  sheet_y: number
  category: string
  sort_order: number
  has_img_twitter: boolean
}

export interface EmojiEntry {
  char: string
  shortName: string
  terms: string[]
  x: number
  y: number
}

export interface EmojiCategory {
  id: string
  label: string
  icon: string
  entries: EmojiEntry[]
}

export const SHEET_URL = sheetUrl
export const SHEET_GRID = 62

const CATEGORIES: Array<{ id: string; source: string; label: string; icon: string }> = [
  { id: 'smileys', source: 'Smileys & Emotion', label: 'Smileys', icon: '😀' },
  { id: 'people', source: 'People & Body', label: 'People', icon: '👋' },
  { id: 'nature', source: 'Animals & Nature', label: 'Animals and nature', icon: '🐻' },
  { id: 'food', source: 'Food & Drink', label: 'Food and drink', icon: '🍔' },
  { id: 'activity', source: 'Activities', label: 'Activities', icon: '⚽' },
  { id: 'travel', source: 'Travel & Places', label: 'Travel and places', icon: '🚗' },
  { id: 'objects', source: 'Objects', label: 'Objects', icon: '💡' },
  { id: 'symbols', source: 'Symbols', label: 'Symbols', icon: '🔣' },
  { id: 'flags', source: 'Flags', label: 'Flags', icon: '🚩' }
]

const toChar = (unified: string) =>
  String.fromCodePoint(...unified.split('-').map(part => Number.parseInt(part, 16)))

const ordered = (source as unknown as SourceEmoji[])
  .filter(item => item.has_img_twitter)
  .sort((a, b) => a.sort_order - b.sort_order)

const byCategory = new Map<string, EmojiEntry[]>()
const byChar = new Map<string, EmojiEntry>()

for (const item of ordered) {
  const entry: EmojiEntry = {
    char: toChar(item.unified),
    shortName: item.short_name,
    terms: [...new Set([...item.short_names, ...item.name.toLowerCase().split(/[^a-z0-9+]+/)])].filter(Boolean),
    x: item.sheet_x,
    y: item.sheet_y
  }
  byChar.set(entry.char, entry)
  const bucket = byCategory.get(item.category) ?? []
  bucket.push(entry)
  byCategory.set(item.category, bucket)
}

export const EMOJI_CATEGORIES: EmojiCategory[] = CATEGORIES.map(category => ({
  id: category.id,
  label: category.label,
  icon: category.icon,
  entries: byCategory.get(category.source) ?? []
}))

export function lookupEmoji(char: string): EmojiEntry | undefined {
  return byChar.get(char)
}

export function searchEmoji(query: string, limit = 108): EmojiEntry[] {
  const needle = query.trim().toLowerCase().replace(/^:|:$/g, '')
  if (!needle) return []
  const ranked: Array<{ entry: EmojiEntry; rank: number }> = []
  for (const entry of byChar.values()) {
    let rank = 4
    for (const term of entry.terms) {
      if (term === needle) rank = Math.min(rank, 0)
      else if (term.startsWith(needle)) rank = Math.min(rank, term === entry.shortName ? 1 : 2)
      else if (term.includes(needle)) rank = Math.min(rank, 3)
    }
    if (rank < 4) ranked.push({ entry, rank })
    if (ranked.length > limit * 6) break
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(item => item.entry)
}
