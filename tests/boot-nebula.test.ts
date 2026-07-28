import { describe, expect, it } from 'vitest'
import { fbm, makeNebula } from '../src/renderer/src/components/boot/nebula'

const WIDTH = 160
const HEIGHT = 100

function alphaAt(cloud: ReturnType<typeof makeNebula>, x: number, y: number): number {
  return cloud.pixels[(y * cloud.width + x) * 4 + 3]
}

// The cloud is cut into tiles and each one is read on its own, because the one
// thing a nebula must not be is a bright blob in the middle of a dark window.
function tiles(cloud: ReturnType<typeof makeNebula>, across: number): number[] {
  const out: number[] = []
  const w = Math.floor(cloud.width / across)
  const h = Math.floor(cloud.height / across)
  for (let ty = 0; ty < across; ty += 1) {
    for (let tx = 0; tx < across; tx += 1) {
      let sum = 0
      for (let y = ty * h; y < (ty + 1) * h; y += 1) {
        for (let x = tx * w; x < (tx + 1) * w; x += 1) sum += alphaAt(cloud, x, y)
      }
      out.push(sum / (w * h))
    }
  }
  return out
}

describe('the cloud the boot flies through', () => {
  it('is the same cloud for the same seed and a different one otherwise', () => {
    const a = makeNebula(WIDTH, HEIGHT, 9)
    const b = makeNebula(WIDTH, HEIGHT, 9)
    const c = makeNebula(WIDTH, HEIGHT, 10)
    expect(Array.from(a.pixels)).toEqual(Array.from(b.pixels))
    expect(Array.from(a.pixels)).not.toEqual(Array.from(c.pixels))
  })

  it('fills every pixel it was asked for', () => {
    const cloud = makeNebula(WIDTH, HEIGHT, 4)
    expect(cloud.pixels).toHaveLength(WIDTH * HEIGHT * 4)
    expect(cloud.width).toBe(WIDTH)
    expect(cloud.height).toBe(HEIGHT)
  })

  it('reaches the whole frame rather than sitting in the middle of it', () => {
    const cloud = makeNebula(WIDTH, HEIGHT, 21)
    const parts = tiles(cloud, 4)
    for (const part of parts) expect(part).toBeGreaterThan(6)
    const brightest = Math.max(...parts)
    const faintest = Math.min(...parts)
    expect(faintest).toBeGreaterThan(brightest * 0.12)
  })

  it('has structure in it, not one flat wash', () => {
    const cloud = makeNebula(WIDTH, HEIGHT, 33)
    const parts = tiles(cloud, 8)
    const mean = parts.reduce((sum, part) => sum + part, 0) / parts.length
    const spread = Math.sqrt(parts.reduce((sum, part) => sum + (part - mean) ** 2, 0) / parts.length)
    expect(spread / mean).toBeGreaterThan(0.15)
  })

  it('is brightest somewhere and dark somewhere, over its own pixels', () => {
    const cloud = makeNebula(WIDTH, HEIGHT, 5)
    let low = 255
    let high = 0
    for (let i = 3; i < cloud.pixels.length; i += 4) {
      low = Math.min(low, cloud.pixels[i])
      high = Math.max(high, cloud.pixels[i])
    }
    expect(low).toBeLessThan(40)
    expect(high).toBeGreaterThan(150)
  })

  it('folds noise into a field that stays inside itself', () => {
    for (let i = 0; i < 300; i += 1) {
      const value = fbm(i * 0.37, i * 0.11, 3, 5)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
