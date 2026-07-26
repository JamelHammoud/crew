import { describe, expect, it } from 'vitest'
import { MUSIC_TUNES, musicItems, paletteFor, type MusicItem } from '../src/shared/music'
import { meshOf } from '../src/renderer/src/components/music/mesh'

const SHELVES = [0, 1, 2, 3, 4, 5].map(i => `shelf-${i}-track`)

const palettes: Array<[string, readonly string[]]> = [
  ...MUSIC_TUNES.map(tune => [tune.name, tune.colors] as [string, readonly string[]]),
  ...SHELVES.map(seed => [seed, paletteFor(seed)] as [string, readonly string[]])
]

const hueOf = (hex: string): number => {
  const value = parseInt(hex.slice(1), 16)
  const [r, g, b] = [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
  const high = Math.max(r, g, b)
  const low = Math.min(r, g, b)
  const range = high - low
  if (range === 0) return 0
  const turn = high === r ? (g - b) / range + (g < b ? 6 : 0) : high === g ? (b - r) / range + 2 : (r - g) / range + 4
  return turn * 60
}

// The smallest slice of the wheel every color in a palette fits inside, which is
// the largest gap between two of them taken off the whole turn.
const arcOf = (colors: readonly string[]): number => {
  const hues = colors.map(hueOf).sort((one, two) => one - two)
  const gaps = hues.map((hue, i) => (i === 0 ? hue + 360 - hues[hues.length - 1] : hue - hues[i - 1]))
  return 360 - Math.max(...gaps)
}

const uploads = SHELVES.map((seed, i) => ({
  id: seed,
  name: `Yours ${i}`,
  file: `${seed}.mp3`,
  seconds: 180,
  by: 'someone',
  ts: 1
}))

const items: MusicItem[] = musicItems(uploads)

// Every `at x% y%` in a mesh, in the coordinates of the layer it is painted on.
const centers = (image: string): Array<[number, number]> =>
  [...image.matchAll(/at ([\d.]+)% ([\d.]+)%/g)].map(one => [Number(one[1]), Number(one[2])])

describe('a cover is mixed from the whole palette', () => {
  it('gives every track five colors to mix from', () => {
    for (const [name, colors] of palettes) expect(colors.length, name).toBe(5)
  })

  it('keeps a palette inside one arc of the wheel, so nothing blurs to mud', () => {
    // Two colors from opposite sides of the wheel average to grey, and a mesh is
    // nothing but the average of its colors wherever two of them meet. Every
    // palette staying on one arc is what keeps a blurred cover chromatic.
    for (const [name, colors] of palettes) expect(arcOf(colors), name).toBeLessThanOrEqual(120)
  })

  it('paints every color of the track somewhere in its cover', () => {
    for (const item of items) {
      const mesh = meshOf(item, 104)
      for (const color of item.colors) {
        const value = parseInt(color.slice(1), 16)
        const rgb = `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
        expect(mesh.backgroundImage, `${item.name} is missing ${color}`).toContain(rgb)
      }
    }
  })
})

describe('a cover is the same picture wherever it is drawn', () => {
  it('draws one track the same way twice', () => {
    for (const item of items) expect(meshOf(item, 104)).toEqual(meshOf(item, 104))
  })

  it('draws no two tracks the same way', () => {
    const seen = new Set(items.map(item => meshOf(item, 104).backgroundImage))
    expect(seen.size).toBe(items.length)
  })
})

describe('a cover fills the tile it is given', () => {
  it('keeps every light inside the picture', () => {
    // The mesh is painted on a layer half again as big as the tile, so the tile
    // is only the middle two thirds of it. A light placed by the edge of that
    // layer lands outside the tile altogether, and what is left on screen is the
    // one wash in the middle.
    for (const item of items) {
      for (const [x, y] of centers(meshOf(item, 104).backgroundImage)) {
        expect(x, item.name).toBeGreaterThanOrEqual(16)
        expect(x, item.name).toBeLessThanOrEqual(84)
        expect(y, item.name).toBeGreaterThanOrEqual(16)
        expect(y, item.name).toBeLessThanOrEqual(84)
      }
    }
  })

  it('blurs by a share of the tile rather than a fixed number of pixels', () => {
    // Held at one radius, the blur that softens the big cover averages the small
    // one away to a single flat color.
    const big = Number(/blur\(([\d.]+)px\)/.exec(meshOf(items[0], 104).filter)?.[1])
    const small = Number(/blur\(([\d.]+)px\)/.exec(meshOf(items[0], 40).filter)?.[1])
    expect(small).toBeCloseTo(big * (40 / 104), 1)
    expect(small).toBeLessThan(40 / 4)
  })

  it('lays every color on plainly, so nothing blends toward white or black', () => {
    // Screen reaches white and multiply reaches black, and either one takes the
    // palette with it: that is what made these read as pale washes.
    for (const item of items) {
      for (const blend of meshOf(item, 104).backgroundBlendMode.split(', ')) {
        expect(blend, item.name).toBe('normal')
      }
    }
  })
})
