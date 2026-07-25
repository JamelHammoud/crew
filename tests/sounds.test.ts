// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../src/shared/events'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear()
})

const started: number[] = []
const pitched: number[] = []
const landed: number[] = []
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
    return { gain: new FakeParam(), connect: () => {} }
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
    return {
      buffer: null,
      connect: () => {},
      start: (at: number) => void started.push(at),
      stop: () => {}
    }
  }
  createBuffer(_channels: number, frames: number): unknown {
    return { getChannelData: () => new Float32Array(frames) }
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
}

vi.stubGlobal('AudioContext', FakeAudioContext)

const { playSound, soundFor } = await import('../src/renderer/src/media/sounds')
const { setSounds } = await import('../src/renderer/src/state/sound')

const message = (authorId: string): SessionEvent => ({
  id: 'm1',
  ts: 1,
  kind: 'message',
  authorId,
  authorName: 'Ali',
  text: 'hi',
  mentions: []
})

const ended = (ok: boolean): SessionEvent => ({
  id: 'e1',
  ts: 1,
  kind: 'agent.end',
  promptId: 'p1',
  agentId: 'a1',
  agentLabel: 'Bubbles',
  ok
})

describe('which sound an event makes', () => {
  it('stays quiet for the message you just sent', () => {
    expect(soundFor(message('me'), 'me')).toBe(null)
  })

  it('plays for a message from someone else', () => {
    expect(soundFor(message('ali'), 'me')).toBe('receive')
  })

  it('stays quiet for notices from the app itself', () => {
    expect(soundFor(message(SYSTEM_AUTHOR_ID), 'me')).toBe(null)
  })

  it('tells a finished agent apart from a failed one', () => {
    expect(soundFor(ended(true), 'me')).toBe('done')
    expect(soundFor(ended(false), 'me')).toBe('failed')
  })

  it('says nothing about events with no sound', () => {
    expect(soundFor({ id: 's', ts: 1, kind: 'agent.online', agentId: 'a1', label: 'Bubbles' }, 'me')).toBe(null)
  })
})

describe('playing a sound', () => {
  let clock = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)

  beforeEach(() => {
    started.length = 0
    pitched.length = 0
    landed.length = 0
    filters = []
    store.clear()
    clock += 10_000
  })

  it('sounds every note of the voice', () => {
    playSound('done')
    expect(started.length).toBeGreaterThan(0)
  })

  it('folds a burst of the same sound into one', () => {
    playSound('done')
    const first = started.length
    playSound('done')
    playSound('done')
    expect(started.length).toBe(first)
  })

  it('lets the same sound through once the burst has passed', () => {
    playSound('done')
    const first = started.length
    clock += 500
    playSound('done')
    expect(started.length).toBeGreaterThan(first)
  })

  it('keeps two different sounds independent', () => {
    playSound('send')
    const first = started.length
    playSound('receive')
    expect(started.length).toBeGreaterThan(first)
  })

  const TABS = ['tab.chat', 'tab.agents', 'tab.docs', 'tab.design'] as const

  type Heard = { at: number[]; hz: number[]; scrapes: number[]; root: number }

  const eachTab = (): Map<string, Heard> => {
    const heard = new Map<string, Heard>()
    for (const tab of TABS) {
      started.length = 0
      landed.length = 0
      filters = []
      clock += 500
      playSound(tab)
      expect(started.length).toBeGreaterThan(0)
      heard.set(tab, {
        at: [...started],
        hz: [...landed],
        scrapes: filters.filter(f => f.type === 'bandpass').map(f => f.hz[0]),
        root: Math.min(...landed)
      })
    }
    return heard
  }

  it('gives every tab its own noise', () => {
    const shapes = [...eachTab().values()].map(sound => `${sound.at.join(',')}|${sound.hz.join(',')}`)
    expect(new Set(shapes).size).toBe(4)
  })

  it('keeps the tabs level with each other, none higher up the row than the rest', () => {
    const roots = [...eachTab().values()].map(sound => sound.root)
    expect(Math.max(...roots) / Math.min(...roots)).toBeLessThan(1.3)
  })

  it('strikes something on every tab rather than sounding a bare tone', () => {
    for (const sound of eachTab().values()) expect(sound.scrapes.length).toBeGreaterThan(0)
  })

  it('makes each tab its own material, not one note replayed', () => {
    const heard = [...eachTab().values()]
    const grain = heard.map(sound => sound.scrapes.join(','))
    const bodies = heard.map(sound => sound.hz.map(hz => (hz / sound.root).toFixed(2)).join(','))
    expect(new Set(grain).size).toBe(4)
    expect(new Set(bodies).size).toBe(4)
  })

  it('lets you cross the whole row without a note being swallowed', () => {
    playSound('tab.chat')
    const first = started.length
    playSound('tab.agents')
    playSound('tab.docs')
    playSound('tab.design')
    expect(started.length).toBeGreaterThan(first)
  })

  it('says nothing when sounds are muted', () => {
    setSounds(false)
    playSound('send')
    expect(started.length).toBe(0)
    setSounds(true)
    playSound('send')
    expect(started.length).toBeGreaterThan(0)
  })
})
