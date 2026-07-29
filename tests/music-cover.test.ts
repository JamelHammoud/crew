import { describe, expect, it } from 'vitest'
import { MUSIC_TUNES, musicItems, paletteFor, type MusicItem } from '../src/shared/music'
import { coverArt, COVER_CASTS, MAX_PETALS, type CoverPetal } from '../src/renderer/src/components/art/coverSeed'
import { meshOf } from '../src/renderer/src/components/art/mesh'

const SHELVES = [0, 1, 2, 3, 4, 5].map(i => `shelf-${i}-track`)

const palettes: Array<[string, readonly string[]]> = [
  ...MUSIC_TUNES.map(tune => [tune.name, tune.colors] as [string, readonly string[]]),
  ...SHELVES.map(seed => [seed, paletteFor(seed)] as [string, readonly string[]])
]

const rgbOf = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

const lumaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const chromaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex)
  return Math.max(r, g, b) - Math.min(r, g, b)
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

describe('a palette is a thing photographed in good light', () => {
  it('gives every track five colors', () => {
    for (const [name, colors] of palettes) expect(colors.length, name).toBe(5)
  })

  it('has nothing dark in it anywhere', () => {
    // The one that matters. A near black in a palette lands as a bruise in the
    // corner of every tile that palette is used for, and since every palette
    // used to carry one, every cover had the same bruise in it and they all
    // read as the same picture in different colors.
    for (const [name, colors] of palettes) {
      for (const color of colors) {
        expect(lumaOf(color), `${name} has ${color}`).toBeGreaterThan(0.3)
        const [r, g, b] = rgbOf(color)
        expect(Math.max(r, g, b), `${name} has ${color}`).toBeGreaterThan(0.6)
      }
    }
  })

  it('has nothing washed out in it either', () => {
    // The same mistake at the other end, and it was in every palette here. The
    // first three colors are the things in the frame, and a thing has a color:
    // pale enough and there is none left in it, so it stops being the light on a
    // petal and becomes a hole cut in the picture, brighter than everything
    // around it and made of nothing. One track had a plain white for its middle
    // color and every other one had a near white, which is why a cover's pale
    // shape read as belonging to a different picture.
    //
    // The fourth is the light and is meant to be near white, and the sky is
    // whatever it is, so neither is asked to hold a color of its own here.
    for (const [name, colors] of palettes) {
      for (const color of colors.slice(0, 3)) {
        expect(lumaOf(color), `${name} has ${color}, which is nearly white`).toBeLessThan(0.87)
        expect(chromaOf(color), `${name} has ${color}, which has no color left`).toBeGreaterThan(0.24)
      }
    }
  })

  it('gives the sky a color rather than a grey', () => {
    // The sky is most of the frame, so it carries the picture. Drained of
    // color it takes the whole cover down with it however bright the petals are.
    for (const [name, colors] of palettes) expect(chromaOf(colors[4]), name).toBeGreaterThan(0.15)
  })

  it('stands something against the sky that is not the sky', () => {
    // A green leaf on a blue sky is what makes one of these read as a
    // photograph. All five colors from one arc of the wheel is a tint of a
    // picture: there is nothing in the frame, only weather.
    for (const [name, colors] of palettes) {
      const sky = hueOf(colors[4])
      const petals = colors.slice(0, 3).filter(one => chromaOf(one) > 0.05)
      const far = Math.max(...petals.map(one => apart(hueOf(one), sky)))
      expect(far, name).toBeGreaterThan(45)
    }
  })
})

describe('a cover is the same picture wherever it is drawn', () => {
  it('works out one track the same way twice', () => {
    for (const item of items) expect(coverArt(item)).toEqual(coverArt(item))
  })

  it('gives no two tracks the same picture', () => {
    const seen = new Set(items.map(item => JSON.stringify(coverArt(item))))
    expect(seen.size).toBe(items.length)
  })

  it('reaches every kind of picture it can draw', () => {
    // Six casts that nothing ever picks are six casts nobody has looked at.
    const ids = Array.from({ length: 400 }, (_, i) => `probe-${i}`)
    const casts = new Set(ids.map(id => coverArt({ ...items[0], id }).cast))
    expect([...casts].sort()).toEqual([...COVER_CASTS].sort())
  })
})

describe('a cover has depth in it', () => {
  const drawn = Array.from({ length: 400 }, (_, i) => coverArt({ ...items[0], id: `probe-${i}` }))

  it('never asks for more petals than the shader runs', () => {
    // The shader counts the same number of petals every time, because a
    // graphics card cannot be handed a shorter loop. One more than it counts is
    // a petal that is simply not in the picture.
    for (const art of drawn) {
      expect(art.petals.length).toBeGreaterThan(0)
      expect(art.petals.length).toBeLessThanOrEqual(MAX_PETALS)
    }
  })

  it('puts something near the lens and something far from it', () => {
    // Rolled rather than spread, half the covers come out with everything at
    // one distance, and a picture with one distance in it is a flat one.
    for (const art of drawn) {
      if (art.petals.length < 2) continue
      const blurs = art.petals.map(petal => petal.blur)
      expect(Math.max(...blurs) / Math.min(...blurs)).toBeGreaterThan(2)
    }
  })

  it('lays them down back to front', () => {
    // The blurriest is the furthest away, so it goes down first and everything
    // else covers it. In any other order the near things are behind the fog.
    for (const art of drawn) {
      const blurs = art.petals.map(petal => petal.blur)
      expect(blurs).toEqual([...blurs].sort((one, two) => two - one))
    }
  })

  it('brings every petal to a point somewhere inside the frame', () => {
    // Run far enough that both tapers happen off the edge, and what is left in
    // the tile is a band of one width crossing it corner to corner: the one
    // shape that says at a glance that a picture was made rather than taken. One
    // tip is enough, and it has to be, since a leaf that runs out of the frame
    // at one end is what a photograph taken this close looks like.
    //
    // The bend is the half of it that is easy to miss. A tip is not where the
    // spine points: the spine is carried sideways the whole way out, so a petal
    // with plenty of bend leaves the picture long before its own length says it
    // should, and capping the length alone lets those straight back in.
    const tipOf = (petal: CoverPetal, run: number): [number, number] => {
      const across = [-petal.lie[1], petal.lie[0]]
      return [
        petal.at[0] + petal.lie[0] * run - across[0] * petal.bend * run * run,
        petal.at[1] + petal.lie[1] * run - across[1] * petal.bend * run * run
      ]
    }
    const seen = (spot: [number, number]): boolean => spot.every(one => one > 0 && one < 1)
    let bent = 0
    for (const art of drawn) {
      for (const petal of art.petals) {
        if (Math.abs(petal.bend) > 1) bent++
        expect(
          seen(tipOf(petal, petal.along)) || seen(tipOf(petal, -petal.along)),
          `${art.cast} left a petal crossing the frame with neither tip in it`
        ).toBe(true)
      }
    }
    expect(bent, 'nothing drawn was bent enough to carry its own tip off the frame').toBeGreaterThan(0)
  })

  it('keeps the odd color out of the front of the picture', () => {
    // A color picked to stand against the sky, handed the nearest slot, is the
    // hardest edge in the frame wearing the most unlike color, and it reads as
    // pasted on however good the rest of it is. The furthest thing is the one
    // that carries it.
    //
    // One gold against a blue sky and two blues beside it, so which color is
    // the odd one is not a matter of degree. Read off the real palettes this
    // says nothing: several of them stand every petal against the sky on
    // purpose, the way a pink flower does against a blue one, and there the
    // nearest petal has nowhere unlike to be.
    // The nearest petal is the one the air is not in front of, so its color is
    // its own color and the source it was handed can be read straight back off
    // it. Comparing hues instead says nothing the moment two petals are handed
    // the same color, which is exactly the case this is here to catch.
    const petalColors = ['#ffc23d', '#6fe9ff', '#a8d4ff']
    const sky = '#2f9dfa'
    const linear = (one: number): number => (one <= 0.04045 ? one / 12.92 : Math.pow((one + 0.055) / 1.055, 2.4))
    const toLinear = (hex: string): [number, number, number] => {
      const [r, g, b] = rgbOf(hex)
      return [linear(r), linear(g), linear(b)]
    }
    const nearestSource = (color: [number, number, number]): string => {
      const gaps = petalColors.map(one => {
        const [r, g, b] = toLinear(one)
        return Math.hypot(color[0] - r, color[1] - g, color[2] - b)
      })
      return petalColors[gaps.indexOf(Math.min(...gaps))]
    }
    const least = [...petalColors].sort((one, two) => apart(hueOf(one), hueOf(sky)) - apart(hueOf(two), hueOf(sky)))[0]
    // Every cast, and the ones holding more petals than the palette holds
    // colors are the point: cycled, those come back round to the odd one out
    // and hand it to the sharpest petal in the frame.
    let wide = 0
    for (let i = 0; i < 200; i++) {
      const art = coverArt({ ...items[0], id: `odd-${i}`, colors: [...petalColors, '#f4fdff', sky] })
      if (art.petals.length < 2) continue
      if (art.petals.length > petalColors.length) wide++
      const front = art.petals[art.petals.length - 1]
      expect(nearestSource(front.color), `${art.cast} with ${art.petals.length} put its odd color in front`).toBe(least)
    }
    expect(wide, 'nothing drawn held more petals than colors').toBeGreaterThan(0)
  })

  it('puts the air in front of the things that are far off', () => {
    // A thing further off is seen through more of whatever the sky is made of,
    // so it takes the sky's color as it goes back. Without it the far shapes
    // carry their color at full strength and sit on the picture rather than in
    // it. Handed one color three times, the difference is the air alone.
    const one = { ...items[0], id: 'air-probe', colors: ['#ff7a3c', '#ff7a3c', '#ff7a3c', '#fff5e6', '#2f9dfa'] }
    const art = coverArt(one)
    expect(art.petals.length).toBeGreaterThan(1)
    const toSky = (color: [number, number, number]): number =>
      Math.hypot(color[0] - art.sky[0], color[1] - art.sky[1], color[2] - art.sky[2])
    expect(toSky(art.petals[0].color)).toBeLessThan(toSky(art.petals[art.petals.length - 1].color))
  })

  it('hands the shader nothing it cannot use', () => {
    // Everything below is multiplied by something else in the shader, so one
    // number that is not a number takes the whole cover with it and the tile
    // comes out empty.
    for (const art of drawn) {
      const numbers = [
        art.bloom,
        art.haze,
        ...art.sky,
        ...art.skyTo,
        ...art.light,
        ...art.sun,
        ...art.skyLie,
        ...art.petals.flatMap(petal => [
          ...petal.color,
          ...petal.at,
          ...petal.lie,
          petal.bend,
          petal.half,
          petal.along,
          petal.taper,
          petal.ruffle,
          petal.fine,
          petal.lobe,
          petal.phase,
          petal.blur,
          petal.rim,
          petal.shine,
          petal.halo
        ])
      ]
      for (const one of numbers) expect(Number.isFinite(one)).toBe(true)
      // A petal blurred by nothing asks the card to fade an edge from a point to
      // the same point, which has no answer.
      for (const petal of art.petals) expect(petal.blur).toBeGreaterThan(0)
      for (const channel of art.petals.flatMap(petal => petal.color)) {
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('a machine with no graphics context still gets a cover', () => {
  it('paints both ends of the palette and something of its own', () => {
    // A layout that takes fewer lobes than the palette has takes both ends and
    // some of the middle, rather than the first few: mixed from the middle
    // alone a cover is the flat wash this whole thing started as. So the sky
    // and the light are the two that always have to be there, and a petal on
    // top of them is what stops it being a two color ramp.
    const paints = (image: string, color: string): boolean => {
      const value = parseInt(color.slice(1), 16)
      return image.includes(`rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`)
    }
    for (const item of items) {
      const mesh = meshOf(item, 104)
      expect(paints(mesh.backgroundImage, item.colors[4]), `${item.name} has no sky`).toBe(true)
      expect(paints(mesh.backgroundImage, item.colors[3]), `${item.name} has no light`).toBe(true)
      const petals = item.colors.slice(0, 3).filter(color => paints(mesh.backgroundImage, color))
      expect(petals.length, `${item.name} has no petal`).toBeGreaterThan(0)
    }
  })

  it('draws one track the same way twice, and no two tracks alike', () => {
    for (const item of items) expect(meshOf(item, 104)).toEqual(meshOf(item, 104))
    expect(new Set(items.map(item => meshOf(item, 104).backgroundImage)).size).toBe(items.length)
  })

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
