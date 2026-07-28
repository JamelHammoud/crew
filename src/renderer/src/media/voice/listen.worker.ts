import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { askedOf, LISTEN_MODEL } from './models'

// Whisper on this machine. It runs here rather than on the window's own thread
// because a turn of it is a second of solid arithmetic, and a second of that on
// the thread drawing the orb is a second of the orb standing still.

env.allowLocalModels = false

export type ListenIn = { type: 'load' } | { type: 'hear'; id: number; audio: Float32Array }

export type ListenOut =
  | { type: 'fetching'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'heard'; id: number; text: string }
  | { type: 'failed'; id?: number; message: string }

const post = (message: ListenOut) => globalThis.postMessage(message)

interface Fetched {
  status: string
  file?: string
  loaded?: number
  total?: number
}

// Asked for through a signature of our own. Resolving the library's own
// overloads across every task it knows and every way each one can be quantized
// is a union big enough that the compiler gives up describing it.
const build = pipeline as unknown as (
  task: 'automatic-speech-recognition',
  model: string,
  options: Record<string, unknown>
) => Promise<AutomaticSpeechRecognitionPipeline>

let listener: Promise<AutomaticSpeechRecognitionPipeline> | null = null

const load = (): Promise<AutomaticSpeechRecognitionPipeline> => {
  listener ??= build('automatic-speech-recognition', LISTEN_MODEL, {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    device: 'wasm',
    progress_callback: (report: Fetched) => {
      if (report.status !== 'progress') return
      post({ type: 'fetching', file: report.file ?? '', loaded: report.loaded ?? 0, total: report.total ?? 0 })
    }
  })
  return listener
}

// Whisper fills silence with whatever it heard most while it was trained, so a
// quiet room comes back as a sign off or as a note about the sound in the room.
// Only the handful it really invents: "okay" and "yeah" belong to whoever said
// them, and dropping those is an agent that ignores you when you agree with it.
const NOTHING = /^[\s.,!?-]*$|^(you|thanks|thank you|bye|\[.*\]|\(.*\)|♪.*)[\s.,!?]*$/i

self.onmessage = async (event: MessageEvent<ListenIn>) => {
  const message = event.data
  try {
    if (message.type === 'load') {
      await load()
      post({ type: 'ready' })
      return
    }
    const listen = await load()
    const result = await listen(message.audio, askedOf(LISTEN_MODEL))
    const raw = Array.isArray(result) ? result.map(part => part.text).join(' ') : result.text
    const text = (raw ?? '').replace(/\s+/g, ' ').trim()
    post({ type: 'heard', id: message.id, text: NOTHING.test(text) ? '' : text })
  } catch (error) {
    post({
      type: 'failed',
      id: message.type === 'hear' ? message.id : undefined,
      message: error instanceof Error ? error.message : 'The listener could not start.'
    })
  }
}
