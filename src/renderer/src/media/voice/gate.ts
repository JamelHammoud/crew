// Where one thing somebody said starts and where it ends. A level alone cannot
// answer that: a room has a floor of its own, a sentence has gaps in it, and a
// chair moving is louder than a word. The gate watches the floor the room is
// sitting at and opens on whatever stands well above it for long enough.

export const HEARD_RATE = 16000

// 32ms of sound at the rate whisper listens at. Fine enough to catch the front
// of a word and coarse enough that a click is one frame and never two.
export const FRAME = 512

export type GateWord = 'quiet' | 'speaking' | 'ended' | 'dropped'

// Nothing under this is ever speech, however quiet the room gets. Without it a
// silent room walks its own floor down to nothing and starts hearing the fans.
const NEVER_UNDER = 0.0018
const ALWAYS_OVER = 0.0125

const OPEN_OVER = 2.6
const CLOSE_OVER = 1.5

// The floor drops to a quiet room quickly and climbs to a loud one slowly, so
// somebody talking steadily never raises the floor past their own voice.
const FALL = 0.35
const RISE = 0.004

const OPEN_MS = 96
const CLOSE_MS = 620
const SHORTEST_MS = 240
const LONGEST_MS = 30_000

// Echo cancellation leaves some of the agent's own voice in the microphone, so
// while it is talking the gate asks for more before it believes it is being
// interrupted. Loose here and the agent talks itself到 a stop.
const GUARD_OVER = 2.2
const GUARD_MS = 220

export class VoiceGate {
  private floor = ALWAYS_OVER
  private open = false
  private loudMs = 0
  private quietMs = 0
  private heldMs = 0
  private guard = false

  // On while the agent is speaking, which is the only time the microphone is
  // hearing something the room did not make.
  guarded(on: boolean): void {
    this.guard = on
  }

  get speaking(): boolean {
    return this.open
  }

  get noiseFloor(): number {
    return this.floor
  }

  reset(): void {
    this.open = false
    this.loudMs = 0
    this.quietMs = 0
    this.heldMs = 0
  }

  push(level: number, ms: number): GateWord {
    const opensAt = Math.max(ALWAYS_OVER, this.floor * OPEN_OVER) * (this.guard ? GUARD_OVER : 1)
    const closesAt = Math.max(ALWAYS_OVER * 0.55, this.floor * CLOSE_OVER)
    if (!this.open) {
      // The floor only moves while nobody is talking. Tracked through an
      // utterance it climbs into the voice and closes the gate mid-sentence.
      this.floor = Math.max(NEVER_UNDER, this.floor + (level - this.floor) * (level < this.floor ? FALL : RISE))
      this.loudMs = level > opensAt ? this.loudMs + ms : 0
      if (this.loudMs < (this.guard ? GUARD_MS : OPEN_MS)) return 'quiet'
      this.open = true
      this.heldMs = this.loudMs
      this.quietMs = 0
      return 'speaking'
    }
    this.heldMs += ms
    this.quietMs = level < closesAt ? this.quietMs + ms : 0
    if (this.quietMs >= CLOSE_MS || this.heldMs >= LONGEST_MS) return this.close()
    return 'speaking'
  }

  // A cough, a door, one syllable of nothing. Long enough to open the gate and
  // too short to be worth sending anywhere.
  private close(): GateWord {
    const said = this.heldMs - this.quietMs >= SHORTEST_MS
    this.reset()
    return said ? 'ended' : 'dropped'
  }
}

export const rmsOf = (frame: Float32Array): number => {
  let sum = 0
  for (const sample of frame) sum += sample * sample
  return Math.sqrt(sum / Math.max(1, frame.length))
}
