import { MESH_COLORS } from '../CrewMark'

// The shape of the orb, as numbers. Nothing here draws anything or knows what a
// canvas is, the same split the games hold.
//
// A circle that only changes size is a circle changing size. What makes one of
// these read as a voice is that the edge itself moves, and moves differently at
// different parts of it: the bass swells one side of the whole shape, and a
// sibilant ripples the rim. So the outline is a circle with a harmonic on it
// per band of what is being heard, low bands on the slow harmonics and high
// bands on the fast ones.

export const BANDS = 5

// Never the first harmonic. One lobe around a circle is the circle moved
// sideways, so the orb would slide about the screen rather than breathe.
export const HARMONICS = [2, 3, 5, 7, 9]

// How much each harmonic is allowed to bend the edge. High frequencies are
// quick and everywhere, so left equal they turn the orb into a gear.
const WEIGHT = [0.115, 0.085, 0.055, 0.038, 0.026]

// How fast each harmonic turns, and how much louder makes it hurry.
const SPIN = [0.32, -0.24, 0.19, -0.15, 0.12]
const SPIN_GAIN = 1.5

const LOW_HZ = 70
const HIGH_HZ = 6000

const RISE_TAU = 0.028
const FALL_TAU = 0.19
const LIT_TAU = 0.22
const RING_TAU = 0.3

const BREATH_RATE = 0.55
const REST_SWELL = 0.017
const SWELL = 0.17

// The mark's own mesh, arranged in a disc rather than across a wordmark. The
// colors are not this file's to choose: the app says anything it says in color
// through that one palette.
export interface OrbBlob {
  color: string
  x: number
  y: number
  r: number
  reach: number
  rate: number
  lag: number
}

const PLACES = [
  { x: -0.34, y: -0.3, r: 0.86, reach: 0.16, rate: 0.41, lag: 0 },
  { x: 0.31, y: -0.16, r: 0.8, reach: 0.19, rate: -0.33, lag: 1.7 },
  { x: 0.12, y: 0.38, r: 0.9, reach: 0.15, rate: 0.27, lag: 3.1 },
  { x: -0.28, y: 0.34, r: 0.74, reach: 0.21, rate: -0.45, lag: 4.6 },
  { x: 0.02, y: -0.06, r: 0.5, reach: 0.24, rate: 0.53, lag: 2.2 }
]

export const ORB_BLOBS: OrbBlob[] = MESH_COLORS.map((color, index) => ({ color, ...PLACES[index % PLACES.length] }))

export interface OrbFace {
  bands: number[]
  phases: number[]
  level: number
  swell: number
  breath: number
  // How far the mesh has come up. It is the agent's voice that lights the orb:
  // your own turn leaves it in the one color the mark wears at rest.
  lit: number
  ring: number
}

export const restingOrb = (): OrbFace => ({
  bands: new Array(BANDS).fill(0),
  phases: HARMONICS.map((_, index) => index * 1.7),
  level: 0,
  swell: 1,
  breath: 0,
  lit: 0,
  ring: 0
})

const bandOf = (hz: number): number => {
  const share = Math.log(Math.max(LOW_HZ, Math.min(HIGH_HZ, hz)) / LOW_HZ) / Math.log(HIGH_HZ / LOW_HZ)
  return Math.min(BANDS - 1, Math.max(0, Math.floor(share * BANDS)))
}

// A spectrum as the few numbers the shape is made of. Byte data rather than
// float, because the shape only needs to know loud from quiet.
export function bandsFrom(spectrum: Uint8Array, sampleRate: number, into: number[]): number {
  const width = sampleRate / 2 / spectrum.length
  const sums = new Array(BANDS).fill(0)
  const counts = new Array(BANDS).fill(0)
  for (let bin = 1; bin < spectrum.length; bin++) {
    const band = bandOf((bin + 0.5) * width)
    sums[band] += spectrum[bin]
    counts[band]++
  }
  let total = 0
  for (let band = 0; band < BANDS; band++) {
    into[band] = counts[band] > 0 ? Math.min(1, sums[band] / counts[band] / 190) : 0
    total += into[band]
  }
  return total / BANDS
}

const toward = (held: number, want: number, dt: number, tau: number): number =>
  held + (want - held) * (1 - Math.exp(-dt / Math.max(1e-4, tau)))

// `still` is somebody who has asked the machine to stop moving things. It holds
// the shape where it is and nothing else: the ring saying how far the download
// has got, and the color saying who is talking, are things the screen is
// telling you rather than motion for its own sake, so they carry on.
export function stepOrb(
  face: OrbFace,
  dt: number,
  read: readonly number[],
  lit: number,
  ring: number,
  still = false
): void {
  face.lit = toward(face.lit, lit, dt, LIT_TAU)
  face.ring = toward(face.ring, ring, dt, RING_TAU)
  if (still) {
    face.bands.fill(0)
    face.level = 0
    face.swell = 1
    return
  }
  let total = 0
  for (let band = 0; band < BANDS; band++) {
    const want = Math.min(1, Math.max(0, read[band] ?? 0))
    // Up on the instant and down over a breath, so a syllable reads as a hit
    // rather than as a wave, which is the same rule the music's bars follow.
    face.bands[band] = toward(face.bands[band], want, dt, want > face.bands[band] ? RISE_TAU : FALL_TAU)
    face.phases[band] += (SPIN[band] + face.bands[band] * SPIN_GAIN * Math.sign(SPIN[band])) * dt
    total += face.bands[band]
  }
  face.level = total / BANDS
  face.breath += dt * BREATH_RATE
  face.swell = 1 + face.level * SWELL + Math.sin(face.breath) * REST_SWELL
}

// The edge of the orb, at one angle. Read all the way round it, this is the
// outline; the harmonics are what make it a voice rather than a balloon.
export function orbRadius(face: OrbFace, angle: number, base: number): number {
  let bend = 0
  for (let band = 0; band < BANDS; band++) {
    bend += Math.sin(HARMONICS[band] * angle + face.phases[band]) * WEIGHT[band] * face.bands[band]
  }
  return base * face.swell * (1 + bend)
}
