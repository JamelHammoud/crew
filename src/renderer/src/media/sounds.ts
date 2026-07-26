import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../../../shared/events'
import { soundsOn } from '../state/sound'
import { playRing, type Ring } from './ring'
import { playStrikes, type Strike } from './strike'
import { playNotes, type Note } from './tone'

type ChimeName = 'send' | 'receive' | 'done' | 'failed' | 'join' | 'leave'
type StrikeName = 'tab.chat' | 'tab.agents' | 'tab.docs' | 'tab.design'

export type SoundName = ChimeName | StrikeName

const CHIMES: Record<ChimeName, Note[]> = {
  send: [
    { hz: 1174.66, at: 0, length: 0.09, gain: 0.55 },
    { hz: 1760, at: 0.05, length: 0.13, gain: 0.45 }
  ],
  receive: [
    { hz: 659.25, at: 0, length: 0.18, gain: 0.55 },
    { hz: 987.77, at: 0.06, length: 0.3, gain: 0.9 }
  ],
  done: [
    { hz: 880, at: 0, length: 0.14, gain: 0.7 },
    { hz: 1318.51, at: 0.08, length: 0.16, gain: 0.8 },
    { hz: 1760, at: 0.16, length: 0.42, gain: 0.9 }
  ],
  failed: [
    { hz: 783.99, at: 0, length: 0.16, gain: 0.7 },
    { hz: 587.33, at: 0.1, length: 0.34, gain: 0.7 }
  ],
  join: [
    { hz: 587.33, at: 0, length: 0.22, gain: 0.8 },
    { hz: 880, at: 0.09, length: 0.26, gain: 0.8 }
  ],
  leave: [
    { hz: 880, at: 0, length: 0.22, gain: 0.8 },
    { hz: 587.33, at: 0.09, length: 0.26, gain: 0.8 }
  ]
}

const STRIKES: Record<StrikeName, Strike[]> = {
  'tab.chat': [
    {
      hz: 560,
      at: 0,
      length: 0.13,
      gain: 0.62,
      partials: [1, 2],
      bend: 0.5,
      bendTime: 0.05,
      tone: 2400,
      wet: 0.22,
      rasp: { hz: 1600, q: 1.2, gain: 0.16, length: 0.01 }
    }
  ],
  'tab.agents': [
    {
      hz: 620,
      at: 0,
      length: 0.2,
      gain: 0.6,
      partials: [1, 3.94, 10.2],
      bend: 1.16,
      bendTime: 0.014,
      tone: 4200,
      wet: 0.18,
      pan: -0.08,
      rasp: { hz: 900, q: 1.1, gain: 0.3, length: 0.014 }
    },
    {
      hz: 775,
      at: 0.014,
      length: 0.24,
      gain: 0.5,
      partials: [1, 3.94, 10.2],
      bend: 1.16,
      bendTime: 0.014,
      tone: 4600,
      wet: 0.18,
      pan: 0.08,
      rasp: { hz: 1150, q: 1.1, gain: 0.22, length: 0.012 }
    }
  ],
  'tab.docs': [
    {
      hz: 700,
      at: 0,
      length: 0.15,
      gain: 0.55,
      partials: [1, 3.1],
      bend: 1.14,
      bendTime: 0.012,
      tone: 5200,
      wet: 0.07,
      rasp: { hz: 4200, q: 0.5, gain: 0.55, length: 0.018 }
    }
  ],
  'tab.design': [
    {
      hz: 660,
      at: 0,
      length: 0.44,
      gain: 0.5,
      partials: [1, 2.76, 5.4, 8.93],
      bend: 1.03,
      bendTime: 0.012,
      detune: 7,
      tone: 8000,
      wet: 0.5,
      rasp: { hz: 6200, q: 1.4, gain: 0.3, length: 0.008 }
    }
  ]
}

type Voice = Omit<Strike, 'hz' | 'at' | 'length'>

// The same bubble the rest of the app is made of, in three sizes: a low one
// holding the chord, the one that carries the tune, and a small bright one.
const DEEP: Voice = {
  gain: 0.5,
  partials: [1, 2.04],
  bend: 0.72,
  bendTime: 0.055,
  tone: 1500,
  wet: 0.12,
  rasp: { hz: 620, q: 0.9, gain: 0.06, length: 0.008 }
}

const TUNE: Voice = {
  gain: 0.62,
  partials: [1, 2.04, 4.1],
  bend: 0.86,
  bendTime: 0.025,
  detune: 4,
  tone: 2400,
  wet: 0.26,
  rasp: { hz: 1100, q: 0.9, gain: 0.07, length: 0.008 }
}

const SPARK: Voice = {
  gain: 0.24,
  partials: [1, 3.02],
  bend: 0.9,
  bendTime: 0.02,
  tone: 5200,
  wet: 0.42,
  rasp: { hz: 2600, q: 1.2, gain: 0.07, length: 0.007 }
}

const NOTE = {
  e3: 164.81,
  fs3: 185,
  a3: 220,
  a4: 440,
  b4: 493.88,
  cs5: 554.37,
  e5: 659.25,
  fs5: 739.99,
  a5: 880,
  cs6: 1108.73
}

const bubble = (voice: Voice, hz: number, at: number, length: number, pan = 0): Strike => ({
  ...voice,
  hz,
  at,
  length,
  pan
})

// Two bars that come round again: A, F sharp minor, E, A, with the same figure
// said twice, once up and once answering it lower.
export const CALL: Ring = {
  phrase: [
    bubble(DEEP, NOTE.a3, 0, 0.9),
    bubble(DEEP, NOTE.fs3, 1.2, 0.9),
    bubble(DEEP, NOTE.e3, 2.4, 0.9),
    bubble(DEEP, NOTE.a3, 3.6, 1),

    bubble(TUNE, NOTE.cs5, 0, 0.5, -0.06),
    bubble(TUNE, NOTE.e5, 0.3, 0.5, 0.04),
    bubble(TUNE, NOTE.fs5, 0.6, 0.9, -0.04),
    bubble(TUNE, NOTE.e5, 1.5, 0.4, 0.06),
    bubble(TUNE, NOTE.cs5, 1.8, 0.7, -0.06),
    bubble(TUNE, NOTE.b4, 2.4, 0.4, 0.04),
    bubble(TUNE, NOTE.cs5, 2.7, 0.4, -0.04),
    bubble(TUNE, NOTE.e5, 3, 0.9, 0.06),
    bubble(TUNE, NOTE.cs5, 3.9, 0.35, -0.06),
    bubble(TUNE, NOTE.a4, 4.2, 1.1, 0),

    bubble(SPARK, NOTE.a5, 0.9, 0.5, 0.2),
    bubble(SPARK, NOTE.cs6, 3.3, 0.6, -0.2)
  ],
  every: 4.8,
  times: 3
}

const APART = 140
const last: Partial<Record<SoundName, number>> = {}
let ringing: (() => void) | null = null

export function playSound(name: SoundName): void {
  if (!soundsOn()) return
  const now = Date.now()
  if (now - (last[name] ?? -APART) < APART) return
  last[name] = now
  if (name in STRIKES) playStrikes(STRIKES[name as StrikeName])
  else playNotes(CHIMES[name as ChimeName])
}

export function startRinging(): void {
  stopRinging()
  if (!soundsOn()) return
  ringing = playRing(CALL)
}

export function stopRinging(): void {
  ringing?.()
  ringing = null
}

export function soundFor(event: SessionEvent, selfId: string): SoundName | null {
  if (event.kind === 'message') {
    if (event.authorId === selfId || event.authorId === SYSTEM_AUTHOR_ID) return null
    return 'receive'
  }
  if (event.kind === 'agent.end') return event.ok ? 'done' : 'failed'
  return null
}
