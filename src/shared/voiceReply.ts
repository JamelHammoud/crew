import { readReply, type VoiceCard } from './voice'

// A reply arrives a piece at a time and has to be spoken while it is still
// being written, or every answer waits for its own last word. Two things stop
// that being a plain hand-off of whatever just landed.
//
// A card is a fenced block, and half of one is a line of JSON. Nothing past an
// unclosed fence is ever handed over, so a card is either whole or not there.
//
// A sentence is the smallest thing worth saying. Handed "Let me check the" the
// voice says it with a full stop on the end and then starts again mid-clause,
// which is what a machine reading a teleprinter sounds like.

export interface Sayable {
  say: string
  cards: VoiceCard[]
}

const NOTHING: Sayable = { say: '', cards: [] }

const FENCE = /^[ \t]*```/gm

// A full stop after a single letter is an initial or an abbreviation, so "e.g."
// and "J. Smith" are not the end of anything.
const SENTENCE = /(?<![\s(][A-Za-z])[.!?…]["')\]]*(?=\s)/g

export function lastBoundary(text: string, from: number): number {
  let end = from
  const line = text.lastIndexOf('\n')
  if (line >= from) end = line + 1
  SENTENCE.lastIndex = from
  for (let match = SENTENCE.exec(text); match; match = SENTENCE.exec(text)) {
    const after = match.index + match[0].length
    if (after > end) end = after
  }
  return end
}

export class VoiceReply {
  private at = 0

  // Everything that has become safe to say since the last time it was asked.
  grew(raw: string): Sayable {
    const fences = [...raw.matchAll(FENCE)]
    const safe = fences.length % 2 === 0 ? raw : raw.slice(0, fences[fences.length - 1].index)
    const end = lastBoundary(safe, this.at)
    if (end <= this.at) return NOTHING
    return this.take(safe.slice(this.at, end), end)
  }

  // The rest of it, once there is no more coming. Anything the sentence rule
  // was still holding on to goes out here, whether or not it ends in a stop.
  whole(raw: string): Sayable {
    return this.at >= raw.length ? NOTHING : this.take(raw.slice(this.at), raw.length)
  }

  private take(chunk: string, to: number): Sayable {
    this.at = to
    const { spoken, cards } = readReply(chunk)
    return { say: spoken, cards }
  }
}
