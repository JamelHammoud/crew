import { describe, expect, it } from 'vitest'
import { FRAME, HEARD_RATE, rmsOf, VoiceGate, type GateWord } from '../src/renderer/src/media/voice/gate'
import { join, PreRoll, resample } from '../src/renderer/src/media/voice/resample'

const MS = (FRAME / HEARD_RATE) * 1000

const room = (level: number, frames: number): number[] => new Array(frames).fill(level)

const say = (gate: VoiceGate, levels: number[]): GateWord[] => levels.map(level => gate.push(level, MS))

const settled = (gate: VoiceGate, floor: number): void => {
  say(gate, room(floor, 200))
}

describe('where a thing somebody said starts and ends', () => {
  it('stays shut on a quiet room', () => {
    const gate = new VoiceGate()
    expect(say(gate, room(0.001, 300)).every(word => word === 'quiet')).toBe(true)
  })

  it('stays shut on a steady hum, however long it runs', () => {
    const gate = new VoiceGate()
    expect(say(gate, room(0.02, 600)).every(word => word === 'quiet')).toBe(true)
  })

  it('opens on a voice over the room and closes on the gap after it', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    const words = say(gate, [...room(0.14, 40), ...room(0.004, 30)])
    expect(words).toContain('speaking')
    expect(words.at(-1)).toBe('ended')
    expect(words.filter(word => word === 'ended')).toHaveLength(1)
  })

  it('rides through the gaps inside a sentence', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    const sentence = [...room(0.14, 20), ...room(0.004, 8), ...room(0.14, 20)]
    const words = say(gate, sentence)
    expect(words).not.toContain('ended')
    expect(say(gate, room(0.004, 30)).at(-1)).toBe('ended')
  })

  it('drops a cough rather than sending it', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    const words = say(gate, [...room(0.3, 4), ...room(0.004, 30)])
    expect(words.at(-1)).toBe('dropped')
    expect(words).not.toContain('ended')
  })

  it('lets go of a microphone somebody left open', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    const words = say(gate, room(0.2, 1200))
    expect(words).toContain('ended')
  })

  it('never opens on a click, however loud', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    expect(say(gate, [...room(0.9, 1), ...room(0.004, 20)]).every(word => word === 'quiet')).toBe(true)
  })

  it('follows a room that goes quiet', () => {
    const gate = new VoiceGate()
    settled(gate, 0.05)
    const loud = gate.noiseFloor
    settled(gate, 0.002)
    expect(gate.noiseFloor).toBeLessThan(loud)
  })

  it('holds the floor still through a long utterance', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    const floor = gate.noiseFloor
    say(gate, room(0.2, 120))
    expect(gate.noiseFloor).toBe(floor)
  })

  it('asks for more before it believes the agent has been cut off', () => {
    const open = new VoiceGate()
    settled(open, 0.004)
    const guarded = new VoiceGate()
    settled(guarded, 0.004)
    guarded.guarded(true)
    const blip = room(0.05, 4)
    expect(say(open, blip)).toContain('speaking')
    expect(say(guarded, blip).every(word => word === 'quiet')).toBe(true)
    expect(say(guarded, room(0.3, 12))).toContain('speaking')
  })

  it('says nothing after it is reset', () => {
    const gate = new VoiceGate()
    settled(gate, 0.004)
    say(gate, room(0.14, 20))
    expect(gate.speaking).toBe(true)
    gate.reset()
    expect(gate.speaking).toBe(false)
    expect(say(gate, room(0.004, 30)).every(word => word === 'quiet')).toBe(true)
  })
})

describe('getting sound to the rate whisper listens at', () => {
  it('lands on the right number of samples', () => {
    expect(resample(new Float32Array(48_000), 48_000, HEARD_RATE)).toHaveLength(HEARD_RATE)
    expect(resample(new Float32Array(44_100), 44_100, HEARD_RATE)).toHaveLength(HEARD_RATE)
    expect(resample(new Float32Array(96_000), 96_000, HEARD_RATE)).toHaveLength(HEARD_RATE)
  })

  it('hands back what it was given when the rate already matches', () => {
    const audio = new Float32Array([0.1, 0.2])
    expect(resample(audio, HEARD_RATE, HEARD_RATE)).toBe(audio)
  })

  it('keeps a tone a tone rather than folding it into a whistle', () => {
    const seconds = 0.5
    const from = 48_000
    const hz = 440
    const input = new Float32Array(from * seconds)
    for (let i = 0; i < input.length; i++) input[i] = Math.sin((2 * Math.PI * hz * i) / from)
    const out = resample(input, from, HEARD_RATE)
    let crossings = 0
    for (let i = 1; i < out.length; i++) if (out[i - 1] < 0 && out[i] >= 0) crossings++
    expect(crossings).toBeGreaterThan(hz * seconds - 3)
    expect(crossings).toBeLessThan(hz * seconds + 3)
    expect(rmsOf(out)).toBeGreaterThan(0.6)
  })

  it('averages the run rather than dropping samples', () => {
    const spike = new Float32Array(6)
    spike[0] = 1
    const out = resample(spike, 6, 2)
    expect(out).toHaveLength(2)
    expect(out[0]).toBeCloseTo(1 / 3, 5)
  })
})

describe('the sound just before the gate opened', () => {
  it('keeps roughly what it was asked for and no more', () => {
    const roll = new PreRoll(1000)
    for (let i = 0; i < 20; i++) roll.push(new Float32Array(FRAME))
    const held = join(roll.take())
    expect(held.length).toBeGreaterThanOrEqual(1000)
    expect(held.length).toBeLessThan(1000 + FRAME * 2)
  })

  it('is empty once it has been taken', () => {
    const roll = new PreRoll(1000)
    roll.push(new Float32Array(FRAME))
    roll.take()
    expect(join(roll.take())).toHaveLength(0)
  })

  it('carries the front of the first word', () => {
    const roll = new PreRoll(FRAME * 4)
    const word = new Float32Array(FRAME).fill(0.5)
    roll.push(new Float32Array(FRAME))
    roll.push(word)
    expect(rmsOf(join(roll.take()))).toBeGreaterThan(0)
  })
})

describe('joining pieces', () => {
  it('lays them end to end', () => {
    expect([...join([new Float32Array([1, 2]), new Float32Array([3])])]).toEqual([1, 2, 3])
    expect(join([])).toHaveLength(0)
  })
})
