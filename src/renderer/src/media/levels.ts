import type { Strike } from './strike'

// How loud a tune is, band by band, all the way through one pass of the loop.
// The bars are drawn from this, so what they do is what the music does rather
// than a shape that happens to move at the same time.

// The bands the ear is divided into, low to high. A note is put in one by its
// own pitch, so the bass moves the bar on the left and a spark moves the right.
const LOW = 55
const HIGH = 7000

// How often the loop is measured. A frame is finer than this and reads between
// two of them, which is what keeps a bar falling smoothly rather than in steps.
const PER_SECOND = 30

export interface Levels {
  count: number
  seconds: number
  rows: Float32Array
}

const bandOf = (hz: number, count: number): number => {
  const share = Math.log(Math.max(LOW, Math.min(HIGH, hz)) / LOW) / Math.log(HIGH / LOW)
  return Math.min(count - 1, Math.max(0, Math.floor(share * count)))
}

// A struck bubble is loudest the moment it lands and falls away from there, so
// the level a note is holding is read off the same curve it is played on.
const heldAt = (strike: Strike, since: number): number => {
  if (since < 0 || since > strike.length) return 0
  const attack = Math.min(0.012, strike.length / 4)
  const rise = since < attack ? since / attack : 1
  return (strike.gain ?? 1) * rise * Math.exp((-3.2 * since) / strike.length)
}

export function levelsOf(strikes: readonly Strike[], seconds: number, count: number): Levels {
  const slices = Math.max(1, Math.round(seconds * PER_SECOND))
  const rows = new Float32Array(slices * count)
  if (seconds <= 0) return { count, seconds, rows }
  for (const strike of strikes) {
    const band = bandOf(strike.hz, count)
    const first = Math.floor((strike.at * slices) / seconds)
    const span = Math.ceil((strike.length * slices) / seconds) + 1
    for (let step = 0; step <= span; step++) {
      const slice = first + step
      const held = heldAt(strike, (slice * seconds) / slices - strike.at)
      if (held <= 0) continue
      // A note at the end of the loop is still ringing when it comes round.
      rows[(slice % slices) * count + band] += held
    }
  }
  let loudest = 0
  for (const value of rows) loudest = Math.max(loudest, value)
  if (loudest > 0) for (let i = 0; i < rows.length; i++) rows[i] = Math.min(1, rows[i] / loudest)
  return { count, seconds, rows }
}

// Between two slices rather than on one, so a bar falls away smoothly.
export function levelsAt(levels: Levels, at: number, into: number[]): number[] {
  const { count, seconds, rows } = levels
  const slices = rows.length / count
  if (slices <= 0 || seconds <= 0) return into.fill(0)
  const place = (((at % seconds) + seconds) % seconds) * (slices / seconds)
  const first = Math.floor(place)
  const share = place - first
  const a = (first % slices) * count
  const b = ((first + 1) % slices) * count
  for (let band = 0; band < count; band++) {
    into[band] = rows[a + band] * (1 - share) + rows[b + band] * share
  }
  return into
}

const CACHE = new Map<string, Levels>()

export function levelsFor(key: string, count: number, make: () => Levels): Levels {
  const held = CACHE.get(`${key}:${count}`)
  if (held) return held
  const built = make()
  CACHE.set(`${key}:${count}`, built)
  return built
}
