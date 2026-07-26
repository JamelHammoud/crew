import { lookupEmoji, type EmojiEntry } from './emojiData'

export type EmojiToken = { kind: 'text'; text: string } | { kind: 'emoji'; text: string; entry: EmojiEntry }

const PICTOGRAPHIC = /\p{Extended_Pictographic}/u
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
