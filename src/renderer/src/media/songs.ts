import type { MusicTuneId } from '../../../shared/music'
import type { Line } from './tunes'
import { DEEP, HAT, KICK, SNAP, SPARK, TUNE } from './voices'

// The songs themselves, written as rows of steps. How a row is read is in
// tunes.ts; this file is only the music.

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

const STAR_ROAD: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.95,
    play: `
      d5 .  fs5 a5  .  b5  a5  .  | fs5 -  .  e5  fs5 -  .  .  |
      g5 .  b5  d6  .  cs6 b5  .  | a5  -  -  .   fs5 -  .  .  |
      e5 .  g5  b5  .  a5  g5  .  | fs5 -  .  e5  d5  -  .  .  |
      a5 .  b5  cs6 .  d6  cs6 .  | b5  -  a5 -   fs5 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1,
    play: `
      d2 - a2 - | b2 - fs2 - | g2 - d3 - | a2 - a2 - |
      d2 - a2 - | b2 - fs2 - | g2 - a2 - | d2 -  -  -
    `
  },
  { voice: SPARK, per: 1, pan: 0.2, play: 'd6 . . . | . . a5 . | . . . . | fs6 . . . | . . . . | . . b5 . | . . . . | a5 . . .' },
  { voice: KICK, per: 2, hold: 0.2, play: 'x . . x . . x .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.8, pan: -0.14, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.16, gain: 0.65, play: '. . . . x . . .' }
]

const HEARTH: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.9,
    ring: 1.15,
    play: `
      c5 .  e5 g5 .  e5 c5 .  | d5 -  -  .  e5 -  .  .  |
      f5 .  a5 c6 .  a5 f5 .  | e5 -  -  .  d5 -  .  .  |
      e5 .  g5 c6 .  b5 a5 .  | g5 -  .  f5 e5 -  .  .  |
      d5 .  f5 a5 .  g5 e5 .  | c5 -  -  .  g4 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.1,
    play: `
      c2 - g2 - | f2 - c3 - | a2 - e2 - | g2 - g2 - |
      c2 - g2 - | f2 - c3 - | d2 - g2 - | c2 -  -  -
    `
  },
  { voice: SPARK, per: 2, gain: 0.7, pan: 0.18, play: '. . . . c6 . . . | . . . . . . g5 .' },
  { voice: KICK, per: 2, hold: 0.22, gain: 0.85, play: 'x . . . . . x .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.45, pan: -0.16, play: '. x . . . x . .' },
  { voice: SNAP, per: 2, hold: 0.18, gain: 0.5, play: '. . . . x . . .' }
]

const RAIN_CHECK: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.3,
    play: `
      a4 .  c5 e5 .  d5 c5 .  | b4 -  -  .  a4 -  .  .  |
      e5 .  g5 b5 .  a5 g5 .  | e5 -  -  -  .  .  .  .  |
      f5 .  e5 c5 .  d5 e5 .  | a5 -  -  .  g5 -  .  .  |
      e5 .  d5 b4 .  c5 a4 .  | b4 -  -  -  a4 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.25,
    play: 'a2 - - - | f2 - - - | c3 - - - | g2 - - - | a2 - - - | e2 - - - | f2 - - - | e2 - - -'
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.8,
    pan: 0.22,
    play: '. . . . | e6 . . . | . . . . | . . . . | c6 . . . | . . . . | . . . . | a5 . . .'
  },
  { voice: SNAP, per: 1, hold: 0.28, gain: 0.32, pan: -0.18, play: '. . x .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.35, pan: 0.14, play: '. . x . . . x .' }
]

const SPRINT: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.75,
    play: `
      d5 e5 f5 .  | a5 .  f5 e5 | d5 .  c5 .  | d5 -  .  .  |
      f5 g5 a5 .  | c6 .  a5 g5 | f5 .  d5 -  | -  .  .  .  |
      a5 .  g5 f5 | .  d5 f5 .  | g5 -  .  f5 | d5 -  .  .  |
      c5 .  d5 f5 | .  g5 a5 .  | d5 -  -  .  | c5 -  .  .
    `
  },
  {
    voice: DEEP,
    per: 2,
    ring: 0.65,
    play: 'd2 . d2 d2 . d2 . d2 | f2 . f2 f2 . f2 . f2'
  },
  { voice: SPARK, per: 2, gain: 0.85, pan: -0.22, play: 'a6 . . . . . . . | . . . . . . d6 .' },
  { voice: KICK, per: 2, hold: 0.14, play: 'x . x . x . x .' },
  { voice: HAT, per: 4, hold: 0.035, gain: 0.65, pan: 0.16, play: '. x . x . x . x . x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.13, gain: 0.85, play: '. . . . x . . x' }
]

const BUBBLE_BATH: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.85,
    play: `
      g4 .  b4 .  d5 .  b4 .  | g5 -  .  d5 e5  -  .  .  |
      a4 .  c5 .  e5 .  c5 .  | a5 -  .  e5 fs5 -  .  .  |
      b4 .  d5 .  g5 .  d5 .  | b5 -  .  a5 g5  -  .  .  |
      e5 .  d5 .  b4 .  a4 .  | g4 -  -  .  d5  -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 0.9,
    play: `
      g2 - d3 - | a2 - e3 - | b2 - g2 - | d3 - d3 - |
      g2 - d3 - | c3 - g2 - | a2 - d3 - | g2 -  -  -
    `
  },
  { voice: SPARK, per: 2, gain: 0.95, pan: 0.24, play: '. . b6 . . . . . | . . . . g6 . . .' },
  { voice: KICK, per: 2, hold: 0.18, gain: 0.9, play: 'x . . x . . x .' },
  { voice: HAT, per: 2, hold: 0.045, gain: 0.75, pan: -0.18, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.15, gain: 0.6, play: '. . . . x . . .' }
]

const DEEP_DIVE: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.8,
    ring: 1.35,
    play: `
      b3  .  d4  fs4 .  e4  d4  .  | b3 -  -  .  a3  -  .  .  |
      d4  .  fs4 a4  .  g4  fs4 .  | e4 -  -  -  .   .  .  .  |
      g4  .  fs4 d4  .  e4  fs4 .  | b4 -  -  .  a4  -  .  .  |
      fs4 .  e4  d4  .  b3  a3  .  | b3 -  -  -  fs3 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.3,
    play: 'b1 - - - | g1 - - - | d2 - - - | fs1 - - - | b1 - - - | e2 - - - | g1 - - - | fs1 - - -'
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.7,
    pan: -0.2,
    play: '. . . . | . . . . | fs6 . . . | . . . . | . . . . | . . . . | d6 . . . | . . . .'
  },
  { voice: KICK, per: 2, hold: 0.28, gain: 0.9, play: 'x . . . . . x .' },
  { voice: SNAP, per: 1, hold: 0.26, gain: 0.3, pan: 0.18, play: '. . x .' }
]

const SUNRISE: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 1.05,
    play: `
      e5  .  gs5 b5  .  a5  gs5 .  | fs5 -  .  e5  fs5 -  .  .  |
      a5  .  b5  cs6 .  b5  a5  .  | gs5 -  -  .  fs5 -  .  .  |
      b5  .  a5  gs5 .  fs5 e5  .  | fs5 -  .  gs5 a5  -  .  .  |
      gs5 .  fs5 e5  .  b4  cs5 .  | e5  -  -  -   b4  -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.05,
    play: `
      e2 - b2 - | cs2 - gs2 - | a2 - e3 - | b2 - b2 - |
      e2 - b2 - | cs2 - gs2 - | a2 - b2 - | e2 -  -  -
    `
  },
  { voice: SPARK, per: 2, gain: 0.8, pan: 0.2, play: '. . . . . . e6 . | . . . . . . . .' },
  { voice: KICK, per: 2, hold: 0.2, gain: 0.9, play: 'x . . . x . . x' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.6, pan: -0.15, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.16, gain: 0.6, play: '. . . . x . . .' }
]

const SNOWFIELD: Line[] = [
  {
    voice: TUNE,
    per: 1,
    gain: 0.75,
    ring: 1.5,
    play: `
      f4 -  -  a4 | c5 -  -  -  | d5 -  c5 -  | a4 -  -  -  |
      g4 -  -  c5 | f5 -  -  -  | e5 -  d5 -  | c5 -  -  -
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.4,
    play: 'f2 - - - | as2 - - - | c3 - - - | f2 - - - | d2 - - - | as1 - - - | c2 - - - | f2 - - -'
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.85,
    pan: 0.24,
    play: '. . . . | . . . . | f6 . . . | . . . . | . . . . | . . . . | c6 . . . | . . . .'
  },
  { voice: SNAP, per: 1, hold: 0.32, gain: 0.28, pan: -0.2, play: '. . . . x . . .' }
]

const BOSS_FIGHT: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 0.8,
    play: `
      c5  .  ds5 g5 .  f5  ds5 .  | c5 -  .  as4 c5  -  .  .  |
      g5  .  as5 c6 .  as5 g5  .  | f5 -  -  .   ds5 -  .  .  |
      gs5 .  g5  f5 .  ds5 f5  .  | g5 -  .  as5 c6  -  .  .  |
      c6  .  as5 g5 .  f5  ds5 .  | c5 -  -  -   g4  -  -  .
    `
  },
  {
    voice: DEEP,
    per: 2,
    ring: 0.6,
    play: 'c2 . c2 c2 . c2 . ds2 | g1 . g1 g1 . as1 . c2'
  },
  { voice: SPARK, per: 2, gain: 0.9, pan: -0.24, play: 'c7 . . . . . . . | . . . . . . g6 .' },
  { voice: KICK, per: 2, hold: 0.15, gain: 1.05, play: 'x . x . x . x x' },
  { voice: HAT, per: 4, hold: 0.035, gain: 0.7, pan: 0.18, play: '. x . x . x . x . x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.13, gain: 0.9, play: '. . . . x . . x' }
]

const LOBBY: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1,
    play: `
      a4  .  cs5 .  e5  .  cs5 .  | b4 -  -  .  a4 -  .  .  |
      d5  .  fs5 .  a5  .  fs5 .  | e5 -  -  .  cs5 - .  .  |
      e5  .  fs5 .  gs5 .  a5  .  | b5 -  -  .  a5 -  .  .  |
      fs5 .  e5  .  cs5 .  b4  .  | a4 -  -  -  e4 -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1,
    play: `
      a2 - e3 - | d2 - a2 - | e2 - b2 - | a2 - a2 - |
      a2 - e3 - | d2 - fs2 - | e2 - e2 - | a2 -  -  -
    `
  },
  { voice: SPARK, per: 2, gain: 0.65, pan: 0.16, play: '. . . . a5 . . . | . . . . . . cs6 .' },
  { voice: KICK, per: 2, hold: 0.2, gain: 0.8, play: 'x . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.5, pan: -0.14, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.16, gain: 0.55, play: '. . . . x . . .' }
]

const CREDITS: Line[] = [
  {
    voice: TUNE,
    per: 2,
    ring: 1.1,
    play: `
      c5 .  f5  a5  .  g5  f5  .  | e5 -  .  d5  c5  -  .  .  |
      d5 .  g5  as5 .  a5  g5  .  | f5 -  -  .   e5  -  .  .  |
      a5 .  c6  f6  .  e6  d6  .  | c6 -  .  as5 a5  -  .  .  |
      g5 .  a5  as5 .  c6  as5 .  | a5 -  f5 -   c5  -  -  .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.05,
    play: `
      f2 - c3 - | as2 - f2 - | g2 - d3 - | c3 - c3 - |
      f2 - c3 - | as2 - d3 - | g2 - c3 - | f2 -  -  -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.75,
    pan: 0.2,
    play: 'f6 . . . | . . . . | c6 . . . | . . . . | a6 . . . | . . . . | . . f6 . | . . . .'
  },
  { voice: KICK, per: 2, hold: 0.22, gain: 0.85, play: 'x . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.55, pan: -0.16, play: '. x . x . x . x' },
  { voice: SNAP, per: 2, hold: 0.17, gain: 0.6, play: '. . . . x . . .' }
]

// The slow ones. Sixteen bars rather than eight, two of them to a chord, so the
// loop is about a minute round and comes back to the top once rather than four
// times. A melody leaves more room than it fills, the low one walks under it in
// whole bars, and the kit stays out of the way where there is one at all.

const SLOW_MORNING: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.35,
    play: `
      .   .   a4  .   c5  .   .   .   | e5  -   -   -   .   .   .   .   |
      g4  .   .   .   c5  -   -   .   | e5  -   .   .   .   .   .   .   |
      a4  .   c5  .   d5  -   -   .   | f5  -   -   -   -   .   .   .   |
      d5  .   .   f5  .   d5  .   .   | as4 -   -   -   .   .   .   .   |
      f5  .   .   a5  .   g5  f5  .   | d5  -   -   -   .   .   .   .   |
      c5  .   e5  .   g5  -   -   .   | e5  -   .   c5  .   .   .   .   |
      as4 .   d5  .   f5  -   .   .   | d5  -   -   .   c5  -   .   .   |
      g4  .   .   as4 .   c5  -   -   | -   .   .   .   .   .   .   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.4,
    play: `
      f2  - - - c3 - - - | a2  - - - e3 - - - |
      d2  - - - a2 - - - | g2  - - - d3 - - - |
      as1 - - - f2 - - - | a2  - - - e3 - - - |
      g2  - - - d3 - - - | c2  - - - g2 - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.6,
    pan: 0.2,
    play: `
      . . . . . . . . | c6 . . . . . . . |
      . . . . . . . . | f5 . . . . . . . |
      . . . . a5 . . . | . . . . . . . . |
      . . . . . . . . | c6 . . . . . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.3, gain: 0.7, play: 'x . . . x . . . | x . . . . . x .' },
  { voice: SNAP, per: 2, hold: 0.22, gain: 0.4, play: '. . . . x . . . | . . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.28, pan: -0.14, play: '. . . x . . . x' }
]

const DUST_MOTES: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.8,
    ring: 1.6,
    play: `
      .   .   a4  .   .   .   b4  -   | c5  -   -   -   -   .   .   .   |
      .   .   .   .   a4  -   -   .   | e5  -   -   -   -   -   .   .   |
      g4  -   .   .   b4  .   .   .   | e5  -   -   .   d5  -   -   .   |
      d5  -   .   .   b4  -   .   .   | e5  -   -   -   -   .   .   .   |
      .   .   c5  .   b4  -   .   .   | a4  -   -   -   -   -   .   .   |
      f4  -   .   a4  .   .   .   .   | c5  -   -   .   a4  -   -   .   |
      .   .   e5  -   .   .   c5  -   | a4  -   -   -   -   .   .   .   |
      b4  -   .   .   a4  -   .   .   | e4  -   -   -   -   -   -   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.5,
    play: `
      a1 - - - e2 - - - | f1 - - - c2 - - - |
      c2 - - - g2 - - - | g1 - - - d2 - - - |
      a1 - - - e2 - - - | d2 - - - a2 - - - |
      f1 - - - c2 - - - | e2 - - - b2 - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.55,
    pan: 0.24,
    play: `
      . . . . . . . . | . . . . e6 . . . |
      . . . . . . . . | . . . . .  . . . |
      . . . . a5 . . . | . . . . . . . . |
      . . . . . . . . | c6 . . . . . . .
    `
  },
  { voice: SNAP, per: 1, hold: 0.34, gain: 0.26, pan: -0.18, play: '. . x .' }
]

const SECOND_COFFEE: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.3,
    play: `
      e5  .   .   g5  .   e5  .   .   | d5  -   -   -   .   .   .   .   |
      b4  .   d5  .   g5  -   -   .   | e5  -   .   .   .   .   .   .   |
      c5  .   e5  .   a5  -   -   .   | g5  -   -   .   e5  -   .   .   |
      a4  .   c5  .   f5  -   .   .   | d5  -   -   -   .   .   .   .   |
      g4  .   b4  .   d5  .   f5  .   | e5  -   -   -   .   .   .   .   |
      g5  .   .   e5  .   c5  -   -   | d5  -   .   e5  .   .   .   .   |
      a5  .   .   f5  .   e5  c5  .   | a4  -   -   -   .   .   .   .   |
      b4  .   d5  .   f5  -   .   .   | e5  -   -   -   -   .   .   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.2,
    play: `
      c2 - - - g2 - - - | e2 - - - b2 - - - |
      a2 - - - e3 - - - | d2 - - - a2 - - - |
      g1 - - - d2 - - - | c2 - - - g2 - - - |
      f2 - - - c3 - - - | g1 - - - d2 - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.6,
    pan: -0.2,
    play: `
      g6 . . . . . . . | . . . . .  . . . |
      .  . . . e6 . . . | . . . . . . . . |
      .  . . . . . . . | c6 . . . . . . . |
      .  . . . . . . . | . . . . g5 . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.28, gain: 0.75, play: 'x . . . . . x . | x . . . x . . .' },
  { voice: SNAP, per: 2, hold: 0.2, gain: 0.45, play: '. . . . x . . . | . . . . x . . x' },
  { voice: HAT, per: 2, hold: 0.045, gain: 0.3, pan: 0.16, play: '. . . x . . . x' }
]

const PAPER_LAMP: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.82,
    ring: 1.4,
    play: `
      .   .   d5  .   f5  -   -   .   | g5  -   -   -   -   .   .   .   |
      as4 .   .   ds5 .   g5  -   -   | f5  -   -   .   .   .   .   .   |
      g5  .   .   as5 .   g5  f5  .   | ds5 -   -   -   -   .   .   .   |
      f5  .   a5  .   c6  -   -   .   | as5 -   -   .   f5  -   .   .   |
      d5  .   .   g5  .   as5 -   -   | a5  -   -   -   .   .   .   .   |
      f5  .   d5  .   as4 -   .   .   | d5  -   -   -   -   .   .   .   |
      ds5 .   .   g5  .   as5 -   -   | g5  -   .   f5  .   .   .   .   |
      c5  .   .   f5  .   a5  -   -   | f5  -   -   -   -   -   .   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.3,
    play: `
      g1  - - - d2  - - - | c2  - - - g2  - - - |
      ds2 - - - as2 - - - | f2  - - - c3  - - - |
      g1  - - - d2  - - - | as1 - - - f2  - - - |
      ds2 - - - as2 - - - | f2  - - - c3  - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.55,
    pan: 0.22,
    play: `
      . . . . .  . . . | as5 . . . . . . . |
      . . . . .  . . . | .   . . . . . . . |
      . . . . g6 . . . | .   . . . . . . . |
      . . . . .  . . . | d6  . . . . . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.3, gain: 0.72, play: 'x . . . x . . . | x . . . . x . .' },
  { voice: SNAP, per: 2, hold: 0.22, gain: 0.4, play: '. . . . x . . . | . . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.22, pan: -0.16, play: '. . . x . . . .' }
]

const WINDOW_SEAT: Line[] = [
  {
    voice: TUNE,
    per: 1,
    gain: 0.75,
    ring: 1.7,
    play: `
      d5  - - f5  | a5  - - - | g4  - as4 - | d5 - - - |
      f5  - - d5  | as4 - - - | c5  - -   e5 | a4 - - - |
      d5  - - a4  | f5  - - - | a5  - -   f5 | d5 - - - |
      as4 - d5 -  | f5  - - - | e5  - -   d5 | a4 - - -
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.6,
    play: `
      d2  - - - a2 - - - | g1 - - - d2 - - - |
      as1 - - - f2 - - - | a1 - - - e2 - - - |
      d2  - - - a2 - - - | f2 - - - c3 - - - |
      g2  - - - d3 - - - | a1 - - - e2 - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.6,
    pan: 0.24,
    play: `
      . . . . .  . . . | . . . . d6 . . . |
      . . . . .  . . . | . . . . .  . . . |
      . . . . a5 . . . | . . . . .  . . . |
      . . . . .  . . . | f6 . . . . . . .
    `
  },
  { voice: SNAP, per: 1, hold: 0.36, gain: 0.24, pan: -0.2, play: '. . x .' }
]

const CASSETTE: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.3,
    play: `
      .   .   b4  .   d5  -   -   .   | e5  -   -   -   .   .   .   .   |
      g4  .   .   b4  .   e5  -   -   | d5  -   -   .   .   .   .   .   |
      c5  .   e5  .   g5  -   .   .   | e5  -   -   -   -   .   .   .   |
      a4  .   .   d5  .   fs5 -   -   | e5  -   -   .   b4  -   .   .   |
      b4  .   d5  .   fs5 -   -   .   | g5  -   -   -   .   .   .   .   |
      e5  .   .   g5  .   b5  -   -   | a5  -   -   .   g5  -   .   .   |
      e5  .   c5  .   a4  -   .   .   | c5  -   -   -   -   .   .   .   |
      d5  .   .   fs5 .   a5  -   -   | b4  -   -   -   -   -   .   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.25,
    play: `
      e2 - - - b2  - - - | c2 - - - g2  - - - |
      a1 - - - e2  - - - | b1 - - - fs2 - - - |
      e2 - - - b2  - - - | g2 - - - d3  - - - |
      a2 - - - e3  - - - | b1 - - - fs2 - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.6,
    pan: -0.22,
    play: `
      . . . . .  . . . | b5 . . . . . . . |
      . . . . .  . . . | .  . . . . . . . |
      . . . . e6 . . . | .  . . . . . . . |
      . . . . .  . . . | g5 . . . . . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.26, gain: 0.78, play: 'x . . . . . x . | x . . . x . . .' },
  { voice: SNAP, per: 2, hold: 0.2, gain: 0.45, play: '. . . . x . . . | . . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.05, gain: 0.3, pan: 0.15, play: '. . . x . . . x' }
]

const ROOFTOP: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.85,
    ring: 1.35,
    play: `
      .   .   cs5 .   e5  -   -   .   | gs5 -   -   -   .   .   .   .   |
      a4  .   .   cs5 .   e5  -   -   | cs5 -   -   .   .   .   .   .   |
      d5  .   fs5 .   a5  -   -   .   | fs5 -   -   -   -   .   .   .   |
      gs5 .   .   b5  .   gs5 -   -   | e5  -   -   .   d5  -   .   .   |
      cs5 .   e5  .   a5  -   -   .   | gs5 -   -   -   .   .   .   .   |
      fs5 .   .   a5  .   b5  -   -   | a5  -   -   .   fs5 -   .   .   |
      d5  .   fs5 .   b5  -   .   .   | a5  -   -   -   -   .   .   .   |
      gs4 .   .   b4  .   d5  -   -   | e5  -   -   -   -   -   .   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.3,
    play: `
      a1  - - - e2  - - - | fs1 - - - cs2 - - - |
      b1  - - - fs2 - - - | e2  - - - b2  - - - |
      a1  - - - e2  - - - | d2  - - - a2  - - - |
      b1  - - - fs2 - - - | e2  - - - b2  - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.55,
    pan: 0.2,
    play: `
      . . . . .  . . . | cs6 . . . . . . . |
      . . . . .  . . . | .   . . . . . . . |
      . . . . a5 . . . | .   . . . . . . . |
      . . . . .  . . . | e6  . . . . . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.27, gain: 0.75, play: 'x . . . x . . . | x . . . . . x .' },
  { voice: SNAP, per: 2, hold: 0.2, gain: 0.42, play: '. . . . x . . . | . . . . x . . .' },
  { voice: HAT, per: 2, hold: 0.045, gain: 0.28, pan: -0.16, play: '. . . x . . . x' }
]

const LONG_SHADOWS: Line[] = [
  {
    voice: TUNE,
    per: 2,
    gain: 0.78,
    ring: 1.55,
    play: `
      .   .   g4  .   as4 -   -   .   | d5  -   -   -   -   .   .   .   |
      .   .   .   .   ds5 -   -   .   | g5  -   -   -   -   -   .   .   |
      as4 -   .   .   d5  .   .   .   | g5  -   -   .   f5  -   -   .   |
      f5  -   .   .   d5  -   .   .   | as4 -   -   -   -   .   .   .   |
      .   .   ds5 .   d5  -   .   .   | c5  -   -   -   -   -   .   .   |
      gs4 -   .   c5  .   .   .   .   | ds5 -   -   .   c5  -   -   .   |
      .   .   g5  -   .   .   ds5 -   | c5  -   -   -   -   .   .   .   |
      d5  -   .   .   c5  -   .   .   | g4  -   -   -   -   -   -   .
    `
  },
  {
    voice: DEEP,
    per: 1,
    ring: 1.5,
    play: `
      c2  - - - g2  - - - | gs1 - - - ds2 - - - |
      ds2 - - - as2 - - - | as1 - - - f2  - - - |
      c2  - - - g2  - - - | f2  - - - c3  - - - |
      gs1 - - - ds2 - - - | g2  - - - d3  - - -
    `
  },
  {
    voice: SPARK,
    per: 1,
    gain: 0.5,
    pan: 0.22,
    play: `
      . . . . .   . . . | .   . . . g5 . . . |
      . . . . .   . . . | .   . . . .  . . . |
      . . . . ds6 . . . | .   . . . .  . . . |
      . . . . .   . . . | as5 . . . .  . . .
    `
  },
  { voice: KICK, per: 2, hold: 0.32, gain: 0.65, play: 'x . . . . . . . | x . . . . . x .' },
  { voice: SNAP, per: 1, hold: 0.34, gain: 0.26, pan: -0.18, play: '. . x .' }
]

export const SONGS: Record<MusicTuneId, Line[]> = {
  overworld: OVERWORLD,
  arcade: ARCADE,
  'tide-pool': TIDE_POOL,
  'night-bus': NIGHT_BUS,
  'star-road': STAR_ROAD,
  hearth: HEARTH,
  'rain-check': RAIN_CHECK,
  sprint: SPRINT,
  'bubble-bath': BUBBLE_BATH,
  'deep-dive': DEEP_DIVE,
  sunrise: SUNRISE,
  snowfield: SNOWFIELD,
  'boss-fight': BOSS_FIGHT,
  lobby: LOBBY,
  credits: CREDITS
}
