import { context } from './audio'

export type Note = { hz: number; at: number; length?: number; gain?: number; glide?: number }

const PARTIALS = [
  { ratio: 1, gain: 1 },
  { ratio: 2, gain: 0.24 },
  { ratio: 3.01, gain: 0.07 }
]

const ATTACK = 0.006
const LENGTH = 0.2
const GAIN = 0.07

export function playNotes(notes: Note[]): void {
  try {
    const ctx = context()
    if (!ctx) return
    for (const note of notes) {
      const start = ctx.currentTime + note.at
      const length = note.length ?? LENGTH
      const peak = (note.gain ?? 1) * GAIN
      for (const partial of PARTIALS) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(note.hz * partial.ratio, start)
        if (note.glide) osc.frequency.exponentialRampToValueAtTime(note.glide * partial.ratio, start + length)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(peak * partial.gain, start + ATTACK)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + length + 0.02)
      }
    }
  } catch {
    return
  }
}
