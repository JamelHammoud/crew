import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../../../shared/events'
import { soundsOn } from '../state/sound'
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

// Four objects rather than four melodies: a bubble, a knuckle on wood, a paper
// flick, a struck glass. All land in the same octave so no tab sits above
// another, and each one is named by what it is made of.
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
      length: 0.1,
      gain: 0.6,
      partials: [1, 2.76, 5.1],
      bend: 1.4,
      bendTime: 0.018,
      tone: 3200,
      wet: 0.14,
      pan: -0.12,
      rasp: { hz: 1100, q: 0.7, gain: 0.45, length: 0.02 }
    },
    {
      hz: 592,
      at: 0.063,
      length: 0.14,
      gain: 0.5,
      partials: [1, 2.76, 5.1],
      bend: 1.4,
      bendTime: 0.018,
      tone: 3000,
      wet: 0.14,
      pan: 0.12,
      rasp: { hz: 1040, q: 0.7, gain: 0.4, length: 0.02 }
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

// Six agents can land at once. The first one is heard and the rest fold into it,
// otherwise a busy session turns into a chord.
const APART = 140
const last: Partial<Record<SoundName, number>> = {}

export function playSound(name: SoundName): void {
  if (!soundsOn()) return
  const now = Date.now()
  if (now - (last[name] ?? -APART) < APART) return
  last[name] = now
  if (name in STRIKES) playStrikes(STRIKES[name as StrikeName])
  else playNotes(CHIMES[name as ChimeName])
}

export function soundFor(event: SessionEvent, selfId: string): SoundName | null {
  if (event.kind === 'message') {
    if (event.authorId === selfId || event.authorId === SYSTEM_AUTHOR_ID) return null
    return 'receive'
  }
  if (event.kind === 'agent.end') return event.ok ? 'done' : 'failed'
  return null
}
