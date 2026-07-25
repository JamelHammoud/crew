import { SYSTEM_AUTHOR_ID, type SessionEvent } from '../../../shared/events'
import { soundsOn } from '../state/sound'
import { playNotes, type Note } from './tone'

export type SoundName =
  | 'send'
  | 'receive'
  | 'done'
  | 'failed'
  | 'join'
  | 'leave'
  | 'tab.chat'
  | 'tab.agents'
  | 'tab.docs'
  | 'tab.design'

const VOICES: Record<SoundName, Note[]> = {
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
  ],
  // The four tabs share one gesture, a grace note flicked into a main note, and
  // climb the row left to right, so moving across them plays a scale. Each keeps
  // its own interval and note count so you can name the tab with your eyes shut.
  'tab.chat': [
    { hz: 1046.5, at: 0, length: 0.04, gain: 0.3 },
    { hz: 1567.98, at: 0.025, length: 0.15, gain: 0.5 }
  ],
  'tab.agents': [
    { hz: 1318.51, at: 0, length: 0.04, gain: 0.3 },
    { hz: 1567.98, at: 0.025, length: 0.06, gain: 0.42 },
    { hz: 1760, at: 0.06, length: 0.16, gain: 0.5 }
  ],
  'tab.docs': [
    { hz: 1760, at: 0, length: 0.05, gain: 0.34 },
    { hz: 1975.53, at: 0.03, length: 0.13, gain: 0.46 }
  ],
  'tab.design': [
    { hz: 1567.98, at: 0, length: 0.04, gain: 0.28 },
    { hz: 2093, at: 0.025, length: 0.08, gain: 0.44 },
    { hz: 2637.02, at: 0.055, length: 0.18, gain: 0.34 }
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
  playNotes(VOICES[name])
}

export function soundFor(event: SessionEvent, selfId: string): SoundName | null {
  if (event.kind === 'message') {
    if (event.authorId === selfId || event.authorId === SYSTEM_AUTHOR_ID) return null
    return 'receive'
  }
  if (event.kind === 'agent.end') return event.ok ? 'done' : 'failed'
  return null
}
