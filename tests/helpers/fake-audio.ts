import { vi } from 'vitest'

// An audio context with a clock the test winds by hand, which is the only way
// to watch music that is scheduled ahead of itself.

class Param {
  value = 0
  readonly wrote: number[] = []
  setValueAtTime(value: number): this {
    this.value = value
    this.wrote.push(value)
    return this
  }
  linearRampToValueAtTime(value: number): this {
    this.value = value
    this.wrote.push(value)
    return this
  }
  exponentialRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }
  setTargetAtTime(value: number): this {
    this.value = value
    this.wrote.push(value)
    return this
  }
}

export interface Sounded {
  at: number
  hz: number
  stopped: number | null
}

export class FakeAudio {
  currentTime = 100
  sampleRate = 48000
  state = 'running'
  destination = { name: 'destination' }
  sounded: Sounded[] = []
  gains: Param[] = []
  // What the analyser hands back, so a test can say how loud the music is.
  heard: number[] = []

  clear(): void {
    this.sounded = []
    this.gains = []
  }

  // Every note that was handed over, in the order it will sound.
  notes(): Sounded[] {
    return [...this.sounded].sort((a, b) => a.at - b.at)
  }

  private source(hz: Param | null): unknown {
    const entry: Sounded = { at: 0, hz: 0, stopped: null }
    return {
      buffer: null,
      loop: false,
      frequency: hz,
      detune: new Param(),
      connect: () => {},
      start: (at: number) => {
        entry.at = at
        entry.hz = hz?.value ?? 0
        this.sounded.push(entry)
      },
      stop: (at: number) => {
        entry.stopped = at
      }
    }
  }

  createOscillator(): unknown {
    return this.source(new Param())
  }

  createBufferSource(): unknown {
    return this.source(null)
  }

  createGain(): unknown {
    const gain = new Param()
    this.gains.push(gain)
    return { gain, connect: () => {}, disconnect: () => {} }
  }

  createAnalyser(): unknown {
    const held = { size: 2048 }
    return {
      get fftSize(): number {
        return held.size
      },
      set fftSize(next: number) {
        held.size = next
      },
      smoothingTimeConstant: 0,
      get frequencyBinCount(): number {
        return held.size / 2
      },
      connect: () => {},
      disconnect: () => {},
      getByteFrequencyData: (into: Uint8Array) => {
        for (let i = 0; i < into.length; i++) into[i] = this.heard[i] ?? 0
      }
    }
  }

  // Everything the ear and a dictation hang off the microphone. The worklet
  // itself is never really loaded here: what a test drives is the block of
  // samples coming back off its port.
  audioWorklet = { addModule: (): Promise<void> => Promise.resolve() }

  createMediaStreamSource(): unknown {
    return { connect: () => {}, disconnect: () => {} }
  }

  createBiquadFilter(): unknown {
    return { type: 'lowpass', frequency: new Param(), Q: new Param(), connect: () => {} }
  }

  createStereoPanner(): unknown {
    return { pan: new Param(), connect: () => {} }
  }

  createConvolver(): unknown {
    return { buffer: null, connect: () => {} }
  }

  createBuffer(channels: number, frames: number): unknown {
    const data = Array.from({ length: channels }, () => new Float32Array(frames))
    return { getChannelData: (channel: number) => data[channel], duration: frames / this.sampleRate }
  }

  decodeAudioData(): Promise<unknown> {
    return Promise.resolve({ duration: 12, sampleRate: this.sampleRate, length: 12 * this.sampleRate })
  }

  resume(): Promise<void> {
    return Promise.resolve()
  }
}

// One context for the run, the way the app keeps one for the app.
export function installFakeAudio(): FakeAudio {
  const audio = new FakeAudio()
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return audio
      }
    }
  )
  return audio
}
