import type { MusicItem } from '../../../../shared/music'

// What a cover is, before anything is drawn. It is a photograph of a few petals
// held right up to the lens: a sky behind them, a handful of shapes standing at
// different distances in front of it, and a light coming from one side.
//
// That is the whole reason it is a list of shapes rather than a stack of
// gradients. Gradients average, and the average of two colors is a third color,
// so a picture built out of them has no objects in it: every edge is both of the
// colors that meet there and none of them is in front. Petals are in front of
// each other. What makes one read as a petal is that it hides what is behind it,
// carries its own color right up to its own edge, and is blurred by its own
// distance rather than by the same blur as everything else.
//
// It is all worked out from the track's id, so a cover is the same picture on
// everyone's screen, and it is kept apart from the drawing so it can be read
// without a graphics card in the room.

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

// The six pictures a cover can be. They are not six sets of numbers around one
// average: each one is a different photograph, and what separates them is how
// many things are in the frame, how big, and how much of the depth they are
// spread through. A single leaf against an open sky and a spray of fronds off
// one corner have nothing in common but the lens.
export const COVER_CASTS = ['blades', 'petals', 'stem', 'veil', 'spray', 'bloom'] as const

export type CoverCast = (typeof COVER_CASTS)[number]

export interface CoverPetal {
  // Its own color, in linear light.
  color: [number, number, number]
  // A point its spine passes through, and the way the spine lies.
  at: [number, number]
  lie: [number, number]
  // How much the spine curves, which is what keeps a petal off being a stripe.
  bend: number
  // Half its width at the fat point, and how far it runs before it comes to a
  // point. Anything past one runs off the frame, which is what a crop is.
  half: number
  along: number
  // How pointed the ends are. Low is a paddle, high is a blade.
  taper: number
  // How far the outline is pushed about, and how fine the push is: nought is
  // the coarsest of the fields the shader draws, one is the finest.
  ruffle: number
  fine: number
  // A wobble of its own along its length, so two petals pushed about by the
  // same field are still two outlines.
  lobe: number
  phase: number
  // How far it is from the lens, said as the softness of its own edge. This is
  // the only thing that makes one shape sit behind another rather than beside
  // it, and it is why they are not all blurred by one amount at the end.
  blur: number
  // How hard its lit edge catches the light, and how much the light rakes
  // across its face.
  rim: number
  shine: number
  // How far it bleeds into what is beside it.
  halo: number
}

export interface CoverArt {
  seed: number
  cast: CoverCast
  // The sky runs from one color to another across the frame, because a real one
  // is never the same brightness twice.
  sky: [number, number, number]
  skyTo: [number, number, number]
  skyLie: [number, number]
  // The color the lit edges take. It is the palette's own light, never white.
  light: [number, number, number]
  // Which way the light arrives from.
  sun: [number, number]
  petals: CoverPetal[]
  // How much the bright places bleed, and how much of the light is in the air.
  bloom: number
  haze: number
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

const mixed = (
  one: [number, number, number],
  two: [number, number, number],
  amount: number
): [number, number, number] => [
  one[0] + (two[0] - one[0]) * amount,
  one[1] + (two[1] - one[1]) * amount,
  one[2] + (two[2] - one[2]) * amount
]

interface Recipe {
  count: [number, number]
  half: [number, number]
  along: [number, number]
  taper: [number, number]
  bend: [number, number]
  // How far the shapes are scattered from the middle, and how far their angles
  // wander from the one the picture is built on.
  scatter: number
  swing: number
  // The near edge and the far edge of the depth the shapes are spread through.
  near: number
  far: number
  ruffle: [number, number]
  fine: [number, number]
  lobe: [number, number]
  rim: [number, number]
  halo: [number, number]
  // Where the shapes hang off, when the picture has a corner it grows from.
  from?: [number, number]
  fan?: number
}

const CASTS: Record<CoverCast, Recipe> = {
  // Long leaves sweeping across the frame at much the same angle, the front one
  // sharp and the rest falling away behind it.
  blades: {
    count: [4, 6],
    half: [0.09, 0.19],
    along: [1.1, 2.2],
    taper: [0.45, 0.9],
    bend: [-0.55, 0.55],
    scatter: 0.4,
    swing: 0.28,
    near: 0.015,
    far: 0.24,
    ruffle: [0.04, 0.1],
    fine: [0.35, 0.75],
    lobe: [0.04, 0.14],
    rim: [0.3, 0.75],
    halo: [0.1, 0.28]
  },
  // Broad lobes overlapping in the middle of the frame, the way a flower fills
  // one. The nearest is barely in focus and the rest are almost fog.
  petals: {
    count: [3, 5],
    half: [0.2, 0.42],
    along: [0.5, 1.0],
    taper: [0.25, 0.6],
    bend: [-0.9, 0.9],
    scatter: 0.34,
    swing: 0.85,
    near: 0.03,
    far: 0.3,
    ruffle: [0.06, 0.16],
    fine: [0.1, 0.5],
    lobe: [0.06, 0.2],
    rim: [0.35, 0.9],
    halo: [0.16, 0.4]
  },
  // One thing nearly in focus against an open sky, with a shape or two far
  // behind it. The lit edge along its spine is the whole picture.
  stem: {
    count: [2, 3],
    half: [0.1, 0.24],
    along: [1.2, 2.4],
    taper: [0.5, 1.1],
    bend: [-0.4, 0.4],
    scatter: 0.26,
    swing: 0.5,
    near: 0.008,
    far: 0.34,
    ruffle: [0.03, 0.08],
    fine: [0.45, 0.9],
    lobe: [0.03, 0.1],
    rim: [0.7, 1.15],
    halo: [0.12, 0.3]
  },
  // Enormous, and so far out of focus that nothing in the frame has an edge at
  // all. It is the softest of them, and the color is the whole of it.
  veil: {
    count: [2, 4],
    half: [0.3, 0.62],
    along: [0.8, 1.6],
    taper: [0.2, 0.5],
    bend: [-1.2, 1.2],
    scatter: 0.42,
    swing: 1.1,
    near: 0.16,
    far: 0.42,
    ruffle: [0.08, 0.2],
    fine: [0.0, 0.35],
    lobe: [0.08, 0.24],
    rim: [0.05, 0.3],
    halo: [0.25, 0.5]
  },
  // Thin fronds fanning out of one corner, all from the same root, spread right
  // through the depth so the near ones cut across the far ones.
  spray: {
    count: [5, 6],
    half: [0.05, 0.12],
    along: [1.3, 2.4],
    taper: [0.7, 1.3],
    bend: [-0.3, 0.3],
    scatter: 0.12,
    swing: 0.16,
    near: 0.01,
    far: 0.26,
    ruffle: [0.02, 0.06],
    fine: [0.6, 1.0],
    lobe: [0.02, 0.08],
    rim: [0.4, 0.9],
    halo: [0.08, 0.22],
    from: [0.5, 0.5],
    fan: 0.9
  },
  // One soft shape swallowing most of the frame, with a small sharp thing or
  // two standing on it to say how close the big one is.
  bloom: {
    count: [3, 4],
    half: [0.12, 0.55],
    along: [0.7, 1.8],
    taper: [0.3, 0.8],
    bend: [-0.7, 0.7],
    scatter: 0.3,
    swing: 0.95,
    near: 0.012,
    far: 0.4,
    ruffle: [0.05, 0.14],
    fine: [0.15, 0.6],
    lobe: [0.05, 0.18],
    rim: [0.3, 0.8],
    halo: [0.18, 0.42]
  }
}

const between = (range: [number, number], roll: number): number => range[0] + roll * (range[1] - range[0])

const whole = (range: [number, number], roll: number): number =>
  Math.min(range[1], range[0] + Math.floor(roll * (range[1] - range[0] + 1)))

const FALLBACK = ['#6fe9ff', '#d8f2ff', '#7fb3ff', '#f4fdff', '#2f9dfa']

// The most a cover can hold. The shader runs this many every time and leaves out
// the ones the picture does not use, because a loop a graphics card can count
// has to be counted the same way for every cover.
export const MAX_PETALS = 6

export function coverArt(item: MusicItem): CoverArt {
  const seed = seedOf(item.id)
  const roll = stream(seed)
  const cast = COVER_CASTS[Math.floor(roll() * COVER_CASTS.length)]
  const recipe = CASTS[cast]

  const colors = item.colors.length >= 5 ? item.colors : FALLBACK
  const light = toLinear(colors[3])
  const sky = toLinear(colors[4])
  // The far side of the sky is the near side carrying a little of the light,
  // which is what a sky does over the width of a frame this small. Mixing in
  // one of the petal colors instead would put a second object in the sky.
  const skyTo = mixed(sky, light, 0.28 + roll() * 0.34)
  const skyAngle = roll() * Math.PI * 2
  const sunAngle = roll() * Math.PI * 2
  const lie = roll() * Math.PI * 2

  const petals: CoverPetal[] = []
  const count = whole(recipe.count, roll())
  for (let i = 0; i < count; i++) {
    // Spread through the depth end to end rather than rolled, so a picture
    // always has a near thing and a far thing in it. Rolled, half the covers
    // come out with everything at one distance, which is a flat picture.
    const depth = count === 1 ? 0 : i / (count - 1)
    const swing = (roll() - 0.5) * recipe.swing
    const angle = recipe.fan ? lie + (depth - 0.5) * recipe.fan + swing * 0.3 : lie + swing
    const off = roll() * Math.PI * 2
    const away = recipe.scatter * Math.sqrt(roll())
    const at: [number, number] = recipe.from
      ? [recipe.from[0] + Math.cos(lie) * -0.55 + (roll() - 0.5) * 0.1, recipe.from[1] + Math.sin(lie) * -0.55 + (roll() - 0.5) * 0.1]
      : [0.5 + Math.cos(off) * away, 0.5 + Math.sin(off) * away]
    // Petals take the palette in turn rather than at random, so all three of a
    // track's colors are in the picture instead of one of them three times.
    const own = toLinear(colors[i % 3])
    petals.push({
      color: mixed(own, light, roll() * 0.3),
      at,
      lie: [Math.cos(angle), Math.sin(angle)],
      bend: between(recipe.bend, roll()),
      half: between(recipe.half, roll()),
      along: between(recipe.along, roll()),
      taper: between(recipe.taper, roll()),
      ruffle: between(recipe.ruffle, roll()),
      fine: between(recipe.fine, roll()),
      lobe: between(recipe.lobe, roll()),
      phase: roll() * Math.PI * 2,
      blur: recipe.near + (recipe.far - recipe.near) * (1 - depth),
      // The nearer it is the harder its edge catches the light. A rim on a
      // shape with no edge left is a bright smudge in the middle of nothing.
      rim: between(recipe.rim, roll()) * (1 - depth * 0.75),
      shine: 0.2 + roll() * 0.5,
      halo: between(recipe.halo, roll())
    })
  }
  // Back to front, so the blurriest is laid down first and the sharpest is the
  // one in front. Everything about the depth is already in the blur, so the
  // order is the only thing left to get right.
  petals.sort((one, two) => two.blur - one.blur)

  return {
    seed,
    cast,
    sky,
    skyTo,
    skyLie: [Math.cos(skyAngle), Math.sin(skyAngle)],
    light,
    sun: [Math.cos(sunAngle), Math.sin(sunAngle)],
    petals,
    bloom: 0.18 + roll() * 0.4,
    haze: roll() * 0.12
  }
}
