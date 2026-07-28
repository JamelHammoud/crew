// Both models run on this machine and cost nothing. They are fetched once, the
// first time somebody talks, and kept by the browser from then on, so a second
// conversation opens on the orb rather than on a progress ring.

export const LISTEN_MODEL = 'onnx-community/whisper-base.en'
export const SPEAK_MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// What the listener is told about the utterance it is being handed, which for
// an English-only model is nothing at all. One of those carries its language in
// the model itself and refuses to be told again: a `language` or a `task` on it
// throws before a word is read, on every utterance, and a conversation where
// every turn fails on the way in is a microphone that appears to do nothing.
export const askedOf = (model: string): { language?: string; task?: string } =>
  model.endsWith('.en') ? {} : { language: 'en', task: 'transcribe' }

export const SPEAK_RATE = 24_000

export interface SpeakVoice {
  id: string
  name: string
  accent: string
}

// Kokoro ships more voices than these and most of them are worse. A picker of
// thirty where six are worth hearing is a picker that has to be auditioned, so
// this is the ones graded B or better plus the best of each other kind.
export const SPEAK_VOICES: SpeakVoice[] = [
  { id: 'af_heart', name: 'Heart', accent: 'American' },
  { id: 'af_bella', name: 'Bella', accent: 'American' },
  { id: 'am_michael', name: 'Michael', accent: 'American' },
  { id: 'am_puck', name: 'Puck', accent: 'American' },
  { id: 'bf_emma', name: 'Emma', accent: 'British' },
  { id: 'bm_george', name: 'George', accent: 'British' }
]

export const DEFAULT_VOICE = SPEAK_VOICES[0].id

const VOICE_KEY = 'crew.voice.voice'

export function storedVoice(): string {
  const held = globalThis.localStorage?.getItem(VOICE_KEY)
  return SPEAK_VOICES.some(voice => voice.id === held) ? held! : DEFAULT_VOICE
}

export function rememberVoice(id: string): void {
  try {
    globalThis.localStorage?.setItem(VOICE_KEY, id)
  } catch {
    // Storage turned off keeps the choice for this conversation and no longer.
  }
}

// One number for two downloads, so the ring on the orb fills once rather than
// twice. A file whose length the server never said is left out of the sum
// instead of counted as nothing, which would make the ring jump backwards.
export interface Fetching {
  file: string
  loaded: number
  total: number
}

export function progressOf(files: Map<string, Fetching>): number {
  let loaded = 0
  let total = 0
  for (const file of files.values()) {
    if (!file.total) continue
    loaded += Math.min(file.loaded, file.total)
    total += file.total
  }
  return total > 0 ? Math.min(1, loaded / total) : 0
}
