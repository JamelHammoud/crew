import { CUSTOM_EMOJI_SCAN, type CustomEmoji } from '../../../shared/customEmoji'
import { lookupCustomEmoji } from './customEmojiSheet'
import { lookupEmoji, type EmojiEntry } from './emojiData'

export type EmojiToken =
  | { kind: 'text'; text: string }
  | { kind: 'emoji'; text: string; entry: EmojiEntry }
  | { kind: 'custom'; text: string; emoji: CustomEmoji }

// A flag is a pair of letters and a keycap is a digit, so neither counts as a
// picture. They are on the sheet all the same.
const PICTOGRAPHIC = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{20E3}]/u
const VARIATION = /\uFE0F/g
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// The pattern is borrowed and the walking is ours. A global regex carries where
// it last stopped, and that one is read by everything that reads prose, so
// sharing it would mean starting somewhere else's place in somebody's message.
const SCAN = new RegExp(CUSTOM_EMOJI_SCAN.source, CUSTOM_EMOJI_SCAN.flags)

function entryFor(segment: string): EmojiEntry | undefined {
  if (!PICTOGRAPHIC.test(segment)) return undefined
  return (
    lookupEmoji(segment) ?? lookupEmoji(segment.replace(VARIATION, '')) ?? lookupEmoji(`${segment}\uFE0F`)
  )
}

// What is between the crew's own is walked grapheme by grapheme, since a flag
// and a skin tone are each one picture written in several code points.
function pushRun(tokens: EmojiToken[], text: string): void {
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
}

export function tokenizeEmoji(text: string): EmojiToken[] {
  const tokens: EmojiToken[] = []
  let at = 0
  SCAN.lastIndex = 0
  for (let match = SCAN.exec(text); match; match = SCAN.exec(text)) {
    const picture = lookupCustomEmoji(match[1])
    // A name the crew does not have is a word somebody wrote, so it stays in
    // the text it was written in.
    if (!picture) continue
    pushRun(tokens, text.slice(at, match.index))
    tokens.push({ kind: 'custom', text: match[0], emoji: picture.emoji })
    at = SCAN.lastIndex
  }
  pushRun(tokens, text.slice(at))
  return tokens
}
