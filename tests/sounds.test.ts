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

class FakeParam {
  setValueAtTime(): void {}
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
      frequency: new FakeParam(),
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
    expect(soundFor({ id: 's', ts: 1, kind: 'agent.online', agentId: 'a1' }, 'me')).toBe(null)
  })
})

describe('playing a sound', () => {
  let clock = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => clock)

  beforeEach(() => {
    started.length = 0
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

  it('says nothing when sounds are muted', () => {
    setSounds(false)
    playSound('send')
    expect(started.length).toBe(0)
    setSounds(true)
    playSound('send')
    expect(started.length).toBeGreaterThan(0)
  })
})
