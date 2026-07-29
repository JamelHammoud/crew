import { describe, expect, it } from 'vitest'
import { CIRCLE, DIAGONAL, GRID, SQUARE } from '../src/renderer/src/icons/keylines'
import {
  MAX_LOBES,
  MIN_WAIST,
  MIN_LOBES,
  radiusAt,
  shapePath,
  subagentShape,
  type ShapeKind
} from '../src/renderer/src/components/art/subagentShape'

// In the spirit of the cover test: this holds the rules and never the look.
// `yarn covers` is what the look is judged on, because a generator like this
// cannot be judged from its numbers.

const ids = Array.from({ length: 600 }, (_, i) => `role-${i}`)
const shapes = ids.map(subagentShape)

const ring = (id: string, samples = 720): number[] => {
  const shape = subagentShape(id)
  return Array.from({ length: samples }, (_, i) => radiusAt(shape, (i / samples) * Math.PI * 2))
}

describe('a helper mark', () => {
  it('is the same shape twice for one id and a different one for two', () => {
    for (const id of ids.slice(0, 40)) expect(subagentShape(id)).toEqual(subagentShape(id))
    const seen = new Set(shapes.map(shape => JSON.stringify(shape)))
    expect(seen.size).toBeGreaterThan(ids.length * 0.9)
  })

  it('draws every kind there is, and none of them often enough to be the set', () => {
    const counts = new Map<ShapeKind, number>()
    for (const shape of shapes) counts.set(shape.kind, (counts.get(shape.kind) ?? 0) + 1)
    for (const kind of ['rosette', 'disc', 'square', 'hexagon'] as ShapeKind[]) {
      expect(counts.get(kind) ?? 0).toBeGreaterThan(ids.length * 0.05)
    }
    // A page of flowers is a page of flowers, and a page of discs is worse.
    expect(counts.get('rosette')! / ids.length).toBeLessThan(0.85)
  })

  it('holds its lobe count and its twist inside what a mark can carry', () => {
    for (const shape of shapes) {
      if (shape.kind !== 'rosette') {
        expect(shape.lobes).toBe(0)
        expect(shape.depth).toBe(0)
        continue
      }
      expect(shape.lobes).toBeGreaterThanOrEqual(MIN_LOBES)
      expect(shape.lobes).toBeLessThanOrEqual(MAX_LOBES)
      expect(shape.depth).toBeGreaterThan(0)
      expect(shape.twist).toBeGreaterThanOrEqual(0)
      expect(shape.twist).toBeLessThan(Math.PI * 2)
    }
  })

  it('never lets a waist between two lobes close up', () => {
    for (const id of ids) {
      const radii = ring(id)
      const waist = Math.min(...radii) / Math.max(...radii)
      // Below about half the mark reads as scattered dots at 18 across rather
      // than as one shape.
      expect(waist).toBeGreaterThanOrEqual(MIN_WAIST - 0.001)
    }
  })

  it('stands on its own keyline and never past the live area', () => {
    for (const id of ids) {
      const shape = subagentShape(id)
      const furthest = Math.max(...ring(id))
      const line = { rosette: DIAGONAL, disc: CIRCLE, hexagon: CIRCLE, square: SQUARE }[shape.kind]
      expect(furthest).toBeLessThanOrEqual(line / 2 + 0.001)
      expect(furthest).toBeGreaterThan(line / 2 - 0.5)
      expect(furthest * 2).toBeLessThanOrEqual(DIAGONAL)
    }
  })

  it('draws a closed outline that stays inside the box it is asked for', () => {
    for (const box of [18, 24, 48]) {
      for (const id of ids.slice(0, 120)) {
        const path = shapePath(subagentShape(id), box)
        expect(path.startsWith('M ')).toBe(true)
        expect(path.endsWith('Z')).toBe(true)
        const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
        for (const n of numbers) {
          expect(n).toBeGreaterThanOrEqual(-box)
          expect(n).toBeLessThanOrEqual(box)
        }
      }
    }
  })

  it('scales with the box it is drawn on rather than being fixed to the grid', () => {
    const one = shapePath(subagentShape('role-1'), GRID)
    const twice = shapePath(subagentShape('role-1'), GRID * 2)
    expect(one).not.toBe(twice)
    const first = (path: string): number[] => path.slice(2).split(' ').slice(0, 2).map(Number)
    const [x, y] = first(one)
    const [bigX, bigY] = first(twice)
    expect(bigX / x).toBeCloseTo(2, 2)
    expect(bigY / y).toBeCloseTo(2, 2)
  })
})
