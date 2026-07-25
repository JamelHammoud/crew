type Note = { hz: number; at: number }

const JOIN: Note[] = [
  { hz: 587.33, at: 0 },
  { hz: 880, at: 0.09 }
]

const LEAVE: Note[] = [
  { hz: 880, at: 0 },
  { hz: 587.33, at: 0.09 }
]

const LENGTH = 0.22
const GAIN = 0.06

// The app ships no sound files, so the two notes are drawn on the spot. Quiet
// enough to sit under a conversation.
function play(notes: Note[]): void {
  const Ctor = globalThis.AudioContext
  if (!Ctor) return
  try {
    const context = new Ctor()
    for (const note of notes) {
      const start = context.currentTime + note.at
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'sine'
      osc.frequency.value = note.hz
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(GAIN, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + LENGTH)
      osc.connect(gain)
      gain.connect(context.destination)
      osc.start(start)
      osc.stop(start + LENGTH)
    }
    globalThis.setTimeout(() => void context.close().catch(() => {}), 1200)
  } catch {
    return
  }
}

export function chimeJoin(): void {
  play(JOIN)
}

export function chimeLeave(): void {
  play(LEAVE)
}
