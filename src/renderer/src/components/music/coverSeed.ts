import type { MusicItem } from '../../../../shared/music'

// What a cover is, before anything is drawn: a seed, a palette in the order the
// picture ramps through it, and the handful of numbers that decide how the field
// is warped and which way it is smeared. It is all worked out from the track's
// id, so a cover is the same picture on everyone's screen, and it is kept apart
// from the drawing so it can be read without a graphics card in the room.

const seedOf = (id: string): number => {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

const stream = (seed: number): (() => number) => {
  let held = seed || 1
  return () => {
    held ^= held << 13
    held ^= held >>> 17
    held ^= held << 5
    held >>>= 0
    return held / 4294967296
  }
}

// The three things a defocused petal can look like, which is what the covers
// are drawn after. They differ in how far the field is pushed around before it
// is smeared and in how long the smear is, and that is the whole difference
// between a petal, a ribbon and a bloom.
export const COVER_KINDS = ['petal', 'ribbon', 'bloom'] as const

export type CoverKind = (typeof COVER_KINDS)[number]

export interface CoverArt {
  seed: number
  kind: CoverKind
  // The palette in ramp order, deepest first, as [r, g, b] from 0 to 1.
  ramp: Array<[number, number, number]>
  // How far the field is pushed around before it is read.
  warp: number
  // How coarse the field is. A small number is a few big shapes.
  scale: number
  // Which way the smear lies, as a unit vector, and how far it runs.
  lie: [number, number]
  smear: number
  // How hard the edge where two ribbons cross is lit.
  spine: number
  // Where the ramp starts and how much of it the picture uses, which is what
  // makes one cover airy and the next one deep.
  lift: number
  reach: number
  // Which way the picture brightens across the frame, and by how much.
  tilt: [number, number]
}

const rgbOf = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

// Colors are mixed in linear light rather than in the numbers a hex code holds.
// Two colors averaged in sRGB come out darker and greyer than the light itself
// would be, which is the muddy middle every gradient between two bright colors
// has. This is the difference between a picture that glows and one that does
// not, and it costs one line.
const linear = (one: number): number => (one <= 0.04045 ? one / 12.92 : Math.pow((one + 0.055) / 1.055, 2.4))

const toLinear = (hex: string): [number, number, number] => {
  const [r, g, b] = rgbOf(hex)
  return [linear(r), linear(g), linear(b)]
}

const KIND_SHAPE: Record<CoverKind, { warp: [number, number]; smear: [number, number]; scale: [number, number] }> = {
  // Pushed hard and smeared a little: lobes that fold over each other.
  petal: { warp: [0.6, 1.2], smear: [0.1, 0.24], scale: [0.85, 1.5] },
  // Barely pushed and smeared a long way: the long blades of a leaf out of focus.
  ribbon: { warp: [0.25, 0.6], smear: [0.4, 0.75], scale: [0.7, 1.2] },
  // Pushed hard, smeared barely at all, and coarse: one big soft shape.
  bloom: { warp: [0.9, 1.7], smear: [0.05, 0.14], scale: [0.55, 0.95] }
}

const between = (range: [number, number], roll: number): number => range[0] + roll * (range[1] - range[0])

export function coverArt(item: MusicItem): CoverArt {
  const seed = seedOf(item.id)
  const roll = stream(seed)
  const kind = COVER_KINDS[Math.floor(roll() * COVER_KINDS.length)]
  const shape = KIND_SHAPE[kind]
  // Deepest first, so the ramp climbs out of the ground and into the light the
  // way a lit thing does. Which of the field colors leads is rolled, so two
  // tracks handed the same palette are still two different pictures.
  const colors = item.colors.length > 0 ? item.colors : ['#7b5cff', '#22d3ee', '#ff5fa2', '#ffd6f5', '#150b33']
  const ground = colors[colors.length - 1]
  const light = colors[Math.max(0, colors.length - 2)]
  const middle = colors.slice(0, Math.max(1, colors.length - 2))
  const turn = Math.floor(roll() * middle.length)
  const ramp = [ground, ...middle.map((_, i) => middle[(i + turn) % middle.length]), light].map(toLinear)
  const angle = roll() * Math.PI * 2
  return {
    seed,
    kind,
    ramp,
    warp: between(shape.warp, roll()),
    scale: between(shape.scale, roll()),
    lie: [Math.cos(angle), Math.sin(angle)],
    smear: between(shape.smear, roll()),
    spine: 0.2 + roll() * 0.5,
    lift: -0.12 + roll() * 0.24,
    reach: 1.5 + roll() * 1.1,
    tilt: [(roll() - 0.5) * 0.9, (roll() - 0.5) * 0.9]
  }
}
