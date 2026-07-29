import type { CoverSubject } from '../../../../shared/music'

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
    count: [3, 5],
    half: [0.07, 0.16],
    along: [0.55, 1.15],
    taper: [0.5, 1.1],
    bend: [-1.3, 1.3],
    scatter: 0.52,
    swing: 0.28,
    near: 0.022,
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
    count: [3, 4],
    half: [0.16, 0.32],
    along: [0.45, 0.9],
    taper: [0.3, 0.7],
    bend: [-1.6, 1.6],
    scatter: 0.46,
    swing: 0.85,
    near: 0.045,
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
    half: [0.08, 0.2],
    along: [0.7, 1.45],
    taper: [0.55, 1.2],
    bend: [-1.1, 1.1],
    scatter: 0.26,
    swing: 0.5,
    near: 0.032,
    far: 0.34,
    ruffle: [0.03, 0.08],
    fine: [0.45, 0.9],
    lobe: [0.03, 0.1],
    rim: [0.4, 0.8],
    halo: [0.12, 0.3]
  },
  // Enormous, and so far out of focus that nothing in the frame has an edge at
  // all. It is the softest of them, and the color is the whole of it.
  veil: {
    count: [2, 3],
    half: [0.2, 0.38],
    along: [0.6, 1.2],
    taper: [0.25, 0.6],
    bend: [-1.9, 1.9],
    scatter: 0.5,
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
    count: [4, 6],
    half: [0.04, 0.1],
    along: [0.75, 1.4],
    taper: [0.75, 1.4],
    bend: [-0.9, 0.9],
    scatter: 0.12,
    swing: 0.16,
    near: 0.02,
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
    half: [0.09, 0.3],
    along: [0.5, 1.1],
    taper: [0.35, 0.9],
    bend: [-1.5, 1.5],
    scatter: 0.44,
    swing: 0.95,
    near: 0.02,
    far: 0.4,
    ruffle: [0.05, 0.14],
    fine: [0.15, 0.6],
    lobe: [0.05, 0.18],
    rim: [0.3, 0.8],
    halo: [0.18, 0.42]
  }
}

const hueOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex)
  const high = Math.max(r, g, b)
  const low = Math.min(r, g, b)
  const range = high - low
  if (range === 0) return 0
  const turn = high === r ? (g - b) / range + (g < b ? 6 : 0) : high === g ? (b - r) / range + 2 : (r - g) / range + 4
  return turn * 60
}

const apart = (one: number, two: number): number => {
  const gap = Math.abs(one - two) % 360
  return gap > 180 ? 360 - gap : gap
}

// The petals in the order they are handed out, which runs from the one least
// like the sky to the one most like it. Depth is handed out in the same order,
// so the odd color out is the furthest away and the sharpest thing in the frame
// is the one that already belongs.
//
// It is the whole difference between a leaf and a sticker. A color chosen to
// stand against the sky, given the nearest slot, arrives as the hardest edge in
// the picture wearing the most unlike color, and it reads as pasted on however
// good the rest of it is.
const byDistance = (colors: readonly string[], sky: string): string[] => {
  const from = hueOf(sky)
  return colors.slice(0, 3).sort((one, two) => apart(hueOf(two), from) - apart(hueOf(one), from))
}

// Where a tip lands, which is not where the spine points: the spine is bent, so
// it is carried sideways by the bend the whole way out, and a petal with a lot
// of bend leaves the picture long before its own length says it should.
const tipOf = (
  at: [number, number],
  lie: [number, number],
  across: [number, number],
  bend: number,
  run: number
): [number, number] => [
  at[0] + lie[0] * run - across[0] * bend * run * run,
  at[1] + lie[1] * run - across[1] * bend * run * run
]

const SEEN = 0.03

const seen = (spot: [number, number]): boolean =>
  spot[0] > SEEN && spot[0] < 1 - SEEN && spot[1] > SEEN && spot[1] < 1 - SEEN

// A little further in than being seen asks for, so a length worked out against
// this leaves the tip somewhere the bend can still carry it about without
// pushing it out of the picture.
const ROOM = 0.05

// How far the spine may run and still come to a point inside the picture, taken
// the longer way along itself. It is worked out rather than searched for: the
// frame is a box and the spine is a line, so the two places the line crosses the
// box are the whole of the answer. Reading it the longer way is what allows a
// petal to leave the frame at its other end, which is what one held this close
// to a lens does.
const runOf = (at: [number, number], lie: [number, number]): number => {
  let enter = -Infinity
  let exit = Infinity
  for (let axis = 0; axis < 2; axis++) {
    const step = lie[axis]
    if (Math.abs(step) < 1e-6) continue
    const near = (ROOM - at[axis]) / step
    const far = (1 - ROOM - at[axis]) / step
    enter = Math.max(enter, Math.min(near, far))
    exit = Math.min(exit, Math.max(near, far))
  }
  return Math.max(exit, -enter)
}

// The length a petal may run, and the bend it may carry while running it. A
// petal has to come to a point somewhere inside the frame: run far enough that
// both tapers happen off the edge and what is left in the tile is a band of one
// width crossing it corner to corner, which is the one shape that says at a
// glance that a picture was made rather than taken.
//
// The length is the line above. The bend is the half that cannot be solved in
// one line, because it carries the tip sideways the whole way out and by more
// the further out it goes, so a petal with plenty of bend leaves the picture long
// before its own length says it should. It is walked down instead, and that ends
// because straightening one always brings it back to the length that was solved
// for. Shrinking the length instead is what does not end: both tips draw in
// toward the point the spine passes through, and on a spine that passes outside
// the frame there is nothing there to draw in to.
const ends = (
  at: [number, number],
  lie: [number, number],
  across: [number, number],
  bend: number,
  run: number
): { along: number; bend: number } => {
  const along = Math.min(run, runOf(at, lie))
  let bent = bend
  for (let i = 0; i < 18; i++) {
    if (seen(tipOf(at, lie, across, bent, along)) || seen(tipOf(at, lie, across, bent, -along))) break
    bent *= 0.7
  }
  return { along, bend: bent }
}

const between = (range: [number, number], roll: number): number => range[0] + roll * (range[1] - range[0])

const whole = (range: [number, number], roll: number): number =>
  Math.min(range[1], range[0] + Math.floor(roll * (range[1] - range[0] + 1)))

const FALLBACK = ['#6fe9ff', '#d8f2ff', '#7fb3ff', '#f4fdff', '#2f9dfa']

// The most a cover can hold. The shader runs this many every time and leaves out
// the ones the picture does not use, because a loop a graphics card can count
// has to be counted the same way for every cover.
export const MAX_PETALS = 6

export function coverArt(subject: CoverSubject): CoverArt {
  const seed = seedOf(subject.id)
  const roll = stream(seed)
  const cast = COVER_CASTS[Math.floor(roll() * COVER_CASTS.length)]
  const recipe = CASTS[cast]

  const colors = subject.colors.length >= 5 ? subject.colors : FALLBACK
  const light = toLinear(colors[3])
  const sky = toLinear(colors[4])
  // The far side of the sky is the near side carrying a little of the light,
  // which is what a sky does over the width of a frame this small. Mixing in
  // one of the petal colors instead would put a second object in the sky.
  const skyTo = mixed(sky, light, 0.1 + roll() * 0.22)
  const skyAngle = roll() * Math.PI * 2
  const sunAngle = roll() * Math.PI * 2
  const lie = roll() * Math.PI * 2

  const petals: CoverPetal[] = []
  const count = whole(recipe.count, roll())
  const order = byDistance(colors, colors[4])
  for (let i = 0; i < count; i++) {
    // Spread through the depth end to end rather than rolled, so a picture
    // always has a near thing and a far thing in it. Rolled, half the covers
    // come out with everything at one distance, which is a flat picture.
    const depth = count === 1 ? 0 : i / (count - 1)
    const swing = (roll() - 0.5) * recipe.swing
    const angle = recipe.fan ? lie + (depth - 0.5) * recipe.fan + swing * 0.3 : lie + swing
    const off = roll() * Math.PI * 2
    const away = recipe.scatter * Math.sqrt(roll())
    // Held inside the picture, because the whole of the length above is worked
     // out from where the spine crosses the frame, and a spine that passes
    // outside it never crosses at all. A root scattered to the far edge or hung
    // off a corner is barely moved by this, and one placed outside is put back on
    // the picture it is meant to be in.
    const at: [number, number] = (
      recipe.from
        ? [recipe.from[0] + Math.cos(lie) * -0.55 + (roll() - 0.5) * 0.1, recipe.from[1] + Math.sin(lie) * -0.55 + (roll() - 0.5) * 0.1]
        : [0.5 + Math.cos(off) * away, 0.5 + Math.sin(off) * away]
    ).map(one => Math.min(1 - ROOM * 2, Math.max(ROOM * 2, one))) as [number, number]
    // Petals take the palette in turn rather than at random, so all three of a
    // track's colors are in the picture instead of one of them three times, and
    // they are handed out furthest first, so the odd color out is the one at
    // the back.
    //
    // Stretched across the depth rather than cycled, and pinned at both ends,
    // so the furthest petal is always the odd color out and the nearest is
    // always the one that belongs however many petals there are. Cycled, a
    // picture holding more petals than the palette holds colors comes back
    // round to the odd one out and hands it to the sharpest petal in the frame,
    // which is the one place it must never go. Taken as a share of the way
    // through, a picture holding fewer never reaches the end of the palette,
    // and the nearest petal gets the middle color instead of the quiet one.
    const rank = count < 2 ? order.length - 1 : Math.round((i * (order.length - 1)) / (count - 1))
    const own = toLinear(order[rank])
    // Rolled here rather than below, so the length can be cut back to one that
    // ends inside the frame before it is written down. They are taken in the
    // order the petal holds them, because the numbers are drawn off one stream
    // and reading them in another order is a different picture.
    const lit = roll()
    const spine: [number, number] = [Math.cos(angle), Math.sin(angle)]
    const across: [number, number] = [-spine[1], spine[0]]
    const bent = between(recipe.bend, roll())
    const half = between(recipe.half, roll())
    const { along, bend } = ends(at, spine, across, bent, between(recipe.along, roll()))
    petals.push({
      // Then the air in front of it. A thing further off is seen through more
      // of whatever the sky is made of, so it takes on the sky's color as it
      // goes back: that is what settles a leaf into a photograph rather than
      // leaving it sitting on top of one, and it is why a far shape may not
      // carry its color at full strength.
      color: mixed(mixed(own, light, lit * 0.16), sky, (1 - depth) * 0.34),
      at,
      lie: spine,
      bend,
      half,
      along,
      taper: between(recipe.taper, roll()),
      ruffle: between(recipe.ruffle, roll()),
      fine: between(recipe.fine, roll()),
      lobe: between(recipe.lobe, roll()),
      phase: roll() * Math.PI * 2,
      blur: recipe.near + (recipe.far - recipe.near) * (1 - depth),
      // The nearer it is the harder its edge catches the light. A rim on a
      // shape with no edge left is a bright smudge in the middle of nothing,
      // and the far ones are the shapes with no edge left.
      rim: between(recipe.rim, roll()) * (0.2 + depth * 0.8),
      shine: 0.06 + roll() * 0.17,
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
    bloom: 0.1 + roll() * 0.2,
    haze: roll() * 0.04
  }
}
