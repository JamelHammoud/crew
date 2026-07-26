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

const at = (value: number): string => value.toFixed(1)

// The mesh is painted on a layer half again as big as the tile, so the tile is
// the middle two thirds of it and the outer third is only there for the blur to
// spill into. Everything below is laid out in the tile's own coordinates and put
// through these, or a light placed near an edge lands outside the picture: that
// is how a cover ends up as the one wash left over in the middle.
const OVER = 0.25
const spot = (share: number): number => (OVER + share * 1) * (100 / (1 + OVER * 2))
const span = (share: number): number => share * (100 / (1 + OVER * 2))

// A field of one color: solid across its middle, gone by its edge. The plateau
// is most of it, so what the blur has to work with is the boundary between two
// colors rather than the whole of both. It fades to its own color at zero alpha
// and never to `transparent`, which is transparent black and would drag every
// edge through grey on the way out.
const field = (
  color: string,
  x: number,
  y: number,
  wide: number,
  tall: number,
  core: number,
  alpha: number
): string =>
  `radial-gradient(${at(span(wide))}% ${at(span(tall))}% at ${at(spot(x))}% ${at(spot(y))}%, ${rgba(color, alpha)} 0%, ${rgba(color, alpha)} ${at(core)}%, ${rgba(color, 0)} 100%)`

// The petals. Blurred, a conic gradient's spokes bow into the lobed shapes the
// covers this is drawn after are made of, which no stack of circles gives you.
const fan = (colors: readonly string[], x: number, y: number, from: number): string => {
  const stops = colors.map((color, i) => `${rgba(color, 1)} ${at((i / colors.length) * 360)}deg`)
  return `conic-gradient(from ${at(from)}deg at ${at(spot(x))}% ${at(spot(y))}%, ${stops.join(', ')}, ${rgba(colors[0], 1)} 360deg)`
}

// Broad bands across the whole thing, for a layout to stand its lobes on.
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

// Every color the track has, in the order they are laid down: the light, the
// three fields, and the ground. A cover uses all five, so the picture carries
// the palette's whole range rather than the middle of it. The bright end and the
// deep end are both lobes like any other, standing wherever the id puts them.
//
// Neither of them is ever a layer of its own in a fixed place. A highlight
// painted across the top and a shade dropped in the far corner give every cover
// the same lit-from-there diagonal, and a set of covers that all read alike is
// worse than a flat one: the whole job of these is telling one track from
// another down a list.
const shuffle = (parts: Parts): string[] => [parts.light, ...parts.fields, parts.ground]

// A layout that takes fewer lobes than the palette has still takes the two ends
// of it. Slicing off the front left the ground behind every time, and a picture
// mixed from the middle of a palette is the flat one this started as.
const ends = (parts: Parts, count: number): string[] => {
  const middle = shuffle(parts).slice(1, -1)
  const held = [parts.light, ...middle.slice(0, Math.max(0, count - 2)), parts.ground]
  return held.slice(0, count)
}

// The deep end is the widest lobe of any cover. It is what everything brighter
// stands on, so it needs the room, and it is the one thing keeping these from
// reading as a set of pastels.
const GROUND_REACH = 1.25

// Lobes ringing the middle, each solid where it is thickest, all of them wide
// enough to overlap their neighbours. This is the one that reads as the colors
// pushing against each other.
const bloom = (parts: Parts, roll: () => number): Layer[] => {
  const palette = shuffle(parts)
  const turn = roll()
  const layers: Layer[] = palette.map((color, i) => {
    const angle = (i / palette.length + turn) * Math.PI * 2
    const reach = 0.26 + roll() * 0.24
    return {
      image: field(
        color,
        0.5 + Math.cos(angle) * reach,
        0.5 + Math.sin(angle) * reach,
        0.6 + roll() * 0.55,
        0.6 + roll() * 0.55,
        40 + roll() * 26,
        1
      ),
      blend: 'normal'
    }
  })
  layers.push({ image: field(parts.fields[0], 0.5, 0.5, 2.4, 2.4, 62, 1), blend: 'normal' })
  return layers
}

// Spokes from somewhere off center, with a few lobes standing over where they
// meet. This is the one that reads as light arriving from a direction.
const rays = (parts: Parts, roll: () => number): Layer[] => {
  const palette = shuffle(parts)
  const turn = roll()
  const layers: Layer[] = palette.slice(0, 3).map((color, i) => {
    const angle = (i / 3 + turn) * Math.PI * 2
    return {
      image: field(
        color,
        0.5 + Math.cos(angle) * 0.32,
        0.5 + Math.sin(angle) * 0.32,
        0.6 + roll() * 0.4,
        0.6 + roll() * 0.4,
        36 + roll() * 22,
        0.95
      ),
      blend: 'normal'
    }
  })
  const spokes = [...parts.fields, parts.light, parts.fields[0], parts.ground, parts.fields[1 % parts.fields.length]]
  layers.push({ image: fan(spokes, 0.1 + roll() * 0.8, 0.1 + roll() * 0.8, roll() * 360), blend: 'normal' })
  return layers
}

// Broad bands crossing the whole thing, with lobes standing on them. The
// quietest of the three, and the one that gives a slow track somewhere to
// breathe. It takes four lobes rather than two, or the bands are all you see.
const drape = (parts: Parts, roll: () => number): Layer[] => {
  const palette = shuffle(parts)
  const turn = roll()
  const layers: Layer[] = palette.slice(0, 4).map((color, i) => {
    const angle = (i / 4 + turn) * Math.PI * 2
    return {
      image: field(
        color,
        0.5 + Math.cos(angle) * (0.24 + roll() * 0.18),
        0.5 + Math.sin(angle) * (0.24 + roll() * 0.18),
        0.55 + roll() * 0.45,
        0.55 + roll() * 0.45,
        38 + roll() * 24,
        0.95
      ),
      blend: 'normal'
    }
  })
  layers.push({
    image: sweep([parts.fields[0], parts.light, parts.fields[1 % parts.fields.length], parts.ground], roll() * 360),
    blend: 'normal'
  })
  return layers
}

const LAYOUTS = [bloom, rays, drape, bloom, rays, drape]

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
const BLUR = 0.09

export function meshOf(item: MusicItem, size: number): Mesh {
  const roll = stream(seedOf(item.id))
  const parts = partsOf(item.colors, roll)
  const layout = LAYOUTS[Math.floor(roll() * LAYOUTS.length)]
  // The layout is the whole picture. Nothing is added over the top of it, so no
  // two covers share a lit corner or a shaded one, and every layer in it is a
  // plain color over a plain color. Blending was tried and every mode that
  // reaches white or black takes the palette with it.
  const layers = layout(parts, roll)
  return {
    backgroundColor: parts.ground,
    backgroundImage: layers.map(one => one.image).join(', '),
    backgroundBlendMode: layers.map(one => one.blend).join(', '),
    // Blurring mixes colors, and a mix of two colors lands between them, so the
    // picture loses a little of itself on the way through. Putting it back
    // afterwards is what keeps a blurred mesh as saturated as what it was built
    // from.
    filter: `blur(${(size * (1 + OVER * 2) * BLUR).toFixed(1)}px) saturate(1.3)`
  }
}

// Film grain, drawn once by the browser itself. It is the difference between a
// gradient and a print of one.
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")"
