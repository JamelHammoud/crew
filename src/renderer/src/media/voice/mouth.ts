import { context } from '../audio'
import { SPEAK_RATE } from './models'
import type { SpeakIn, SpeakOut } from './speak.worker'

// A little air in front of the first chunk, so scheduling it does not land in
// the past on a machine that took a moment to hand the audio over.
const LEAD = 0.06

export interface MouthEars {
  onFetching: (file: string, loaded: number, total: number) => void
  onReady: () => void
  // The words of the sentence that has just started coming out, which is what
  // the caption reads. A sentence at a time is the finest the model works at.
  onSaying: (text: string) => void
  onQuiet: () => void
  onFailed: (message: string) => void
}

export class VoiceMouth {
  private worker: Worker | null = null
  private out: GainNode | null = null
  private live: AudioBufferSourceNode[] = []
  private nextAt = 0
  private turn = 0
  private waiting = 0
  private sealed = true

  analyser: AnalyserNode | null = null

  constructor(private readonly ears: MouthEars) {}

  load(): void {
    this.hire()?.postMessage({ type: 'load' } satisfies SpeakIn)
  }

  get speaking(): boolean {
    return this.waiting > 0 || !this.sealed
  }

  // A turn is opened before there is anything to say, so the first sentence the
  // agent writes is already on its way to the model as it lands.
  open(voice: string): void {
    this.silence()
    this.turn++
    this.sealed = false
    this.hire()?.postMessage({ type: 'open', turn: this.turn, voice } satisfies SpeakIn)
  }

  push(text: string): void {
    if (this.sealed || !text) return
    this.worker?.postMessage({ type: 'push', turn: this.turn, text } satisfies SpeakIn)
  }

  seal(): void {
    if (this.sealed) return
    this.sealed = true
    this.worker?.postMessage({ type: 'close', turn: this.turn } satisfies SpeakIn)
    this.settle()
  }

  // Cut in. Everything scheduled goes, and so does everything the model has not
  // handed over yet, because the one thing an interruption must not do is let
  // the rest of the old sentence out afterwards.
  stop(): void {
    const was = this.speaking
    this.sealed = true
    this.turn++
    this.worker?.postMessage({ type: 'stop' } satisfies SpeakIn)
    this.silence()
    if (was) this.ears.onQuiet()
  }

  close(): void {
    this.silence()
    this.worker?.terminate()
    this.worker = null
    this.out?.disconnect()
    this.analyser?.disconnect()
    this.out = null
    this.analyser = null
  }

  private silence(): void {
    for (const source of this.live) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // Already finished on its own, which is the same silence.
      }
      source.disconnect()
    }
    this.live = []
    this.waiting = 0
    this.nextAt = 0
  }

  private hire(): Worker | null {
    if (this.worker) return this.worker
    if (typeof Worker === 'undefined') return null
    const worker = new Worker(new URL('./speak.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<SpeakOut>) => this.heard(event.data)
    this.worker = worker
    return worker
  }

  private heard(message: SpeakOut): void {
    if (message.type === 'fetching') return this.ears.onFetching(message.file, message.loaded, message.total)
    if (message.type === 'ready') return this.ears.onReady()
    if (message.type === 'failed') return this.ears.onFailed(message.message)
    if (message.turn !== this.turn) return
    if (message.type === 'done') return this.settle()
    this.play(message.audio, message.text)
  }

  private play(audio: Float32Array, text: string): void {
    const ctx = context()
    if (!ctx || audio.length === 0) return
    if (!this.out || !this.analyser) {
      this.analyser = ctx.createAnalyser()
      // Wide, so the lowest band is not one bin of a hundred hertz. The orb is
      // read off this, and a bass band that never moves is an orb that only
      // ever breathes at one end.
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.72
      this.out = ctx.createGain()
      this.out.connect(this.analyser)
      this.analyser.connect(ctx.destination)
    }
    const buffer = ctx.createBuffer(1, audio.length, SPEAK_RATE)
    buffer.getChannelData(0).set(audio)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.out)
    const at = Math.max(ctx.currentTime + LEAD, this.nextAt)
    const first = this.waiting === 0
    this.waiting++
    this.live.push(source)
    source.onended = () => {
      this.live = this.live.filter(held => held !== source)
      this.waiting--
      this.settle()
    }
    source.start(at)
    this.nextAt = at + buffer.duration
    if (first) globalThis.setTimeout(() => this.ears.onSaying(text), Math.max(0, (at - ctx.currentTime) * 1000))
    else globalThis.setTimeout(() => this.ears.onSaying(text), Math.max(0, (at - ctx.currentTime) * 1000))
  }

  private settle(): void {
    if (this.waiting > 0 || !this.sealed) return
    this.nextAt = 0
    this.ears.onQuiet()
  }
}
