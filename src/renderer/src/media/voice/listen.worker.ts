import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { askedOf, LISTEN_MODEL } from './models'

// Whisper on this machine. It runs here rather than on the window's own thread
// because a turn of it is a second of solid arithmetic, and a second of that on
// the thread drawing the orb is a second of the orb standing still.

env.allowLocalModels = false

export interface HeardChunk {
  text: string
  start: number
  end: number
}

export type ListenIn = { type: 'load' } | { type: 'hear'; id: number; audio: Float32Array }

export type ListenOut =
  | { type: 'fetching'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'heard'; id: number; text: string; chunks: HeardChunk[] }
  | { type: 'failed'; id?: number; message: string }

const post = (message: ListenOut) => globalThis.postMessage(message)

interface Fetched {
  status: string
  file?: string
  loaded?: number
  total?: number
}

interface Timed {
  text?: string
  timestamp?: [number | null, number | null]
}

// Asked for through a signature of our own. Resolving the library's own
// overloads across every task it knows and every way each one can be quantized
// is a union big enough that the compiler gives up describing it.
const build = pipeline as unknown as (
  task: 'automatic-speech-recognition',
  model: string,
  options: Record<string, unknown>
) => Promise<AutomaticSpeechRecognitionPipeline>

// The same model file, five to ten times faster. The card is asked for first and
// the wasm build is what answers when there is no card, or when the card turns
// out not to be able to run it, which is a thing that is only ever found out by
// trying.
const ON_GPU = { encoder_model: 'fp32', decoder_model_merged: 'q4' }
const ON_CPU = { encoder_model: 'q8', decoder_model_merged: 'q8' }

let listener: Promise<AutomaticSpeechRecognitionPipeline> | null = null
let onGpu = false

const report = (report: Fetched) => {
  if (report.status !== 'progress') return
  post({ type: 'fetching', file: report.file ?? '', loaded: report.loaded ?? 0, total: report.total ?? 0 })
}

async function hasGpu(): Promise<boolean> {
  const gpu = (globalThis.navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
  if (!gpu) return false
  try {
    return (await gpu.requestAdapter()) !== null
  } catch {
    return false
  }
}

const onCpu = (): Promise<AutomaticSpeechRecognitionPipeline> => {
  onGpu = false
  return build('automatic-speech-recognition', LISTEN_MODEL, {
    dtype: ON_CPU,
    device: 'wasm',
    progress_callback: report
  })
}

async function make(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!(await hasGpu())) return onCpu()
  try {
    const built = await build('automatic-speech-recognition', LISTEN_MODEL, {
      dtype: ON_GPU,
      device: 'webgpu',
      progress_callback: report
    })
    onGpu = true
    return built
  } catch {
    return onCpu()
  }
}

const load = (): Promise<AutomaticSpeechRecognitionPipeline> => {
  listener ??= make()
  return listener
}

// Whisper fills silence with whatever it heard most while it was trained, so a
// quiet room comes back as a sign off or as a note about the sound in the room.
// Only the handful it really invents: "okay" and "yeah" belong to whoever said
// them, and dropping those is an agent that ignores you when you agree with it.
const NOTHING = /^[\s.,!?-]*$|^(you|thanks|thank you|bye|\[.*\]|\(.*\)|♪.*)[\s.,!?]*$/i

const clean = (text: string): string => (text ?? '').replace(/\s+/g, ' ').trim()

// The gaps between these are half of what a dictation is tidied from, so a chunk
// whose end the model never gave is closed on the next one's start rather than
// left at nothing, which would read as every word being spoken at once.
function chunksOf(result: unknown): HeardChunk[] {
  const timed = (result as { chunks?: Timed[] }).chunks
  if (!Array.isArray(timed)) return []
  const out: HeardChunk[] = []
  for (const one of timed) {
    const text = clean(one.text ?? '')
    if (!text) continue
    const start = one.timestamp?.[0] ?? null
    const end = one.timestamp?.[1] ?? null
    out.push({
      text,
      start: typeof start === 'number' ? start : (out[out.length - 1]?.end ?? 0),
      end: typeof end === 'number' ? end : 0
    })
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i].end > out[i].start) continue
    out[i].end = i + 1 < out.length ? Math.max(out[i].start, out[i + 1].start) : out[i].start
  }
  return out
}

async function listen(audio: Float32Array): Promise<{ text: string; chunks: HeardChunk[] }> {
  const asked = { ...askedOf(LISTEN_MODEL), return_timestamps: true }
  let heard = await load()
  let result: unknown
  try {
    result = await heard(audio, asked)
  } catch (error) {
    // A card that took the model and then could not run it is the one failure
    // no check before this can see, so the fall back happens here as well as at
    // load. Without it the whole feature is silently dead on those machines.
    if (!onGpu) throw error
    listener = onCpu()
    heard = await listener
    result = await heard(audio, asked)
  }
  const raw = Array.isArray(result) ? result.map(part => part.text).join(' ') : (result as { text: string }).text
  const text = clean(raw)
  return { text: NOTHING.test(text) ? '' : text, chunks: text ? chunksOf(result) : [] }
}

self.onmessage = async (event: MessageEvent<ListenIn>) => {
  const message = event.data
  try {
    if (message.type === 'load') {
      await load()
      post({ type: 'ready' })
      return
    }
    const { text, chunks } = await listen(message.audio)
    post({ type: 'heard', id: message.id, text, chunks })
  } catch (error) {
    post({
      type: 'failed',
      id: message.type === 'hear' ? message.id : undefined,
      message: error instanceof Error ? error.message : 'The listener could not start.'
    })
  }
}
