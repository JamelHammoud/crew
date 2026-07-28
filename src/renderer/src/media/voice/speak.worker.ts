import { KokoroTTS, TextSplitterStream } from 'kokoro-js'
import { DEFAULT_VOICE, SPEAK_MODEL } from './models'

// Kokoro on this machine. It answers a sentence at a time rather than a reply
// at a time, so the first words are in the air while the last ones are still
// being drawn, which is the whole difference between a voice and a wait.

type KokoroVoice = NonNullable<Parameters<KokoroTTS['stream']>[1]>['voice']

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

// One turn at a time, and the window is the only thing that numbers them. What
// is still coming out of the model when the next turn opens belongs to a
// sentence nobody is waiting for, so it is dropped on the way out rather than
// played over the top of what is being said now. NOBODY is the turn a stopped
// mouth is on, which no turn from the window ever matches.
const NOBODY = -1

let turn = NOBODY
let splitter: TextSplitterStream | null = null

async function run(mine: number, stream: TextSplitterStream, voice: string): Promise<void> {
  const tts = await load()
  for await (const piece of tts.stream(stream, { voice: voice as KokoroVoice })) {
    if (turn !== mine) return
    // Copied rather than handed straight over, so transferring the buffer can
    // never detach one the model is still holding.
    const audio = new Float32Array(piece.audio.audio)
    post({ type: 'said', turn: mine, text: piece.text, audio }, [audio.buffer])
  }
  if (turn === mine) post({ type: 'done', turn: mine })
}

// A stream is closed once and kokoro throws on the second, so the one that has
// been let go of is forgotten rather than left for a later hush to close again.
const seal = () => {
  splitter?.close()
  splitter = null
}

const hush = () => {
  turn = NOBODY
  seal()
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
  if (message.type === 'stop') return hush()
  if (message.type === 'open') {
    hush()
    // Made here rather than inside the run, so words pushed in the same breath
    // as the turn opens are not dropped while the model is still loading.
    const stream = new TextSplitterStream()
    turn = message.turn
    splitter = stream
    run(message.turn, stream, message.voice || DEFAULT_VOICE).catch(error => {
      if (turn === message.turn) {
        post({ type: 'failed', message: error instanceof Error ? error.message : 'The voice stopped.' })
      }
    })
    return
  }
  if (turn !== message.turn) return
  if (message.type === 'push') splitter?.push(message.text)
  if (message.type === 'close') splitter?.close()
}
