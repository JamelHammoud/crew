import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTLStore, getSnapshot, loadSnapshot } from '../src/renderer/src/canvas/schema'
import { decodePoints, encodePoints, DIM_2D, DIM_3D } from '../src/renderer/src/canvas/schema/points'

const root = join(homedir(), 'Library', 'Application Support', 'Crew', 'projects')

function boardPaths(): string[] {
  if (!existsSync(root)) return []
  const found: string[] = []
  for (const project of readdirSync(root)) {
    const designs = join(root, project, '.crew', 'designs')
    if (!existsSync(designs)) continue
    for (const name of readdirSync(designs)) {
      if (name.endsWith('.json')) found.push(join(designs, name))
    }
  }
  return found
}

const paths = boardPaths()

describe('probe: real boards on disk', () => {
  it('found some to read', () => {
    console.log('boards found:', paths.length, paths.map(p => p.split('/').pop()).join(', '))
    expect(paths.length).toBeGreaterThan(0)
  })

  for (const path of paths) {
    const name = path.split('/').pop()!

    it(`${name}: every record parses`, () => {
      const file = JSON.parse(readFileSync(path, 'utf8'))
      const store = createTLStore()
      expect(() => loadSnapshot(store, file.document)).not.toThrow()
      const records = store.records()
      expect(records.length).toBeGreaterThan(0)
      for (const record of records) {
        expect(record.id).toBeTruthy()
        expect(record.typeName).toBeTruthy()
      }
    })

    it(`${name}: round trips byte identical`, () => {
      const file = JSON.parse(readFileSync(path, 'utf8'))
      const store = createTLStore()
      loadSnapshot(store, file.document)
      const once = getSnapshot(store).document

      const again = createTLStore()
      loadSnapshot(again, once)
      const twice = getSnapshot(again).document

      expect(JSON.stringify(twice)).toBe(JSON.stringify(once))
    })

    it(`${name}: keeps every record the file held`, () => {
      const file = JSON.parse(readFileSync(path, 'utf8'))
      const store = createTLStore()
      loadSnapshot(store, file.document)
      const out = getSnapshot(store).document.store
      const inIds = Object.keys(file.document.store)
      const outIds = Object.keys(out)
      expect(outIds.sort()).toEqual(inIds.sort())
    })

    it(`${name}: draw paths decode and re-encode unchanged`, () => {
      const file = JSON.parse(readFileSync(path, 'utf8'))
      let checked = 0
      for (const record of Object.values(file.document.store) as any[]) {
        if (record?.typeName !== 'shape') continue
        if (record.type !== 'draw' && record.type !== 'highlight') continue
        for (const segment of record.props.segments) {
          const dim = segment.dim ?? DIM_3D
          const points = decodePoints(segment.path, dim)
          expect(points.length).toBeGreaterThan(0)
          for (const point of points) {
            expect(Number.isFinite(point.x)).toBe(true)
            expect(Number.isFinite(point.y)).toBe(true)
          }
          const reencoded = encodePoints(points, dim)
          expect(decodePoints(reencoded, dim)).toEqual(points)
          expect(encodePoints(decodePoints(reencoded, dim), dim)).toBe(reencoded)
          if (reencoded !== segment.path) drifted.push({ name, from: segment.path, to: reencoded })
          checked++
        }
      }
      console.log(`${name}: checked ${checked} draw segments`)
    })
  }
})

describe('probe: point codec shape', () => {
  it('lays a 3d first point out as sixteen base64 characters', () => {
    expect(encodePoints([{ x: 1, y: 2, z: 0.5 }], DIM_3D)).toHaveLength(16)
  })

  it('lays each 3d delta out as eight more', () => {
    const points = [
      { x: 1, y: 2, z: 0.5 },
      { x: 3, y: 4, z: 0.6 }
    ]
    expect(encodePoints(points, DIM_3D)).toHaveLength(24)
    expect(encodePoints([...points, { x: 5, y: 6, z: 0.7 }], DIM_3D)).toHaveLength(32)
  })

  it('lays a 2d first point out as twelve', () => {
    expect(encodePoints([{ x: 1, y: 2 }], DIM_2D)).toHaveLength(12)
  })

  it('round trips a long 2d path', () => {
    const points = Array.from({ length: 200 }, (_, at) => ({ x: at * 1.5, y: Math.sin(at) * 20, z: 0.5 }))
    const encoded = encodePoints(points, DIM_2D)
    const decoded = decodePoints(encoded, DIM_2D)
    expect(decoded).toHaveLength(200)
    expect(encodePoints(decoded, DIM_2D)).toBe(encoded)
  })

  it('round trips a long 3d path', () => {
    const points = Array.from({ length: 200 }, (_, at) => ({ x: at * 1.5, y: Math.cos(at) * 20, z: 0.4 }))
    const encoded = encodePoints(points, DIM_3D)
    const decoded = decodePoints(encoded, DIM_3D)
    expect(decoded).toHaveLength(200)
    expect(encodePoints(decoded, DIM_3D)).toBe(encoded)
  })

  it('keeps the first point at full float32 precision', () => {
    const first = { x: 1234.5678, y: -8765.4321, z: 0.123456 }
    const decoded = decodePoints(encodePoints([first], DIM_3D), DIM_3D)
    expect(decoded[0].x).toBeCloseTo(first.x, 3)
    expect(decoded[0].y).toBeCloseTo(first.y, 3)
  })
})
