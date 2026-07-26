import type { MusicTrack, MusicTrackId } from '../../../shared/music'
import { pitch } from './pitch'
import type { Strike } from './strike'
import { DEEP, HAT, KICK, SNAP, SPARK, TUNE, type Voice } from './voices'

// A tune is rows of steps. A note is its name, a dot is a rest, a dash holds the
// note before it, an x is a drum, and a bar line is only there to be read. A row
// shorter than the loop comes round again inside it, so a drum is written once
// and a melody is written out.
export interface Line {
  voice: Voice
  // Steps to a beat: 1 is quarter notes, 2 eighths, 4 sixteenths.
  per: number
  play: string
  gain?: number
  pan?: number
  // How long a note rings, as a share of the steps it is held for. A drum says
  // it in seconds instead, since a kick is the same length wherever it lands.
  ring?: number
  hold?: number
}

const OVERWORLD: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.9,
    play: `
      a4  .   cs5 e5  .   fs5 e5  .  | cs5 -   .   b4  cs5 -   .   .  |
      e5  .   fs5 a5  .   fs5 e5  .  | cs5 -   -   .   b4  -   .   .  |
      fs5 .   e5  cs5 .   b4  cs5 .  | a4  -   .   b4  cs5 -   .   .  |
      e5  .   fs5 a5  .   b5  a5  .  | fs5 -   e5  -   cs5 -   -   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 0.95,
    play: `
      a2 - e2 - | fs2 - cs3 - | d2 - a2 - | e2 - e2 - |
      a2 - e2 - | fs2 - cs3 - | d2 - e2 - | e2 -  -  -
    `
  },
  { voice: SPARK, per: 1, pan: 0.18, play: 'e6 . . . | . . cs6 . | . . . . | a5 . . .' },
  { voice: KICK, per: 2, hold: 0.2, play: 'x . . . x . . x' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.9, pan: -0.12, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.16, gain: 0.7, play: '. . . . x . . .' }
]

const ARCADE: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.8,
    play: `
      e5 g5 a5 .  | b5 .  a5 g5 | e5 .  d5 .  | e5 -  .  .  |
      g5 a5 b5 .  | d6 .  b5 a5 | g5 .  e5 -  | -  .  .  .  |
      b5 .  a5 g5 | .  e5 g5 .  | a5 -  .  g5 | e5 -  .  .  |
      d5 .  e5 g5 | .  a5 b5 .  | e5 -  -  .  | d5 -  .  .
    `
  },
  {
    voice: DEEP,
    per: 2,
    ring: 0.7,
    play: 'e2 . e2 e2 . e2 . e2 | g2 . g2 g2 . g2 . g2 | a2 . a2 a2 . a2 . a2 | b2 . b2 b2 . d3 . d3'
  },
  { voice: SPARK, per: 2, pan: -0.2, gain: 0.8, play: 'b6 . . . . . . . | . . . . . . e6 .' },
  { voice: KICK, per: 2, hold: 0.16, play: 'x . x . x . x .' },
  { voice: HAT, per: 4, hold: 0.04, gain: 0.7, pan: 0.14, play: '. x . x . x . x . x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.14, gain: 0.8, play: '. . . . x . . x' }
]

const TIDE_POOL: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.8,
    ring: 1.4,
    play: `
      d5 .  a4 .  | fs5 -  .  .  | e5 .  b4 .  | d5 -  -  .  |
      a5 .  fs5 . | e5  -  .  .  | d5 .  b4 .  | a4 -  -  .  |
      fs5 . d5 .  | a5  -  .  .  | b5 .  a5 .  | fs5 -  -  .  |
      e5 .  d5 .  | b4  -  .  .  | a4 .  fs4 . | d4 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.2,
    play: 'd2 - - - | a2 - - - | b2 - - - | fs2 - - - | g2 - - - | d2 - - - | e2 - - - | a2 - - -'
  },
  {
    voice: SPARK,
    per: 2,
    gain: 0.9,
    pan: 0.22,
    play: '. . . . d6 . . . | . . . . . . . . | . . . . a5 . . . | . . . . . . fs6 .'
  },
  { voice: SNAP, per: 1, hold: 0.3, gain: 0.35, pan: -0.16, play: '. . x .' }
]

const NIGHT_BUS: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.1,
    play: `
      c5 .  .  ds5 | g5 -  .  f5  | ds5 -  .  .  | c5 -  -  .   |
      as4 . .  c5  | ds5 -  .  g5  | f5  -  .  .  | ds5 -  -  .  |
      g5 .  .  as5 | c6  -  .  as5 | g5  -  .  f5 | ds5 -  -  .  |
      c5 .  ds5 f5 | g5  -  .  ds5 | c5  -  -  .  | as4 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.1,
    play: 'c2 - g2 - | as1 - f2 - | ds2 - as2 - | g2 - g2 -'
  },
  { voice: SPARK, per: 2, gain: 0.7, pan: -0.2, play: '. . . . . . g6 . | . . . . . . . .' },
  { voice: KICK, per: 2, hold: 0.24, gain: 0.8, play: 'x . . . . . x .' },
  { voice: HAT, per: 2, hold: 0.06, gain: 0.5, pan: 0.16, play: '. . x . . . x .' }
]

export const TUNES: Record<MusicTrackId, Line[]> = {
  overworld: OVERWORLD,
  arcade: ARCADE,
  'tide-pool': TIDE_POOL,
  'night-bus': NIGHT_BUS
}

export const stepsOf = (line: Line): string[] => line.play.split(/[\s|]+/).filter(Boolean)

// Every note of one pass of the loop, in seconds from the top of it. A row that
// is shorter than the loop is laid down again until it fills, so a drum written
// once keeps time for the whole tune.
export function strikesOf(track: MusicTrack): Strike[] {
  const beat = 60 / track.bpm
  const out: Strike[] = []
  for (const line of TUNES[track.id as MusicTrackId] ?? []) {
    const steps = stepsOf(line)
    if (steps.length === 0) continue
    const step = beat / line.per
    const passes = Math.max(1, Math.round((track.beats * line.per) / steps.length))
    for (let pass = 0; pass < passes; pass++) {
      steps.forEach((token, index) => {
        if (token === '.' || token === '-') return
        const hz = token === 'x' ? (line.voice.hz ?? 0) : pitch(token)
        if (!hz) return
        let held = 1
        while (steps[index + held] === '-') held += 1
        out.push({
          ...line.voice,
          hz,
          at: (pass * steps.length + index) * step,
          length: line.hold ?? held * step * (line.ring ?? 1),
          gain: (line.voice.gain ?? 1) * (line.gain ?? 1),
          pan: line.pan ?? 0
        })
      })
    }
  }
  return out.sort((a, b) => a.at - b.at)
}
