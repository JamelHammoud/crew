import { FRAME, rmsOf } from '../voice/gate'

// The quiet at both ends of a dictation. The key brackets the utterance, so
// there is always a moment of room either side of the words: reaching for the
// key, letting go of it, drawing breath. Whisper reads every one of those
// seconds and guesses at what was in them, so a dictation that ends in silence
// comes back with a sign off nobody said.

// Never trimmed to nothing at the front. Speech starts before it is loud enough
// to measure, and a word missing its first consonant is one whisper invents.
const PAD_MS = 180

// Nothing under this is speech, however quiet the room is.
const NEVER_UNDER = 0.0018
const OVER = 2.4

// The floor is read off the quiet quarter of the take rather than off its mean,
// which a loud voice drags up above the room it was spoken in.
const QUIET_PART = 0.25

export interface Trimmed {
  audio: Float32Array
  spoke: boolean
}

function floorOf(levels: number[]): number {
  if (levels.length === 0) return NEVER_UNDER
  const sorted = [...levels].sort((a, b) => a - b)
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * QUIET_PART))
  return Math.max(NEVER_UNDER, sorted[at])
}

export function trim(audio: Float32Array, rate: number): Trimmed {
  const frames = Math.floor(audio.length / FRAME)
  if (frames < 2) return { audio, spoke: audio.length > 0 }
  const levels: number[] = []
  for (let i = 0; i < frames; i++) {
    levels.push(rmsOf(audio.subarray(i * FRAME, (i + 1) * FRAME)))
  }
  const over = floorOf(levels) * OVER
  let first = -1
  let last = -1
  for (let i = 0; i < frames; i++) {
    if (levels[i] < over) continue
    if (first < 0) first = i
    last = i
  }
  if (first < 0) return { audio: new Float32Array(0), spoke: false }
  const pad = Math.max(1, Math.round((rate * PAD_MS) / 1000 / FRAME))
  const from = Math.max(0, first - pad) * FRAME
  const to = Math.min(frames, last + 1 + pad) * FRAME
  return { audio: audio.slice(from, to), spoke: true }
}
