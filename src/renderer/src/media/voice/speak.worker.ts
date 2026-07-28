import { KokoroTTS, TextSplitterStream } from 'kokoro-js'
import { DEFAULT_VOICE, SPEAK_MODEL } from './models'

// Kokoro on this machine. It answers a sentence at a time rather than a reply
// at a time, so the first words are in the air while the last ones are still
// being drawn, which is the whole difference between a voice and a wait.

export type SpeakIn =
  | { type: 'load' }
  | { type: 'open'; turn: number; voice: string }
  | { type: 'push'; turn: number; text: string }
  | { type: 'close'; turn: number }
  | { type: 'stop' }

export type SpeakOut =
  | { type: 'fetching'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'said'; turn: number; text: string; audio: Float32Array }
  | { type: 'done'; turn: number }
  | { type: 'failed'; message: string }

const post = (message: SpeakOut, transfer: Transferable[] = []) =>
  (globalThis as unknown as Worker).postMessage(message, transfer)

let mouth: Promise<KokoroTTS> | null = null

const load = (): Promise<KokoroTTS> => {
  mouth ??= KokoroTTS.from_pretrained(SPEAK_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (report: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (report.status !== 'progress') return
      post({ type: 'fetching', file: report.file ?? '', loaded: report.loaded ?? 0, total: report.total ?? 0 })
    }
  })
  return mouth
}

// One turn at a time. Anything still coming out of the model when the next turn
// opens belongs to a sentence nobody is waiting for any more, so it is dropped
// on the way out rather than played over the top of what is being said now.
let turn = 0
let splitter: TextSplitterStream | null = null

async function speak(startedFor: number, voice: string): Promise<void> {
  const tts = await load()
  const stream = new TextSplitterStream()
  splitter = stream
  try {
    for await (const piece of tts.stream(stream, { voice: voice as never })) {
      if (turn !== startedFor) return
      const audio = piece.audio.data
      post({ type: 'said', turn: startedFor, text: piece.text, audio }, [audio.buffer])
    }
    if (turn === startedFor) post({ type: 'done', turn: startedFor })
  } finally {
    if (splitter === stream) splitter = null
  }
}

self.onmessage = (event: MessageEvent<SpeakIn>) => {
  const message = event.data
  if (message.type === 'load') {
    load().then(
      () => post({ type: 'ready' }),
      error => post({ type: 'failed', message: error instanceof Error ? error.message : 'The voice could not start.' })
    )
    return
  }
  if (message.type === 'stop') {
    turn++
    splitter?.close()
    splitter = null
    return
  }
  if (message.type === 'open') {
    turn = message.turn
    speak(message.turn, message.voice || DEFAULT_VOICE).catch(error =>
      post({ type: 'failed', message: error instanceof Error ? error.message : 'The voice stopped.' })
    )
    return
  }
  if (turn !== message.turn) return
  if (message.type === 'push') splitter?.push(message.text)
  if (message.type === 'close') splitter?.close()
}
