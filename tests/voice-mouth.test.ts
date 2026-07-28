import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPEAK_RATE } from '../src/renderer/src/media/voice/models'
import type { SpeakIn, SpeakOut } from '../src/renderer/src/media/voice/speak.worker'

interface Played {
  at: number
  seconds: number
  stopped: boolean
}

class FakeSource {
  onended: (() => void) | null = null
  constructor(
    private readonly played: Played,
    private readonly all: FakeSource[]
  ) {
    all.push(this)
  }
  buffer: { duration: number } | null = null
  connect(): void {}
  disconnect(): void {}
  start(at: number): void {
    this.played.at = at
    this.played.seconds = this.buffer?.duration ?? 0
  }
  stop(): void {
    this.played.stopped = true
  }
  // What the browser does when the sound has finished coming out.
  finish(): void {
    this.onended?.()
  }
}

class FakeAudio {
  currentTime = 100
  sampleRate = 48_000
  state = 'running'
  destination = {}
  played: Played[] = []
  sources: FakeSource[] = []
  createGain(): unknown {
    return { gain: { value: 1 }, connect: () => {}, disconnect: () => {} }
  }
  createAnalyser(): unknown {
    return { fftSize: 2048, smoothingTimeConstant: 0, frequencyBinCount: 1024, connect: () => {}, disconnect: () => {} }
  }
  createBuffer(_channels: number, frames: number, rate: number): unknown {
    return { getChannelData: () => new Float32Array(frames), duration: frames / rate }
  }
  createBufferSource(): unknown {
    const entry: Played = { at: 0, seconds: 0, stopped: false }
    this.played.push(entry)
    return new FakeSource(entry, this.sources)
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
}

class FakeWorker {
  static last: FakeWorker | null = null
  onmessage: ((event: { data: SpeakOut }) => void) | null = null
  sent: SpeakIn[] = []
  killed = false
  constructor() {
    FakeWorker.last = this
  }
  postMessage(message: SpeakIn): void {
    this.sent.push(message)
  }
  terminate(): void {
    this.killed = true
  }
  says(message: SpeakOut): void {
    this.onmessage?.({ data: message })
  }
}

const audio = new FakeAudio()

const seconds = (count: number) => new Float32Array(SPEAK_RATE * count)

interface Ears {
  saying: string[]
  quiet: number
  failed: string[]
}

async function mouthWith(ears: Ears) {
  const { VoiceMouth } = await import('../src/renderer/src/media/voice/mouth')
  return new VoiceMouth({
    onFetching: () => {},
    onReady: () => {},
    onSaying: text => ears.saying.push(text),
    onQuiet: () => {
      ears.quiet++
    },
    onFailed: message => ears.failed.push(message)
  })
}

const freshEars = (): Ears => ({ saying: [], quiet: 0, failed: [] })

describe('the voice coming out of the speakers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    audio.played = []
    audio.sources = []
    audio.currentTime = 100
    FakeWorker.last = null
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          return audio as unknown as AudioContext
        }
      }
    )
    vi.stubGlobal('Worker', FakeWorker)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('lays each sentence after the one before it rather than over it', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    const worker = FakeWorker.last!
    worker.says({ type: 'said', turn: 1, text: 'One.', audio: seconds(1) })
    worker.says({ type: 'said', turn: 1, text: 'Two.', audio: seconds(2) })

    expect(audio.played).toHaveLength(2)
    expect(audio.played[1].at).toBeCloseTo(audio.played[0].at + 1, 5)
    expect(audio.played[0].seconds).toBeCloseTo(1, 5)
  })

  it('turns the caption over as each sentence is heard, not as it arrives', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    const worker = FakeWorker.last!
    worker.says({ type: 'said', turn: 1, text: 'One.', audio: seconds(1) })
    worker.says({ type: 'said', turn: 1, text: 'Two.', audio: seconds(1) })

    expect(ears.saying).toEqual([])
    await vi.advanceTimersByTimeAsync(100)
    expect(ears.saying).toEqual(['One.'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(ears.saying).toEqual(['One.', 'Two.'])
  })

  // The gap between two sentences empties the queue for a moment. Read as the
  // end of the turn it hands the microphone back mid-answer.
  it('is not finished just because it has run out of sound for a moment', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    const worker = FakeWorker.last!
    worker.says({ type: 'said', turn: 1, text: 'One.', audio: seconds(1) })
    mouth.seal()
    audio.sources[0].finish()

    expect(ears.quiet).toBe(0)
    expect(mouth.speaking).toBe(true)

    worker.says({ type: 'said', turn: 1, text: 'Two.', audio: seconds(1) })
    worker.says({ type: 'done', turn: 1 })
    audio.sources[1].finish()
    expect(ears.quiet).toBe(1)
    expect(mouth.speaking).toBe(false)
  })

  it('goes quiet the moment it is cut off, and stays that way', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    const worker = FakeWorker.last!
    worker.says({ type: 'said', turn: 1, text: 'A long answer.', audio: seconds(6) })
    mouth.stop()

    expect(audio.played[0].stopped).toBe(true)
    expect(ears.quiet).toBe(1)
    expect(mouth.speaking).toBe(false)
    expect(worker.sent.some(message => message.type === 'stop')).toBe(true)

    // The rest of the sentence the model had already drawn must never arrive
    // after the interruption.
    worker.says({ type: 'said', turn: 1, text: 'and the rest of it', audio: seconds(3) })
    expect(audio.played).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(ears.saying).toEqual([])
  })

  it('says nothing for a turn that has been left behind', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    mouth.open('af_heart')
    const worker = FakeWorker.last!
    worker.says({ type: 'said', turn: 1, text: 'stale', audio: seconds(1) })
    expect(audio.played).toHaveLength(0)
    worker.says({ type: 'said', turn: 2, text: 'fresh', audio: seconds(1) })
    expect(audio.played).toHaveLength(1)
  })

  it('hands the words to the model as they are written', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('bf_emma')
    mouth.push('First bit. ')
    mouth.push('Second bit.')
    mouth.seal()
    const worker = FakeWorker.last!
    expect(worker.sent).toEqual([
      { type: 'open', turn: 1, voice: 'bf_emma' },
      { type: 'push', turn: 1, text: 'First bit. ' },
      { type: 'push', turn: 1, text: 'Second bit.' },
      { type: 'close', turn: 1 }
    ])
  })

  it('never pushes into a turn that is already sealed', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.open('af_heart')
    mouth.seal()
    mouth.push('too late')
    const worker = FakeWorker.last!
    expect(worker.sent.filter(message => message.type === 'push')).toHaveLength(0)
  })

  it('says why when the model will not start', async () => {
    const ears = freshEars()
    const mouth = await mouthWith(ears)
    mouth.load()
    FakeWorker.last!.says({ type: 'failed', message: 'no room for the model' })
    expect(ears.failed).toEqual(['no room for the model'])
  })
})
