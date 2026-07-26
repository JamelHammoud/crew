import { trackLength, type MusicTrack } from '../../../shared/music'
import { context, convolver } from './audio'
import { hush, strikeAt, type Sink, type Sounding, type Strike } from './strike'
import { strikesOf } from './tunes'

// Music is scheduled a little ahead of itself and topped up on a timer, because
// a note has to be handed to the audio clock before it is due or it lands late.
const AHEAD = 0.6
const TICK = 200
const HUSH = 0.09
const KEEP = 96

export class MusicPlayer {
  trackId: string | null = null
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sink: Sink | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private notes: Strike[] = []
  private length = 0
  // The moment on the audio clock the top of the loop sits at, and how much of
  // the loop has been handed over so far.
  private origin = 0
  private cursor = 0
  private sounding: Sounding[] = []
  private level = 1

  // Everything goes through a volume of its own, so one person turning it down
  // is one person turning it down. Nobody else hears it and the loop keeps its
  // place with everyone else's.
  play(track: MusicTrack, at: number): void {
    this.stop()
    const ctx = context()
    if (!ctx) return
    const master = ctx.createGain()
    master.gain.value = this.level
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    this.sink = { out: master, room: convolver(ctx, master) }
    this.trackId = track.id
    this.notes = strikesOf(track)
    this.length = trackLength(track)
    this.origin = ctx.currentTime - at
    this.cursor = at
    this.fill()
    this.timer = setInterval(() => this.fill(), TICK)
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    const ctx = this.ctx
    const master = this.master
    if (ctx && master) {
      const now = ctx.currentTime
      master.gain.setValueAtTime(master.gain.value, now)
      master.gain.linearRampToValueAtTime(0, now + HUSH)
      // A note scheduled to start after it has been told to stop never sounds,
      // which is what takes the music that was already handed over back.
      hush(ctx, this.sounding)
    }
    this.sounding = []
    this.master = null
    this.sink = null
    this.ctx = null
    this.trackId = null
  }

  running(): boolean {
    return this.timer !== null
  }

  position(): number {
    if (!this.ctx || this.length <= 0) return 0
    const run = this.ctx.currentTime - this.origin
    return ((run % this.length) + this.length) % this.length
  }

  setVolume(level: number): void {
    this.level = Math.min(1, Math.max(0, level))
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) return
    master.gain.setTargetAtTime(this.level, ctx.currentTime, 0.02)
  }

  private fill(): void {
    const ctx = this.ctx
    const sink = this.sink
    if (!ctx || !sink || this.length <= 0) return
    const until = ctx.currentTime - this.origin + AHEAD
    while (this.cursor < until) {
      const from = Math.floor(this.cursor / this.length) * this.length
      for (const note of this.notes) {
        const at = from + note.at
        if (at < this.cursor || at >= until) continue
        this.sounding.push(strikeAt(ctx, note, this.origin + at, sink))
      }
      this.cursor = Math.min(until, from + this.length)
    }
    // Only what might still be ringing is worth holding on to.
    if (this.sounding.length > KEEP) this.sounding = this.sounding.slice(-KEEP)
  }
}
