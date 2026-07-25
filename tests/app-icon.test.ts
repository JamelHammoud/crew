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
  it('draws a prompt followed by three cursors', () => {
    const marks = paths(svg('icon.svg'))

    expect(marks).toHaveLength(4)
    expect(marks[0]).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/)
    for (const bar of marks.slice(1)) expect(bar).toMatch(/^M[\d.]+ [\d.]+ h[\d.]+$/)
  })

  it('inverts for light mode without moving anything', () => {
    const dark = svg('icon.svg')
    const light = svg('icon-light.svg')

    expect(paths(light)).toEqual(paths(dark))
    expect(dark).toContain('fill="#0d0d0d"')
    expect(dark).toContain('stroke="#ffffff"')
    expect(light).toContain('fill="#ffffff"')
    expect(light).toContain('stroke="#0d0d0d"')
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
