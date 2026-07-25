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

class FakeParam {
  constructor(private readonly heard?: number[]) {}
  setValueAtTime(value: number): void {
    this.heard?.push(value)
  }
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
}

class FakeAudioContext {
  currentTime = 0
  state = 'running'
  destination = {}
  createOscillator(): unknown {
    return {
      type: 'sine',
      frequency: new FakeParam(pitched),
      connect: () => {},
      start: (at: number) => void started.push(at),
      stop: () => {}
    }
  }
  createGain(): unknown {
    return { gain: new FakeParam(), connect: () => {} }
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

  it('gives every tab its own noise', () => {
    const heard = new Map<string, number[]>()
    for (const tab of ['tab.chat', 'tab.agents', 'tab.docs', 'tab.design'] as const) {
      started.length = 0
      clock += 500
      playSound(tab)
      expect(started.length).toBeGreaterThan(0)
      heard.set(tab, [...started])
    }
    const shapes = [...heard.values()].map(notes => notes.join(','))
    expect(new Set(shapes).size).toBe(4)
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
