import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DARK_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON, LIGHT_ICON } from '../src/main/icon-png'
import {
  MARK_CUT,
  MARK_DISCS,
  MARK_HEIGHT,
  MARK_RADIUS,
  MARK_WIDTH
} from '../src/renderer/src/components/crew-mark'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = (name: string) => readFileSync(path.join(root, 'resources', name), 'utf8')

const SHIPPING = ['icon.svg', 'icon-light.svg']
const BLUEPRINT = ['icon-dev.svg', 'icon-dev-light.svg']

const stack = (source: string) =>
  [...source.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" mask="url\(#cut-(\d)\)"/g)]
    .map(match => ({
      x: Number(match[1]),
      y: Number(match[2]),
      r: Number(match[3]),
      depth: Number(match[4])
    }))
    .sort((a, b) => a.x - b.x)

const cuts = (source: string, depth: number) => {
  const mask = source.match(new RegExp(`<mask id="cut-${depth}"[^]*?</mask>`))?.[0] ?? ''
  return [...mask.matchAll(/<circle cx="(\d+)" cy="\d+" r="(\d+)" fill="#000000"/g)].map(match => ({
    x: Number(match[1]),
    r: Number(match[2])
  }))
}

const filled = (source: string, base64: string) => ({ source, base64 })

function png(base64: string) {
  const buffer = Buffer.from(base64, 'base64')
  return {
    signature: buffer.subarray(0, 8).toString('hex'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

describe('app icon', () => {
  it('stacks three discs of exactly the same size on one line', () => {
    for (const name of [...SHIPPING, ...BLUEPRINT]) {
      const discs = stack(svg(name))

      expect(discs).toHaveLength(3)
      expect(new Set(discs.map(disc => disc.r)).size).toBe(1)
      expect(new Set(discs.map(disc => disc.y)).size).toBe(1)
      expect(discs[1].x - discs[0].x).toBe(discs[2].x - discs[1].x)
      expect(discs[1].x - discs[0].x).toBeLessThan(2 * discs[0].r)
    }
  })

  it('sits centred on the tile', () => {
    const discs = stack(svg('icon.svg'))
    const centre = 100 + 824 / 2

    expect(discs[0].x - discs[0].r).toBe(2 * centre - (discs[2].x + discs[2].r))
    expect(discs[1].x).toBe(centre)
    expect(discs[1].y).toBe(centre)
  })

  it('cuts each disc only by the discs in front of it, so no gap reopens', () => {
    for (const name of [...SHIPPING, ...BLUEPRINT]) {
      const source = svg(name)
      const discs = stack(source)
      const [front, middle, back] = [discs[0], discs[1], discs[2]]

      expect(front.depth).toBe(2)
      expect(middle.depth).toBe(1)
      expect(back.depth).toBe(0)
      expect(cuts(source, 2)).toEqual([])
      expect(cuts(source, 1).map(cut => cut.x)).toEqual([front.x])
      expect(cuts(source, 0).map(cut => cut.x)).toEqual([middle.x, front.x])
      for (const cut of cuts(source, 0)) expect(cut.r).toBeGreaterThan(front.r)
    }
  })

  it('gives every tile the glass gradient, sheen and rim', () => {
    for (const name of [...SHIPPING, ...BLUEPRINT]) {
      const source = svg(name)
      for (const id of ['tile', 'sheen', 'rim']) {
        expect(source).toContain(`<linearGradient id="${id}"`)
        expect(source).toContain(`url(#${id})`)
      }
      expect(source).toMatch(/stroke="url\(#rim\)" stroke-width="\d+"/)
    }
  })

  it('fills the discs on the shipping icon and draws them on the blueprint', () => {
    for (const name of SHIPPING) {
      expect(svg(name)).toMatch(/<g fill="#[0-9a-f]{6}">/)
      expect(svg(name)).not.toContain('<line ')
    }
    for (const name of BLUEPRINT) {
      expect(svg(name)).toMatch(/<g fill="none" stroke="#[0-9a-f]{6}" stroke-width="\d+">/)
    }
  })

  it('inverts for light mode without moving anything', () => {
    for (const [dark, light] of [SHIPPING, BLUEPRINT]) {
      expect(stack(svg(light))).toEqual(stack(svg(dark)))
      expect(cuts(svg(light), 0)).toEqual(cuts(svg(dark), 0))
    }
    expect(svg('icon.svg')).toContain('<g fill="#ffffff">')
    expect(svg('icon-light.svg')).toContain('<g fill="#0d0d0d">')
    expect(svg('icon.svg')).toContain('stop-color="#08080a"')
    expect(svg('icon-light.svg')).toContain('stop-color="#ffffff" stop-opacity="1"')
  })

  it('ships every theme as a square image the dock can use', () => {
    const images = [DARK_ICON, LIGHT_ICON, DEV_DARK_ICON, DEV_LIGHT_ICON]

    for (const encoded of images) {
      const image = png(encoded)
      expect(image.signature).toBe('89504e470d0a1a0a')
      expect(image.width).toBe(512)
      expect(image.height).toBe(512)
    }
    expect(new Set(images).size).toBe(images.length)
  })
})

describe('dev blueprint', () => {
  it('draws the discs on blueprint paper, ruled and dimensioned', () => {
    for (const name of BLUEPRINT) {
      const source = svg(name)
      const lines = [...source.matchAll(/<line /g)]

      expect(source).toContain('clip-path="url(#tile-clip)"')
      expect(source).toContain('stroke-dasharray=')
      expect(lines.length).toBe(13 * 2 + 4)
    }
  })

  it('is blue, where the shipping icon is black and white', () => {
    for (const name of SHIPPING) {
      expect(svg(name)).toMatch(/stop-color="#(0d0d0d|000000|ffffff|[0-9a-f])/)
      expect(svg(name)).not.toMatch(/#0f4c8a|#17427a/)
    }
    expect(svg('icon-dev.svg')).toContain('#17427a')
    expect(svg('icon-dev-light.svg')).toContain('#0f4c8a')
  })
})

describe('crew mark', () => {
  const marks = (source: string, fill: string) =>
    [...source.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="([^"]+)"/g)]
      .filter(match => match[4] === fill)
      .map(match => ({ x: Number(match[1]), y: Number(match[2]), r: Number(match[3]) }))
      .sort((a, b) => a.x - b.x)

  it('crops the same three discs tight, with no tile', () => {
    const logo = svg('crew-logo.svg')
    const discs = marks(logo, '#ffffff')

    expect(logo).not.toContain('<rect x="100"')
    expect(discs).toHaveLength(3)
    expect(new Set(discs.map(disc => disc.r)).size).toBe(1)
    expect(discs[0].x - discs[0].r).toBe(0)
    expect(discs[2].x + discs[2].r).toBe(MARK_WIDTH)
    expect(discs[1].y).toBe(MARK_HEIGHT / 2)
  })

  it('takes its colour from whatever renders it', () => {
    expect(svg('crew-logo.svg')).toContain('fill="currentColor"')
  })

  it('shares one set of numbers with the renderer', () => {
    const discs = marks(svg('crew-logo.svg'), '#ffffff')
    const gaps = marks(svg('crew-logo.svg'), '#000000')

    expect([...MARK_DISCS].sort((a, b) => a - b)).toEqual(discs.map(disc => disc.x))
    expect(MARK_RADIUS).toBe(discs[0].r)
    expect(MARK_CUT).toBe(gaps[0].r)
    expect(MARK_WIDTH).toBe(2 * (MARK_DISCS[1] - MARK_DISCS[2]) + 2 * MARK_RADIUS)
    expect(MARK_HEIGHT).toBe(2 * MARK_RADIUS)
  })

  it('matches the disc spacing the app icon uses', () => {
    const icon = stack(svg('icon.svg'))
    const logo = marks(svg('crew-logo.svg'), '#ffffff')

    expect(logo[1].x - logo[0].x).toBe(icon[1].x - icon[0].x)
    expect(logo[0].r).toBe(icon[0].r)
  })
})
