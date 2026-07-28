import type { MediaKind } from '../../../../shared/media'
import { context } from '../audio'
import { captureMic } from '../capture'
import { storedInput } from '../devices'
import { EAR_PROCESSOR, EAR_SOURCE } from './earWorklet'
import { FRAME, HEARD_RATE, rmsOf, VoiceGate } from './gate'
import { join, PreRoll, resample } from './resample'

const PRE_ROLL_MS = 320

export interface EarEars {
  // The moment the gate opens, which is also the moment somebody has cut in on
  // the agent. It arrives before the words do, because stopping the voice is
  // the one thing that cannot wait for whisper.
  onStart: () => void
  // Nothing, for a cough or a chair: the gate opened and what came out of it
  // was too short to be a word. It still has to be said, or the one waiting on
  // it is left standing in the middle of a turn nobody is taking.
  onEnd: (audio: Float32Array | null) => void
}

const loaded = new WeakSet<AudioContext>()

async function loadWorklet(ctx: AudioContext): Promise<boolean> {
  if (loaded.has(ctx)) return true
  if (!ctx.audioWorklet) return false
  const url = URL.createObjectURL(new Blob([EAR_SOURCE], { type: 'application/javascript' }))
  try {
    await ctx.audioWorklet.addModule(url)
    loaded.add(ctx)
    return true
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The microphone, listened to for the start and end of things somebody says.
// It stays open for the whole conversation, the agent's turn included, which is
// what lets somebody talk over the answer rather than wait it out.
export class VoiceEar {
  private track: MediaStreamTrack | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private node: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private gate = new VoiceGate()
  private preRoll = new PreRoll(Math.round((HEARD_RATE * PRE_ROLL_MS) / 1000))
  private said: Float32Array[] = []
  private spare = new Float32Array(0)
  private off = false

  analyser: AnalyserNode | null = null

  constructor(private readonly ears: EarEars) {}

  async open(): Promise<MediaKind | null> {
    const ctx = context()
    if (!ctx) return 'microphone'
    if (!(await loadWorklet(ctx))) return 'microphone'
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
    return null
  }

  // Off is the microphone itself off, not a gate held shut, so nothing in the
  // room reaches the app at all while it is.
  mute(on: boolean): void {
    this.off = on
    if (this.track) this.track.enabled = !on
    if (!on) return
    this.gate.reset()
    this.preRoll.clear()
    this.said = []
    this.spare = new Float32Array(0)
  }

  get muted(): boolean {
    return this.off
  }

  guarded(on: boolean): void {
    this.gate.guarded(on)
  }

  close(): void {
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
    this.preRoll.clear()
    this.said = []
  }

  private hear(block: Float32Array, rate: number): void {
    if (this.off) return
    const at16 = resample(block, rate, HEARD_RATE)
    const carried = this.spare.length > 0 ? join([this.spare, at16]) : at16
    const whole = Math.floor(carried.length / FRAME)
    this.spare = carried.subarray(whole * FRAME).slice()
    for (let i = 0; i < whole; i++) {
      this.frame(carried.subarray(i * FRAME, (i + 1) * FRAME))
    }
  }

  private frame(frame: Float32Array): void {
    const was = this.gate.speaking
    const word = this.gate.push(rmsOf(frame), (FRAME / HEARD_RATE) * 1000)
    if (word === 'quiet') {
      this.preRoll.push(frame.slice())
      return
    }
    if (!was) {
      this.said = this.preRoll.take()
      this.ears.onStart()
    }
    this.said.push(frame.slice())
    if (word === 'speaking') return
    const audio = join(this.said)
    this.said = []
    this.preRoll.clear()
    this.ears.onEnd(word === 'ended' ? audio : null)
  }
}
