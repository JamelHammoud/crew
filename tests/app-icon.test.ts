import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DARK_ICON, LIGHT_ICON } from '../src/main/icon-png'
import {
  MARK_CUT,
  MARK_DISCS,
  MARK_HEIGHT,
  MARK_RADIUS,
  MARK_WIDTH
} from '../src/renderer/src/components/crew-mark'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = (name: string) => readFileSync(path.join(root, 'resources', name), 'utf8')
const circles = (source: string, fill: string) =>
  [...source.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="([^"]+)"/g)]
    .filter(match => match[4] === fill)
    .map(match => ({ x: Number(match[1]), y: Number(match[2]), r: Number(match[3]) }))
    .sort((a, b) => a.x - b.x)

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
    const stack = circles(svg('icon.svg'), '#ffffff')

    expect(stack).toHaveLength(3)
    expect(new Set(stack.map(disc => disc.r)).size).toBe(1)
    expect(new Set(stack.map(disc => disc.y)).size).toBe(1)
    expect(stack[1].x - stack[0].x).toBe(stack[2].x - stack[1].x)
    expect(stack[1].x - stack[0].x).toBeLessThan(2 * stack[0].r)
  })

  it('sits centred on the tile', () => {
    const stack = circles(svg('icon.svg'), '#ffffff')
    const centre = 100 + 824 / 2

    expect(stack[0].x - stack[0].r).toBe(2 * centre - (stack[2].x + stack[2].r))
    expect(stack[1].x).toBe(centre)
    expect(stack[1].y).toBe(centre)
  })

  it('cuts a gap out of the disc behind, without shrinking any disc', () => {
    const stack = circles(svg('icon.svg'), '#ffffff')
    const cuts = circles(svg('icon.svg'), '#000000')

    expect(cuts).toHaveLength(2)
    expect(cuts.map(cut => cut.x)).toEqual([stack[0].x, stack[1].x])
    for (const cut of cuts) expect(cut.r).toBeGreaterThan(stack[0].r)
    expect(svg('icon.svg')).not.toContain('stroke-width="42"')
  })

  it('gives the tile the glass gradient, sheen and rim', () => {
    for (const name of ['icon.svg', 'icon-light.svg']) {
      const source = svg(name)
      for (const id of ['tile', 'sheen', 'rim']) {
        expect(source).toContain(`<linearGradient id="${id}"`)
        expect(source).toContain(`url(#${id})`)
      }
      expect(source).toMatch(/stroke="url\(#rim\)" stroke-width="\d+"/)
    }
  })

  it('inverts for light mode without moving anything', () => {
    const dark = svg('icon.svg')
    const light = svg('icon-light.svg')

    expect(circles(light, '#ffffff')).toEqual(circles(dark, '#ffffff'))
    expect(circles(light, '#000000')).toEqual(circles(dark, '#000000'))
    expect(dark).toContain('fill="#ffffff" mask="url(#stack)"')
    expect(light).toContain('fill="#0d0d0d" mask="url(#stack)"')
    expect(dark).toContain('stop-color="#08080a"')
    expect(light).toContain('stop-color="#ffffff" stop-opacity="1"')
  })

  it('ships both themes as square images the dock can use', () => {
    for (const encoded of [DARK_ICON, LIGHT_ICON]) {
      const image = png(encoded)
      expect(image.signature).toBe('89504e470d0a1a0a')
      expect(image.width).toBe(512)
      expect(image.height).toBe(512)
    }
    expect(DARK_ICON).not.toEqual(LIGHT_ICON)
  })
})

describe('crew mark', () => {
  it('crops the same three discs tight, with no tile', () => {
    const logo = svg('crew-logo.svg')
    const stack = circles(logo, '#ffffff')

    expect(logo).not.toContain('<rect x="100"')
    expect(stack).toHaveLength(3)
    expect(new Set(stack.map(disc => disc.r)).size).toBe(1)
    expect(stack[0].x - stack[0].r).toBe(0)
    expect(stack[2].x + stack[2].r).toBe(MARK_WIDTH)
    expect(stack[1].y).toBe(MARK_HEIGHT / 2)
  })

  it('takes its colour from whatever renders it', () => {
    expect(svg('crew-logo.svg')).toContain('fill="currentColor"')
  })

  it('shares one set of numbers with the renderer', () => {
    const stack = circles(svg('crew-logo.svg'), '#ffffff')
    const cuts = circles(svg('crew-logo.svg'), '#000000')

    expect([...MARK_DISCS].sort((a, b) => a - b)).toEqual(stack.map(disc => disc.x))
    expect(MARK_RADIUS).toBe(stack[0].r)
    expect(MARK_CUT).toBe(cuts[0].r)
    expect(MARK_WIDTH).toBe(2 * (MARK_DISCS[1] - MARK_DISCS[2]) + 2 * MARK_RADIUS)
    expect(MARK_HEIGHT).toBe(2 * MARK_RADIUS)
  })
})
