import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { LISTEN_MODEL } from './models'

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

let listener: Promise<AutomaticSpeechRecognitionPipeline> | null = null

const load = (): Promise<AutomaticSpeechRecognitionPipeline> => {
  listener ??= pipeline('automatic-speech-recognition', LISTEN_MODEL, {
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    device: 'wasm',
    progress_callback: report => {
      if (report.status !== 'progress') return
      post({ type: 'fetching', file: report.file, loaded: report.loaded ?? 0, total: report.total ?? 0 })
    }
  }) as Promise<AutomaticSpeechRecognitionPipeline>
  return listener
}

// Whisper was trained on sixty year old radio and fills silence with whatever
// it heard most, so a room tone comes back as thank you or as a channel sign
// off. None of those are ever a thing somebody said to an agent.
const NOTHING = /^[\s.,!?-]*$|^(you|thanks|thank you|bye|okay|ok|so|um|uh|hmm|mm|yeah|\[.*\]|\(.*\))[\s.,!?]*$/i

self.onmessage = async (event: MessageEvent<ListenIn>) => {
  const message = event.data
  try {
    if (message.type === 'load') {
      await load()
      post({ type: 'ready' })
      return
    }
    const listen = await load()
    const result = await listen(message.audio, { language: 'en', task: 'transcribe' })
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
