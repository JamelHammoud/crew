// The microphone hands over whatever rate the machine runs its audio at, and
// whisper listens at one rate and no other. Dropping samples to get there folds
// every high frequency back down into the voice as a whistle, so each sample
// out is the average of the run of samples it stands for, which is the cheapest
// filter there is and the only one speech needs.

export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to || input.length === 0) return input
  const step = from / to
  const frames = Math.max(1, Math.floor(input.length / step))
  const out = new Float32Array(frames)
  for (let i = 0; i < frames; i++) {
    const start = i * step
    const end = start + step
    const first = Math.floor(start)
    const last = Math.min(input.length, Math.ceil(end))
    let sum = 0
    let count = 0
    for (let at = first; at < last; at++) {
      sum += input[at]
      count++
    }
    out[i] = count > 0 ? sum / count : input[Math.min(input.length - 1, first)]
  }
  return out
}

// A run of pieces as one. Nothing here streams to disk, so an utterance is only
// ever a handful of seconds of numbers.
export function join(chunks: readonly Float32Array[]): Float32Array {
  let total = 0
  for (const chunk of chunks) total += chunk.length
  const out = new Float32Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

// What was heard just before the gate opened. Without it every utterance is
// missing the front of its first word, which whisper then guesses at.
export class PreRoll {
  private held: Float32Array[] = []
  private length = 0

  constructor(private readonly frames: number) {}

  push(chunk: Float32Array): void {
    this.held.push(chunk)
    this.length += chunk.length
    while (this.held.length > 1 && this.length - this.held[0].length >= this.frames) {
      this.length -= this.held.shift()!.length
    }
  }

  take(): Float32Array[] {
    const out = this.held
    this.held = []
    this.length = 0
    return out
  }

  clear(): void {
    this.held = []
    this.length = 0
  }
}
