import { tuneLength, type MusicTune } from '../../../shared/music'
import { levelsFor, levelsOf, type Levels } from './levels'
import { pitch } from './pitch'
import type { Strike } from './strike'
import { SONGS } from './songs'
import type { Voice } from './voices'

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

export const stepsOf = (line: Line): string[] => line.play.split(/[\s|]+/).filter(Boolean)

export const hzOf = (line: Line, token: string): number =>
  token === 'x' ? (line.voice.hz ?? 0) : pitch(token)

// Every note of one pass of the loop, in seconds from the top of it. A row that
// is shorter than the loop is laid down again until it fills, so a drum written
// once keeps time for the whole tune.
export function strikesOf(tune: MusicTune): Strike[] {
  const beat = 60 / tune.bpm
  const out: Strike[] = []
  for (const line of SONGS[tune.id as keyof typeof SONGS] ?? []) {
    const steps = stepsOf(line)
    if (steps.length === 0) continue
    const step = beat / line.per
    const passes = Math.max(1, Math.round((tune.beats * line.per) / steps.length))
    for (let pass = 0; pass < passes; pass++) {
      steps.forEach((token, index) => {
        if (token === '.' || token === '-') return
        const hz = hzOf(line, token)
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

// What the tune is doing at every moment of the loop, worked out once and kept.
// It is the same on every machine, so a crew that cannot hear it, or has the
// sound turned down, still watches the same bars as everyone else.
export function tuneLevels(tune: MusicTune, count: number): Levels {
  return levelsFor(tune.id, count, () => levelsOf(strikesOf(tune), tuneLength(tune), count))
}
