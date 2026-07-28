import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../../../shared/events'
import { soundsOn } from '../state/sound'
import { playRing, type Ring } from './ring'
import { playStrikes, type Strike } from './strike'
import { playNotes, type Note } from './tone'

type ChimeName = 'send' | 'receive' | 'done' | 'failed' | 'join' | 'leave'
type StrikeName =
  | 'tab.chat'
  | 'tab.docs'
  | 'tab.design'
  | 'sound.on'
  | 'toolbox.open'
  | 'tasks.open'
  | 'task.done'
  | 'crew.mark'

export type SoundName = ChimeName | StrikeName

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
  // Turning sound back on is the one setting whose result is the thing it just
  // switched on, so it says so in its own voice. One bubble of the app's own
  // material, no figure and nothing to read into it: a chime that means anything
  // else would have someone looking for who had just arrived. Muting says
  // nothing, which is the whole of what muting is.
  'sound.on': [
    {
      hz: 880,
      at: 0,
      length: 0.34,
      gain: 0.55,
      partials: [1, 2.04, 4.1],
      bend: 0.86,
      bendTime: 0.025,
      detune: 4,
      tone: 3000,
      wet: 0.3,
      rasp: { hz: 1800, q: 0.9, gain: 0.08, length: 0.008 }
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
  ],
  'toolbox.open': [
    {
      hz: 1245,
      at: 0,
      length: 0.05,
      gain: 0.3,
      partials: [1, 3.4, 6.1],
      bend: 1.28,
      bendTime: 0.006,
      tone: 7200,
      wet: 0.16,
      rasp: { hz: 5400, q: 1.6, gain: 0.45, length: 0.012 }
    },
    {
      hz: 466.16,
      at: 0.045,
      length: 0.3,
      gain: 0.6,
      partials: [1, 2.04, 3.9],
      bend: 0.7,
      bendTime: 0.06,
      detune: 5,
      tone: 2400,
      wet: 0.24,
      rasp: { hz: 950, q: 0.9, gain: 0.1, length: 0.012 }
    },
    {
      hz: 932.33,
      at: 0.115,
      length: 0.26,
      gain: 0.2,
      partials: [1, 3.02],
      bend: 0.86,
      bendTime: 0.03,
      tone: 5000,
      wet: 0.4,
      rasp: { hz: 2800, q: 1.2, gain: 0.05, length: 0.007 }
    }
  ],
  'tasks.open': [
    {
      hz: 587.33,
      at: 0,
      length: 0.15,
      gain: 0.5,
      partials: [1, 2.92, 5.1],
      bend: 0.53,
      bendTime: 0.045,
      detune: 6,
      tone: 2700,
      wet: 0.14,
      rasp: { hz: 1900, q: 2.4, gain: 0.16, length: 0.006 }
    },
    {
      hz: 880,
      at: 0.07,
      length: 0.13,
      gain: 0.4,
      partials: [1, 2.92],
      bend: 1.2,
      bendTime: 0.018,
      detune: 5,
      tone: 3600,
      wet: 0.22,
      rasp: { hz: 2500, q: 2.6, gain: 0.09, length: 0.005 }
    },
    {
      hz: 1174.66,
      at: 0.125,
      length: 0.2,
      gain: 0.17,
      partials: [1, 2.42],
      bend: 0.9,
      bendTime: 0.014,
      tone: 6400,
      wet: 0.42,
      rasp: { hz: 3400, q: 2.8, gain: 0.04, length: 0.004 }
    }
  ],
  // Three discs arriving, so three bubbles, panned the way they land and rising
  // through A major. The low one and the sparks come in under the light, once
  // the last of them is home.
  'crew.mark': [
    bubble(TUNE, NOTE.a4, 0, 0.34, -0.32),
    bubble(TUNE, NOTE.cs5, 0.09, 0.34, 0),
    bubble(TUNE, NOTE.e5, 0.18, 0.5, 0.32),
    bubble(DEEP, NOTE.a3, 0.19, 0.9, 0),
    bubble(SPARK, NOTE.a5, 0.21, 0.52, 0.14),
    bubble(SPARK, NOTE.cs6, 0.29, 0.6, -0.16)
  ],
  'task.done': [
    {
      hz: 1567.98,
      at: 0,
      length: 0.05,
      gain: 0.22,
      partials: [1, 3.4],
      bend: 1.3,
      bendTime: 0.005,
      tone: 7600,
      wet: 0.16,
      rasp: { hz: 5600, q: 2.4, gain: 0.42, length: 0.01 }
    },
    {
      hz: 880,
      at: 0.02,
      length: 0.22,
      gain: 0.42,
      partials: [1, 2.92, 5.1],
      bend: 0.88,
      bendTime: 0.022,
      detune: 6,
      tone: 3000,
      wet: 0.2,
      rasp: { hz: 2100, q: 2.4, gain: 0.12, length: 0.006 }
    },
    {
      hz: 1174.66,
      at: 0.105,
      length: 0.62,
      gain: 0.36,
      partials: [1, 2.92, 5.1],
      bend: 1.05,
      bendTime: 0.016,
      detune: 5,
      tone: 4400,
      wet: 0.36,
      rasp: { hz: 2800, q: 2.6, gain: 0.06, length: 0.005 }
    },
    {
      hz: 293.66,
      at: 0.105,
      length: 0.95,
      gain: 0.3,
      partials: [1, 2.04],
      bend: 0.74,
      bendTime: 0.06,
      tone: 1400,
      wet: 0.24,
      rasp: { hz: 700, q: 0.9, gain: 0.05, length: 0.01 }
    }
  ]
}

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

// Voice is already a conversation, so the chat's own cues have nothing left to
// say inside one: the turn going out and the answer coming back are both being
// spoken out loud, and a chime into an open microphone is one more thing the
// gate has to hear past. Everything else the app makes a noise about still does.
const CHAT_CUES = new Set<SoundName>(['send', 'receive', 'done', 'failed'])
let hushed = false

export function hushChat(on: boolean): void {
  hushed = on
}

export function playSound(name: SoundName): void {
  if (!soundsOn()) return
  if (hushed && CHAT_CUES.has(name)) return
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
