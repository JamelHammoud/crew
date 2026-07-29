import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EAR_BLOCK } from '../src/renderer/src/media/voice/earWorklet'
import { FRAME, HEARD_RATE } from '../src/renderer/src/media/voice/gate'
import { ScribeTake } from '../src/renderer/src/media/scribe/take'
import { trim } from '../src/renderer/src/media/scribe/trim'
import { installFakeAudio } from './helpers/fake-audio'

// One dictation's worth of microphone, against a worklet that never really runs.
// What is driven here is the only thing that matters about it: the samples going
// in, the pieces coming out, and where each one says it began.

const RATE = 48_000
const BLOCKS_PER_SECOND = RATE / EAR_BLOCK

let ports: Array<{ onmessage: ((event: { data: Float32Array }) => void) | null }> = []

function installWorklet(): void {
  ports = []
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port = { onmessage: null, close: () => {} }
      constructor() {
        ports.push(this.port as never)
      }
      connect(): void {}
      disconnect(): void {}
    }
  )
  vi.stubGlobal(
    'MediaStream',
    class {
      constructor(readonly tracks: unknown[]) {}
    }
  )
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: () =>
        Promise.resolve({ getAudioTracks: () => [{ stop: () => {}, getSettings: () => ({}) }] })
    }
  })
}

// A block of what the microphone is hearing, at the rate the machine runs at.
const block = (level: number): Float32Array => {
  const out = new Float32Array(EAR_BLOCK)
  for (let i = 0; i < out.length; i++) out[i] = i % 2 === 0 ? level : -level
  return out
}

const feed = (seconds: number, level: number): void => {
  const blocks = Math.round(seconds * BLOCKS_PER_SECOND)
  for (let i = 0; i < blocks; i++) ports[0]?.onmessage?.({ data: block(level) })
}

describe('the microphone a dictation is taken through', () => {
  beforeEach(() => {
    installFakeAudio()
    installWorklet()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('keeps every sample from the moment it was told to', async () => {
    const take = new ScribeTake({ onPiece: () => {} })
    expect(await take.start()).toBe(null)
    take.record(true)
    feed(1, 0.2)
    expect(take.rest().audio.length).toBeGreaterThan(HEARD_RATE * 0.9)
    take.close()
  })

  // A microphone that is standing open is not a microphone anything is being
  // heard through, which is the whole of what makes keeping it open bearable.
  it('keeps nothing at all while it is only open', async () => {
    const take = new ScribeTake({ onPiece: () => {} })
    await take.start()
    feed(2, 0.2)
    expect(take.rest().audio.length).toBe(0)
    take.record(true)
    feed(1, 0.2)
    expect(take.rest().audio.length).toBeGreaterThan(0)
    take.close()
  })

  it('hands a finished stretch over while somebody is still talking', async () => {
    const pieces: Array<{ seconds: number; at: number }> = []
    const take = new ScribeTake({
      onPiece: (audio, at) => pieces.push({ seconds: audio.length / HEARD_RATE, at })
    })
    await take.start()
    take.record(true)
    feed(4, 0.25)
    expect(pieces).toHaveLength(0)
    // The pause after it is what says the stretch is finished with.
    feed(1.2, 0.001)
    expect(pieces).toHaveLength(1)
    expect(pieces[0].at).toBe(0)
    expect(pieces[0].seconds).toBeGreaterThan(4)
    take.close()
  })

  it('starts the next stretch where the last one ended', async () => {
    const pieces: Array<{ seconds: number; at: number }> = []
    const take = new ScribeTake({
      onPiece: (audio, at) => pieces.push({ seconds: audio.length / HEARD_RATE, at })
    })
    await take.start()
    take.record(true)
    feed(4, 0.25)
    feed(1.2, 0.001)
    feed(4, 0.25)
    feed(1.2, 0.001)
    expect(pieces).toHaveLength(2)
    expect(pieces[1].at).toBeCloseTo(pieces[0].seconds, 1)
    const rest = take.rest()
    expect(rest.at).toBeCloseTo(pieces[1].at + pieces[1].seconds, 1)
    take.close()
  })

  // A pause inside a sentence is not the end of one, and a run too short to be
  // worth reading on its own stays with what follows it.
  it('does not break on a gap too short to have finished anything', async () => {
    const pieces: number[] = []
    const take = new ScribeTake({ onPiece: (_audio, at) => pieces.push(at) })
    await take.start()
    take.record(true)
    feed(1, 0.25)
    feed(1.2, 0.001)
    feed(1, 0.25)
    expect(pieces).toHaveLength(0)
    take.close()
  })

  it('leaves nothing behind when it closes', async () => {
    const take = new ScribeTake({ onPiece: () => {} })
    await take.start()
    take.record(true)
    feed(2, 0.25)
    take.close()
    expect(take.listening).toBe(false)
    expect(take.rest().audio.length).toBe(0)
  })
})

const quiet = (frames: number): number[] => new Array(frames * FRAME).fill(0.0004)

const loud = (frames: number): number[] =>
  Array.from({ length: frames * FRAME }, (_, i) => (i % 2 === 0 ? 0.3 : -0.3))

describe('the quiet at both ends of a dictation', () => {
  it('takes the room off the front and the back', () => {
    const audio = new Float32Array([...quiet(30), ...loud(40), ...quiet(30)])
    const { audio: cut, spoke } = trim(audio, HEARD_RATE)
    expect(spoke).toBe(true)
    expect(cut.length).toBeLessThan(audio.length)
    expect(cut.length).toBeGreaterThan(40 * FRAME)
  })

  // Speech starts before it is loud enough to measure, so a word missing its
  // first consonant is one whisper then invents.
  it('leaves room in front of the first word', () => {
    const audio = new Float32Array([...quiet(30), ...loud(40), ...quiet(30)])
    const kept = trim(audio, HEARD_RATE).audio.length
    expect(kept).toBeGreaterThan(40 * FRAME + FRAME * 4)
  })

  it('says a room where nobody spoke said nothing', () => {
    const { audio, spoke } = trim(new Float32Array(quiet(80)), HEARD_RATE)
    expect(spoke).toBe(false)
    expect(audio.length).toBe(0)
  })

  it('leaves something too short to measure exactly as it is', () => {
    const audio = new Float32Array(loud(1))
    expect(trim(audio, HEARD_RATE).audio).toBe(audio)
  })
})
