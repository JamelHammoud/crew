import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DARK_ICON, LIGHT_ICON } from '../src/main/icon-png'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = (name: string) => readFileSync(path.join(root, 'resources', name), 'utf8')
const discs = (source: string) =>
  [...source.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/g)].map(match => ({
    x: Number(match[1]),
    y: Number(match[2]),
    r: Number(match[3])
  }))

function png(base64: string) {
  const buffer = Buffer.from(base64, 'base64')
  return {
    signature: buffer.subarray(0, 8).toString('hex'),
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bytes: buffer
  }
}

describe('app icon', () => {
  it('stacks three of the same disc on one line', () => {
    const stack = discs(svg('icon.svg')).sort((a, b) => a.x - b.x)

    expect(stack).toHaveLength(3)
    expect(new Set(stack.map(disc => disc.r)).size).toBe(1)
    expect(new Set(stack.map(disc => disc.y)).size).toBe(1)
    expect(stack[1].x - stack[0].x).toBe(stack[2].x - stack[1].x)
    expect(stack[1].x - stack[0].x).toBeLessThan(2 * stack[0].r)
  })

  it('cuts each disc out of the one behind it', () => {
    const rings = [...svg('icon.svg').matchAll(/stroke="([^"]+)" stroke-width="(\d+)"/g)]

    expect(rings).toHaveLength(2)
    for (const [, colour, width] of rings) {
      expect(colour).toBe('#0d0d0d')
      expect(Number(width)).toBeGreaterThan(0)
    }
  })

  it('inverts for light mode without moving anything', () => {
    const dark = svg('icon.svg')
    const light = svg('icon-light.svg')

    expect(discs(light)).toEqual(discs(dark))
    expect(dark).toContain('<rect x="100" y="100" width="824" height="824" rx="185" fill="#0d0d0d"')
    expect(dark).toContain('<g fill="#ffffff">')
    expect(light).toContain('<rect x="100" y="100" width="824" height="824" rx="185" fill="#ffffff"')
    expect(light).toContain('<g fill="#0d0d0d">')
    expect(light).not.toContain('stroke="#0d0d0d"')
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
