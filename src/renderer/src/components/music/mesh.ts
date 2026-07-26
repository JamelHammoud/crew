import type { MusicItem } from '../../../../shared/music'

// A cover is a mesh gradient mixed from the track's own colors: a handful of
// soft lights of different sizes, laid over each other and blended rather than
// stacked, then blurred until the seams are gone and grained so it reads as a
// printed thing instead of a CSS one.

const seedOf = (id: string): number => {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return hash >>> 0
}

// One number after another from the id, so a cover is always the same cover and
// no two tracks are laid out alike.
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

const rgba = (hex: string, alpha: number): string => {
  const value = parseInt(hex.slice(1), 16)
  return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${alpha.toFixed(2)})`
}

// Lights land away from the middle of the tile more often than on it, which is
// what keeps a cover from being one blob with a halo.
const place = (roll: number): number => 6 + roll * 88

// The top layers are screened and softened so where two colors meet is a third
// color rather than an edge. The ones underneath are laid down plainly, since
// there is nothing behind them to mix with.
const BLENDS = ['screen', 'soft-light', 'screen', 'overlay', 'normal', 'normal', 'normal', 'normal']

export interface Mesh {
  backgroundColor: string
  backgroundImage: string
  backgroundBlendMode: string
}

export function meshOf(item: MusicItem): Mesh {
  const roll = stream(seedOf(item.id))
  const colors = item.colors
  const count = 6 + Math.floor(roll() * 3)
  const lights: string[] = []
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length]
    const wide = 38 + roll() * 62
    const tall = 38 + roll() * 62
    const stop = 52 + roll() * 26
    // The ones drawn last sit underneath, so they are the wide quiet washes and
    // the ones on top are smaller and brighter.
    const alpha = 0.45 + (1 - i / count) * 0.5
    lights.push(
      `radial-gradient(${wide.toFixed(0)}% ${tall.toFixed(0)}% at ${place(roll()).toFixed(0)}% ${place(roll()).toFixed(0)}%, ${rgba(color, alpha)} 0%, ${rgba(color, 0)} ${stop.toFixed(0)}%)`
    )
  }
  // A light coming from somewhere, and a corner it does not reach. Without the
  // pair the mesh is evenly lit all over and reads flat however many colors are
  // in it.
  lights.push(
    `radial-gradient(70% 60% at ${place(roll()).toFixed(0)}% 8%, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0) 60%)`,
    `radial-gradient(90% 80% at 88% 96%, rgb(0 0 0 / 0.35) 0%, rgb(0 0 0 / 0) 70%)`
  )
  return {
    backgroundColor: colors[colors.length - 1] ?? '#000',
    backgroundImage: lights.join(', '),
    backgroundBlendMode: lights.map((_, i) => BLENDS[i % BLENDS.length]).join(', ')
  }
}

// Film grain, drawn once by the browser itself. It is the difference between a
// gradient and a print of one.
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E\")"
