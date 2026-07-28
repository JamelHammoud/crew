// The cloud the field is flying through, worked out pixel by pixel rather than
// laid down as a handful of soft circles. Three radial gradients over a dark
// window is a smudge wherever you put them: what makes a nebula read as one is
// filaments, and a filament is what noise folded back on itself gives you.
import { MESH_COLORS } from '../CrewMark'

export type Nebula = { width: number; height: number; pixels: Uint8ClampedArray }

// How far the field drags its own coordinates about before it is read. This is
// the whole difference between cloud and nebula: unwarped, fractal noise is an
// even mottle, and warped it grows strands, eddies and holes.
const WARP = 2.6

const OCTAVES = 5

const WARP_OCTAVES = 4

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const u = smooth(x - xi)
  const v = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq, seed + i * 37) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.07
  }
  return sum / norm
}

// A ridge rather than a hill. Folding the field at its middle turns the broad
// humps fractal noise makes into the thin bright veins a nebula is mostly made
// of, and the power is what pulls the space between them down to nothing.
function ridge(value: number): number {
  return Math.pow(1 - Math.abs(value * 2 - 1), 3.4)
}

function channels(color: string): [number, number, number] {
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16)
  ]
}

const PALETTE = MESH_COLORS.map(channels)

// The cloud is lit by the same colors the mark is, laid cool to warm across the
// frame the way the mesh runs, so the boot and the mark are one picture.
function paletteAt(t: number): [number, number, number] {
  const at = Math.min(Math.max(t, 0), 0.9999) * (PALETTE.length - 1)
  const first = Math.floor(at)
  const mix = at - first
  const a = PALETTE[first]
  const b = PALETTE[Math.min(first + 1, PALETTE.length - 1)]
  return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix, a[2] + (b[2] - a[2]) * mix]
}

// It covers the whole frame. The middle is brighter than the corners, but only
// by a little: a falloff steep enough to leave the edges empty is the same
// blob-in-the-middle the filaments were drawn to get away from.
function reach(u: number, v: number): number {
  const away = Math.hypot(u - 0.5, v - 0.5) / 0.72
  return 0.2 + 0.8 * Math.max(0, 1 - away * away)
}

export function makeNebula(width: number, height: number, seed: number): Nebula {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const scale = 3.1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width
      const v = y / height
      const sx = u * scale
      const sy = (v * scale * height) / width
      const wx = fbm(sx + 4.7, sy + 1.9, seed + 101, WARP_OCTAVES) - 0.5
      const wy = fbm(sx - 2.3, sy + 6.1, seed + 211, WARP_OCTAVES) - 0.5
      const field = fbm(sx + wx * WARP, sy + wy * WARP, seed, OCTAVES)
      const veins = ridge(field)
      const body = Math.pow(field, 2.2)
      const density = (veins * 0.86 + body * 0.14) * reach(u, v)
      const [r, g, b] = paletteAt(u * 0.44 + field * 0.56)
      const at = (y * width + x) * 4
      pixels[at] = r
      pixels[at + 1] = g
      pixels[at + 2] = b
      pixels[at + 3] = Math.round(Math.min(density, 1) * 255)
    }
  }
  return { width, height, pixels }
}
