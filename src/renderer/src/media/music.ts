import { tuneLength, type MusicTune } from '../../../shared/music'
import { context, convolver } from './audio'
import { hush, strikeAt, type Sink, type Sounding, type Strike } from './strike'
import { strikesOf } from './tunes'

// Music is scheduled a little ahead of itself and topped up on a timer, because
// a note has to be handed to the audio clock before it is due or it lands late.
const AHEAD = 0.6
const TICK = 200
const HUSH = 0.09
const KEEP = 96

// What the bars are read off. It is hung before the volume, so turning the music
// down where you are sitting does not stop it dancing. The window has to be this
// wide: a narrow one measures in steps of a few hundred hertz, and the lowest
// band is only fifty hertz across, so the bass bar would have nothing in it.
const BINS = 2048
const LOW = 55
const HIGH = 7000

// What became of a track somebody added. A file that will not load is the one
// worth saying out loud: it is silence that looks exactly like music playing.
export type FileResult = 'playing' | 'dropped' | 'unplayable'

const buffers = new Map<string, Promise<AudioBuffer>>()

async function bufferFor(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const held = buffers.get(url)
  if (held) return held
  const loading = fetch(url)
    .then(res => res.arrayBuffer())
    .then(bytes => ctx.decodeAudioData(bytes))
  buffers.set(url, loading)
  loading.catch(() => buffers.delete(url))
  return loading
}

export class MusicPlayer {
  trackId: string | null = null
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private tap: AnalyserNode | null = null
  private reading: Uint8Array | null = null
  private sink: Sink | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private notes: Strike[] = []
  private file: AudioBufferSourceNode | null = null
  private length = 0
  // The moment on the audio clock the top of the loop sits at, and how much of
  // the loop has been handed over so far.
  private origin = 0
  private cursor = 0
  private sounding: Sounding[] = []
  private level = 1
  // What is being waited for, so a file that lands after the crew moved on is
  // dropped rather than played over whatever is on now.
  private wanted = 0

  // Everything goes through a volume of its own, so one person turning it down
  // is one person turning it down. Nobody else hears it and the loop keeps its
  // place with everyone else's.
  play(tune: MusicTune, at: number): void {
    const ctx = this.begin(tune.id, tuneLength(tune), at)
    if (!ctx) return
    this.notes = strikesOf(tune)
    this.fill()
    this.timer = setInterval(() => this.fill(), TICK)
  }

  // A track somebody put there themselves. It is fetched once and kept, so
  // pressing play again is as quick as a tune.
  async playFile(trackId: string, url: string, seconds: number, at: number): Promise<FileResult> {
    const ctx = context()
    if (!ctx) return 'unplayable'
    const mine = ++this.wanted
    let buffer: AudioBuffer
    try {
      buffer = await bufferFor(ctx, url)
    } catch {
      return mine === this.wanted ? 'unplayable' : 'dropped'
    }
    if (mine !== this.wanted) return 'dropped'
    if (!this.begin(trackId, buffer.duration || seconds, at)) return 'unplayable'
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(this.bus as GainNode)
    source.start(ctx.currentTime, Math.min(at, Math.max(0, buffer.duration - 0.01)))
    this.file = source
    return 'playing'
  }

  stop(): void {
    this.wanted += 1
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
      try {
        this.file?.stop(now + HUSH)
      } catch {
        this.file = null
      }
    }
    this.sounding = []
    this.file = null
    this.master = null
    this.bus = null
    this.tap = null
    this.reading = null
    this.sink = null
    this.ctx = null
    this.trackId = null
  }

  running(): boolean {
    return this.timer !== null || this.file !== null
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

  // How loud each band is right now, which is the music itself rather than
  // anything worked out about it. Nothing playing here comes back as null, and
  // whoever asked draws the tune's own shape instead.
  levels(count: number): number[] | null {
    const tap = this.tap
    const reading = this.reading
    if (!tap || !reading || !this.running()) return null
    tap.getByteFrequencyData(reading)
    return bandsFrom(reading, this.ctx?.sampleRate ?? 48000, count, new Array<number>(count))
  }

  private begin(trackId: string, length: number, at: number): AudioContext | null {
    this.stop()
    const ctx = context()
    if (!ctx) return null
    const master = ctx.createGain()
    master.gain.value = this.level
    master.connect(ctx.destination)
    const bus = ctx.createGain()
    const tap = ctx.createAnalyser?.()
    if (tap) {
      tap.fftSize = BINS
      tap.smoothingTimeConstant = 0.7
      bus.connect(tap)
      tap.connect(master)
      this.reading = new Uint8Array(tap.frequencyBinCount)
    } else {
      bus.connect(master)
    }
    this.ctx = ctx
    this.master = master
    this.bus = bus
    this.tap = tap ?? null
    this.sink = { out: bus, room: convolver(ctx, bus) }
    this.trackId = trackId
    this.notes = []
    this.length = length
    this.origin = ctx.currentTime - at
    this.cursor = at
    return ctx
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
