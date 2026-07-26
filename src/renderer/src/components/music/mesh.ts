import type { MusicItem } from '../../../../shared/music'

// A cover is a mesh gradient mixed from the track's own colors. It is built out
// of solid fields of color laid over each other and blurred, rather than out of
// soft washes: a wash is half strength everywhere, and five of them on top of
// each other come out of the blur as one flat color, which is a tint and not a
// mesh. Every field here is its own color in the middle and gone by its edge, so
// what the blur has to work with is the boundary between two colors.

const seedOf = (id: string): number => {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

// One number after another from the id, so a cover is always the same cover on
// everyone's screen and no two tracks are laid out alike.
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

const rgbOf = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = rgbOf(hex)
  return `rgb(${r} ${g} ${b} / ${alpha.toFixed(2)})`
}

// Toward white, for the light falling on the mesh. It is the track's own color
// lifted rather than white itself, so a highlight stays in the family instead of
// bleaching a hole in the middle of the picture.
const lift = (hex: string, amount: number): string => {
  const [r, g, b] = rgbOf(hex)
  const up = (one: number): string =>
    Math.round(one + (255 - one) * amount)
      .toString(16)
      .padStart(2, '0')
  return `#${up(r)}${up(g)}${up(b)}`
}

const at = (value: number): string => value.toFixed(0)

// A field of one color: solid across its middle, gone by its edge. It always
// fades to its own color at zero alpha and never to `transparent`, which is
// transparent black and would drag every edge through grey on the way out.
const field = (
  color: string,
  x: number,
  y: number,
  wide: number,
  tall: number,
  core: number,
  alpha: number
): string =>
  `radial-gradient(${at(wide)}% ${at(tall)}% at ${at(x)}% ${at(y)}%, ${rgba(color, alpha)} 0%, ${rgba(color, alpha)} ${at(core)}%, ${rgba(color, 0)} 100%)`

// The petals. Blurred, a conic gradient's spokes bow into the lobed shapes the
// covers this is drawn after are made of, which no stack of circles gives you.
const fan = (colors: readonly string[], x: number, y: number, from: number): string => {
  const stops = colors.map((color, i) => `${rgba(color, 1)} ${at((i / colors.length) * 360)}deg`)
  return `conic-gradient(from ${at(from)}deg at ${at(x)}% ${at(y)}%, ${stops.join(', ')}, ${rgba(colors[0], 1)} 360deg)`
}

// The ground a layout stands on, so there is never a corner the fields did not
// reach showing bare color underneath.
const sweep = (colors: readonly string[], angle: number): string => {
  const stops = colors.map((color, i) => `${rgba(color, 1)} ${at((i / Math.max(1, colors.length - 1)) * 100)}%`)
  return `linear-gradient(${at(angle)}deg, ${stops.join(', ')})`
}

interface Layer {
  image: string
  blend: string
}

// The first three colors are the fields, the fourth is the light, the last is
// the ground. Which of the three leads is rolled from the id, so two tracks
// handed the same palette are still two different pictures.
interface Parts {
  fields: string[]
  light: string
  ground: string
}

const partsOf = (colors: readonly string[], roll: () => number): Parts => {
  const list = colors.length > 0 ? colors : ['#7b5cff', '#22d3ee', '#ff5fa2', '#ffd6f5', '#150b33']
  const ground = list[list.length - 1]
  const light = list[Math.max(0, list.length - 2)]
  const core = list.slice(0, Math.max(1, list.length - 2))
  const by = Math.floor(roll() * core.length)
  return { fields: core.map((_, i) => core[(i + by) % core.length]), light, ground }
}

// Big overlapping lobes with solid middles, each one its own color where it is
// thickest. The most direct of the three, and the one a bright palette wants.
const bloom = (parts: Parts, roll: () => number): Layer[] => {
  const layers: Layer[] = []
  const count = 4 + Math.floor(roll() * 2)
  for (let i = 0; i < count; i++) {
    const color = i === 0 ? parts.light : parts.fields[i % parts.fields.length]
    layers.push({
      image: field(color, 4 + roll() * 92, 4 + roll() * 92, 54 + roll() * 46, 54 + roll() * 46, 12 + roll() * 24, 1),
      blend: 'normal'
    })
  }
  layers.push({ image: sweep([parts.fields[0], parts.ground], 60 + roll() * 240), blend: 'normal' })
  return layers
}

// A sweep of spokes from somewhere off center, with a few fields sitting over
// where they meet. This is the one that reads as light coming from a direction.
const rays = (parts: Parts, roll: () => number): Layer[] => {
  const layers: Layer[] = []
  for (let i = 0; i < 3; i++) {
    layers.push({
      image: field(
        parts.fields[i % parts.fields.length],
        4 + roll() * 92,
        4 + roll() * 92,
        44 + roll() * 42,
        44 + roll() * 42,
        8 + roll() * 20,
        0.9
      ),
      blend: 'normal'
    })
  }
  const spokes = [...parts.fields, parts.light, parts.fields[0], parts.ground, parts.fields[1 % parts.fields.length]]
  layers.push({ image: fan(spokes, 10 + roll() * 80, 8 + roll() * 84, roll() * 360), blend: 'normal' })
  return layers
}

// Broad bands crossing the tile, with two lobes standing on them. The quietest
// of the three, and the one that gives a slow track somewhere to breathe.
const drape = (parts: Parts, roll: () => number): Layer[] => {
  const layers: Layer[] = []
  for (let i = 0; i < 2; i++) {
    layers.push({
      image: field(
        i === 0 ? parts.light : parts.fields[1 % parts.fields.length],
        4 + roll() * 92,
        4 + roll() * 92,
        50 + roll() * 44,
        50 + roll() * 44,
        10 + roll() * 22,
        0.95
      ),
      blend: 'normal'
    })
  }
  const bands = [parts.fields[0], parts.light, parts.fields[1 % parts.fields.length], parts.fields[2 % parts.fields.length], parts.ground]
  layers.push({ image: sweep(bands, roll() * 360), blend: 'normal' })
  return layers
}

const LAYOUTS = [bloom, rays, drape, bloom, rays]

export interface Mesh {
  backgroundColor: string
  backgroundImage: string
  backgroundBlendMode: string
  filter: string
}

// The blur has to be a share of the tile rather than a number of pixels. Held at
// one size it is a soft mesh on the big cover and a single flat color on the
// small one, since a fixed radius half the width of a tile averages the whole
// picture away. This is the whole reason a cover in the list read as one color.
const BLUR = 0.1
const REACH = 1.5

export function meshOf(item: MusicItem, size: number): Mesh {
  const roll = stream(seedOf(item.id))
  const parts = partsOf(item.colors, roll)
  const layout = LAYOUTS[Math.floor(roll() * LAYOUTS.length)]
  // A light arriving from one side and a corner it never reaches. Without the
  // pair the mesh is evenly lit all over and reads flat however many colors are
  // in it. They are the two on top, so they fall across everything below.
  const from = roll()
  const layers: Layer[] = [
    {
      image: field(lift(parts.light, 0.55), 10 + from * 80, 6 + roll() * 30, 62, 58, 0, 0.55),
      blend: 'screen'
    },
    {
      image: field(parts.ground, 92 - from * 80, 88 + roll() * 10, 80, 74, 0, 0.85),
      blend: 'multiply'
    },
    ...layout(parts, roll)
  ]
  return {
    backgroundColor: parts.ground,
    backgroundImage: layers.map(one => one.image).join(', '),
    backgroundBlendMode: layers.map(one => one.blend).join(', '),
    // Blurring mixes colors, and mixing two colors lands between them, so the
    // whole picture loses a little of itself on the way through. Putting it back
    // afterwards is what keeps a blurred mesh as saturated as the colors it was
    // built from.
    filter: `blur(${(size * REACH * BLUR).toFixed(1)}px) saturate(1.4) contrast(1.05)`
  }
}

// Film grain, drawn once by the browser itself. It is the difference between a
// gradient and a print of one.
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")"
