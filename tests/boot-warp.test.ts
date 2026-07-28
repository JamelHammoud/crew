import { describe, expect, it } from 'vitest'
import {
  DEPTH,
  DRIFT,
  HOLD,
  LIGHT,
  NEAR,
  SETTLE,
  brightness,
  makeStars,
  project,
  stepStars,
  viewOf,
  warpSpeed
} from '../src/renderer/src/components/boot/warp'

// A field that has to look the same on every machine is stepped by hand here,
// so nothing about it is left to whatever a frame happened to take.
function steady(seed: number): () => number {
  let at = seed
  return () => {
    at = (at * 1664525 + 1013904223) % 4294967296
    return at / 4294967296
  }
}

describe('the field the app opens on', () => {
  it('opens at lightspeed and settles into a drift', () => {
    expect(warpSpeed(0)).toBe(LIGHT)
    expect(warpSpeed(HOLD)).toBe(LIGHT)
    expect(warpSpeed(HOLD + SETTLE)).toBeCloseTo(DRIFT, 6)
    expect(warpSpeed(HOLD + SETTLE + 10)).toBeCloseTo(DRIFT, 6)
  })

  it('only ever slows down', () => {
    let last = Infinity
    for (let t = 0; t < 3; t += 0.02) {
      const speed = warpSpeed(t)
      expect(speed).toBeLessThanOrEqual(last + 1e-9)
      last = speed
    }
  })

  it('stands every star in front of the viewer and inside the field', () => {
    const stars = makeStars(500, steady(7))
    expect(stars).toHaveLength(500)
    for (const star of stars) {
      expect(star.z).toBeGreaterThan(0)
      expect(star.z).toBeLessThanOrEqual(DEPTH)
      expect(Math.hypot(star.x, star.y)).toBeLessThanOrEqual(1.000001)
    }
  })

  it('brings a star that has gone past back at the far plane', () => {
    const stars = makeStars(200, steady(3))
    for (let frame = 0; frame < 400; frame += 1) stepStars(stars, LIGHT, 1 / 60, steady(frame + 1))
    expect(stars).toHaveLength(200)
    for (const star of stars) expect(star.z).toBeGreaterThan(0)
  })

  it('never runs out however long the window is left open', () => {
    const stars = makeStars(120, steady(11))
    for (let frame = 0; frame < 5000; frame += 1) stepStars(stars, LIGHT, 1 / 60, steady(frame))
    expect(stars.every(star => star.z > NEAR - 1e-9 || star.z > 0)).toBe(true)
    expect(stars).toHaveLength(120)
  })

  it('sweeps a star outward as it comes at you', () => {
    const view = viewOf(1200, 800)
    const far = project(0.5, 0, DEPTH, view)
    const near = project(0.5, 0, 0.2, view)
    expect(near.x - view.width / 2).toBeGreaterThan(far.x - view.width / 2)
  })

  it('puts the vanishing point in the middle of whatever it is given', () => {
    const view = viewOf(900, 640)
    const middle = project(0, 0, 0.4, view)
    expect(middle).toEqual({ x: 450, y: 320 })
  })

  it('brings a star out of the dark rather than switching it on', () => {
    expect(brightness(DEPTH)).toBeCloseTo(0, 6)
    expect(brightness(DEPTH * 0.5)).toBeGreaterThan(brightness(DEPTH * 0.95))
    expect(brightness(NEAR)).toBeGreaterThan(brightness(DEPTH * 0.5))
    expect(brightness(NEAR)).toBeLessThanOrEqual(1)
  })
})
