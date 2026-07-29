import type { MediaKind } from '../../../../shared/media'
import { context } from '../audio'
import { captureMic } from '../capture'
import { storedInput } from '../devices'
import { EAR_PROCESSOR, loadEarWorklet } from '../voice/earWorklet'
import { FRAME, HEARD_RATE, rmsOf, VoiceGate } from '../voice/gate'
import { join, resample } from '../voice/resample'

// One dictation's worth of microphone. Where the voice conversation's ear
// decides for itself when somebody started and stopped, here the key has already
// answered that, so this keeps every sample from the moment it opened to the
// moment it was told to stop.
//
// What it does do is find the pauses. A dictation is read in pieces, and a piece
// whose speaker has clearly finished with it can go to whisper while they are
// still talking, so by the time the key is let go only the tail is left to read.
// That is the whole difference between a long dictation landing at once and one
// that lands a beat per sentence spoken.

// Nothing shorter is worth sending on its own. Whisper reads a short clip out of
// context and a run of two-word pieces reads worse than one long one.
const LEAST_MS = 2400

export interface TakeEars {
  // A stretch that is finished with, handed over while the person carries on.
  // `at` is where it began, in seconds from the start of the take.
  onPiece: (audio: Float32Array, at: number) => void
}

export class ScribeTake {
  private track: MediaStreamTrack | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private gate = new VoiceGate()
  private held: Float32Array[] = []
  private spare = new Float32Array(0)
  private length = 0
  private sealed = 0
  private open = false

  analyser: AnalyserNode | null = null

  constructor(private readonly ears: TakeEars) {}

  async start(): Promise<MediaKind | null> {
    const ctx = context()
    if (!ctx) return 'microphone'
    if (!(await loadEarWorklet(ctx))) return 'microphone'
    const { track, problem } = await captureMic(storedInput('microphone'))
    if (!track) return problem ?? 'microphone'
    this.track = track
    this.source = ctx.createMediaStreamSource(new MediaStream([track]))
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.55
    this.node = new AudioWorkletNode(ctx, EAR_PROCESSOR)
    this.node.port.onmessage = event => this.hear(event.data as Float32Array, ctx.sampleRate)
    this.source.connect(this.analyser)
    this.source.connect(this.node)
    // A worklet with nowhere to go is not pulled at all in some builds, so it
    // runs into a gain of nothing rather than into the speakers.
    this.sink = ctx.createGain()
    this.sink.gain.value = 0
    this.node.connect(this.sink)
    this.sink.connect(ctx.destination)
    this.open = true
    return null
  }

  get listening(): boolean {
    return this.open
  }

  get seconds(): number {
    return this.length / HEARD_RATE
  }

  // Whatever is left after the last piece went. This is the only part of a long
  // dictation that has to be read once the key is let go.
  rest(): { audio: Float32Array; at: number } {
    const at = this.sealed / HEARD_RATE
    const audio = join(this.held)
    this.held = []
    this.sealed = this.length
    return { audio, at }
  }

  close(): void {
    this.open = false
    this.node?.port.close()
    this.node?.disconnect()
    this.sink?.disconnect()
    this.analyser?.disconnect()
    this.source?.disconnect()
    this.track?.stop()
    this.node = null
    this.sink = null
    this.analyser = null
    this.source = null
    this.track = null
    this.gate.reset()
    this.held = []
    this.spare = new Float32Array(0)
    this.length = 0
    this.sealed = 0
  }

  private hear(block: Float32Array, rate: number): void {
    if (!this.open) return
    const at16 = resample(block, rate, HEARD_RATE)
    const carried = this.spare.length > 0 ? join([this.spare, at16]) : at16
    const whole = Math.floor(carried.length / FRAME)
    this.spare = carried.subarray(whole * FRAME).slice()
    for (let i = 0; i < whole; i++) {
      this.frame(carried.subarray(i * FRAME, (i + 1) * FRAME))
    }
  }

  private frame(frame: Float32Array): void {
    this.held.push(frame.slice())
    this.length += frame.length
    // The gate is only ever asked where the pauses are. Nothing it calls too
    // short is dropped, because a cough in the middle of a sentence is still
    // between two halves of that sentence and the words either side of it are
    // what the person meant to write.
    const word = this.gate.push(rmsOf(frame), (FRAME / HEARD_RATE) * 1000)
    if (word !== 'ended' && word !== 'dropped') return
    if ((this.length - this.sealed) / HEARD_RATE < LEAST_MS / 1000) return
    const { audio, at } = this.rest()
    if (audio.length > 0) this.ears.onPiece(audio, at)
  }
}
