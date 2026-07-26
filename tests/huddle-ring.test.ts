// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyRoom, type HuddlePeer, type HuddleRoom } from '../src/shared/huddle'
import { installFakeRtc } from './helpers/fake-rtc'

const kept = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => kept.get(key) ?? null,
  setItem: (key: string, value: string) => void kept.set(key, value),
  removeItem: (key: string) => void kept.delete(key),
  clear: () => kept.clear()
})

const started: number[] = []
const pitched: number[] = []
const landed: number[] = []
const gains: number[] = []
let filters: { type: string; hz: number[] }[] = []

class FakeParam {
  #held = 0
  constructor(
    private readonly set?: number[],
    private readonly ramp?: number[]
  ) {}
  get value(): number {
    return this.#held
  }
  set value(next: number) {
    this.#held = next
    this.set?.push(next)
  }
  setValueAtTime(value: number): void {
    this.set?.push(value)
  }
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(value: number): void {
    this.ramp?.push(value)
  }
}

class FakeAudioContext {
  currentTime = 0
  sampleRate = 48000
  state = 'running'
  destination = {}
  createOscillator(): unknown {
    return {
      type: 'sine',
      frequency: new FakeParam(pitched, landed),
      detune: new FakeParam(),
      connect: () => {},
      start: (at: number) => void started.push(at),
      stop: () => {}
    }
  }
  createGain(): unknown {
    return { gain: new FakeParam(gains), connect: () => {} }
  }
  createBiquadFilter(): unknown {
    const entry = { type: 'lowpass', hz: [] as number[] }
    filters.push(entry)
    return {
      get type() {
        return entry.type
      },
      set type(next: string) {
        entry.type = next
      },
      frequency: new FakeParam(entry.hz, entry.hz),
      Q: new FakeParam(),
      connect: () => {}
    }
  }
  createBufferSource(): unknown {
    return { buffer: null, connect: () => {}, start: () => {}, stop: () => {} }
  }
  createBuffer(channels: number, frames: number): unknown {
    const data = Array.from({ length: channels }, () => new Float32Array(frames))
    return { getChannelData: (channel: number) => data[channel] }
  }
  createConvolver(): unknown {
    return { buffer: null, connect: () => {} }
  }
  createStereoPanner(): unknown {
    return { pan: new FakeParam(), connect: () => {} }
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
}

vi.stubGlobal('AudioContext', FakeAudioContext)
installFakeRtc()

const wire = vi.hoisted(() => ({
  deliver: null as ((msg: unknown) => void) | null,
  watch: null as ((state: { connection: string }) => void) | null,
  connection: 'online'
}))

vi.mock('../src/renderer/src/state/store', () => ({
  onHuddle: (fn: (msg: unknown) => void) => {
    wire.deliver = fn
    return () => {}
  },
  sendHuddle: () => {},
  useCrew: {
    getState: () => ({ connection: wire.connection }),
    subscribe: (fn: (state: { connection: string }) => void) => {
      wire.watch = fn
      return () => {}
    }
  }
}))

const { useHuddle } = await import('../src/renderer/src/state/huddle')
const { CALL, stopRinging } = await import('../src/renderer/src/media/sounds')
const { playRing, ringLength } = await import('../src/renderer/src/media/ring')
const { setSounds } = await import('../src/renderer/src/state/sound')

const peer = (peerId: string, name: string): HuddlePeer => ({
  peerId,
  memberId: `m-${peerId}`,
  name,
  muted: false,
  camera: false,
  sharing: false,
  joinedAt: 1
})

const room = (...peers: HuddlePeer[]): HuddleRoom => ({ peers, startedAt: 10 })
const arrives = (next: HuddleRoom): void => wire.deliver?.({ type: 'huddle.room', room: next })

const backToHome = (): void => {
  wire.connection = 'home'
  wire.watch?.({ connection: 'home' })
}

const backOnline = (): void => {
  wire.connection = 'online'
  wire.watch?.({ connection: 'online' })
}

const heard = (): number => {
  const count = started.length
  started.length = 0
  return count
}

const loudest = (): number => {
  const peak = gains.length === 0 ? 0 : Math.max(...gains)
  gains.length = 0
  return peak
}

describe('the noise a huddle makes when it starts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    backToHome()
    backOnline()
    stopRinging()
    kept.clear()
    started.length = 0
    pitched.length = 0
    landed.length = 0
    gains.length = 0
    filters = []
    useHuddle.setState({ room: emptyRoom(), peerId: 'me', joined: false, joining: false, confirmed: false })
  })

  afterEach(() => {
    stopRinging()
    vi.useRealTimers()
  })

  it('calls out to everyone who was not the one to start it', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))

    expect(started.length).toBeGreaterThan(0)
  })

  it('stays quiet for the person who started it', () => {
    arrives(emptyRoom())
    useHuddle.setState({ joined: true })
    arrives(room(peer('me', 'Jamel')))

    expect(started.length).toBe(0)
  })

  it('says nothing about a call that was already under way when this window opened', () => {
    arrives(room(peer('a', 'Ali'), peer('b', 'Kim')))

    expect(started.length).toBe(0)
  })

  it('leaves a call that fills up alone, so it rings once rather than once a head', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    heard()
    arrives(room(peer('a', 'Ali'), peer('b', 'Kim')))

    expect(started.length).toBe(0)
  })

  it('says its piece again while it waits', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    const first = heard()
    vi.advanceTimersByTime(CALL.every * 1000)

    expect(first).toBeGreaterThan(0)
    expect(heard()).toBeGreaterThan(0)
  })

  it('gives up on its own rather than ringing until someone answers', () => {
    expect(ringLength(CALL)).toBeLessThanOrEqual(5)

    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    vi.advanceTimersByTime(5000)
    heard()
    vi.advanceTimersByTime(60_000)

    expect(started.length).toBe(0)
  })

  it('falls away at the end instead of being cut off', () => {
    expect(CALL.levels.at(-1)).toBeLessThan(CALL.levels[0])

    playRing({ phrase: [{ hz: 600, at: 0, length: 0.1, gain: 1 }], every: 1, levels: [1, 0.5] })
    const first = loudest()
    vi.advanceTimersByTime(1000)

    expect(first).toBeGreaterThan(0)
    expect(loudest()).toBeCloseTo(first / 2, 5)
  })

  it('stops the moment you join', async () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    heard()
    await useHuddle.getState().join()
    vi.advanceTimersByTime(60_000)

    expect(started.length).toBe(0)
  })

  it('stops when the call is called off', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    heard()
    arrives(emptyRoom())
    vi.advanceTimersByTime(60_000)

    expect(started.length).toBe(0)
  })

  it('stops when you leave the session', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))
    heard()
    backToHome()
    vi.advanceTimersByTime(60_000)

    expect(started.length).toBe(0)
  })

  it('bubbles up into every note rather than sounding a bare tone', () => {
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))

    expect(pitched.length).toBeGreaterThan(0)
    expect(pitched.length).toBe(landed.length)
    for (let i = 0; i < pitched.length; i++) expect(pitched[i]).toBeLessThan(landed[i])
    expect(filters.filter(one => one.type === 'bandpass').length).toBe(CALL.phrase.length)
  })

  it('says nothing when sounds are muted', () => {
    setSounds(false)
    arrives(emptyRoom())
    arrives(room(peer('a', 'Ali')))

    expect(started.length).toBe(0)
    setSounds(true)
  })
})
