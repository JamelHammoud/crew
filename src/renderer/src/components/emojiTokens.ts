import { lookupEmoji, type EmojiEntry } from './emojiData'

export type EmojiToken = { kind: 'text'; text: string } | { kind: 'emoji'; text: string; entry: EmojiEntry }

// A flag is a pair of letters and a keycap is a digit, so neither counts as a
// picture. They are on the sheet all the same.
const PICTOGRAPHIC = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20E3}]/u
const VARIATION = /\uFE0F/g
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function entryFor(segment: string): EmojiEntry | undefined {
  if (!PICTOGRAPHIC.test(segment)) return undefined
  return (
    lookupEmoji(segment) ?? lookupEmoji(segment.replace(VARIATION, '')) ?? lookupEmoji(`${segment}\uFE0F`)
  )
}

export function tokenizeEmoji(text: string): EmojiToken[] {
  const tokens: EmojiToken[] = []
  let run = ''
  for (const { segment } of segmenter.segment(text)) {
    const entry = entryFor(segment)
    if (!entry) {
      run += segment
      continue
    }
    if (run) tokens.push({ kind: 'text', text: run })
    run = ''
    tokens.push({ kind: 'emoji', text: segment, entry })
  }
  if (run) tokens.push({ kind: 'text', text: run })
  return tokens
}
