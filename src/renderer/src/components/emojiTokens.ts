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

// Walking a line grapheme by grapheme costs something, and almost no line has a
// picture in it. One test over the whole string says whether the walk is worth
// making, and it is the same rule the walk itself reads.
export function anyEmoji(text: string): boolean {
  return PICTOGRAPHIC.test(text)
}

function entryFor(segment: string): EmojiEntry | undefined {
  if (!PICTOGRAPHIC.test(segment)) return undefined
  return (
    lookupEmoji(segment) ?? lookupEmoji(segment.replace(VARIATION, '')) ?? lookupEmoji(`${segment}\uFE0F`)
  )
}

// What is between the crew's own is walked grapheme by grapheme, since a flag
// and a skin tone are each one picture written in several code points.
function pushRun(tokens: EmojiToken[], text: string): void {
  if (!text) return
  if (!anyEmoji(text)) {
    tokens.push({ kind: 'text', text })
    return
  }
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

// A line of nothing but pictures is a picture rather than a sentence, so it is
// drawn at a size worth looking at. Past a wall of them it is a paste, and a
// wall at that size is a screen with nothing else on it, so the run has an end.
const LARGE_LIMIT = 24

export function onlyEmoji(text: string): boolean {
  let drawn = 0
  for (const token of tokenizeEmoji(text)) {
    if (token.kind === 'text') {
      if (token.text.trim()) return false
      continue
    }
    drawn += 1
  }
  return drawn > 0 && drawn <= LARGE_LIMIT
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
