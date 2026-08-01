import { describe, expect, it } from 'vitest'
import { Box, Mat, Vec } from '../src/renderer/src/canvas/math'
import {
  Circle2d,
  Edge2d,
  Geometry2dFilters,
  Group2d,
  Point2d,
  Polygon2d,
  Polyline2d,
  Rectangle2d,
  Stadium2d,
  type Geometry2d
} from '../src/renderer/src/canvas/geometry'

function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const random = seeded(20260801)
const spread = (scale = 400) => (random() - 0.5) * scale

describe('probe: Vec against known values', () => {
  it('holds the identities every operation is built on', () => {
    for (let run = 0; run < 400; run++) {
      const a = new Vec(spread(), spread())
      const b = new Vec(spread(), spread())
      expect(Vec.Add(a, b)).toMatchObject({ x: a.x + b.x, y: a.y + b.y })
      expect(Vec.Sub(Vec.Add(a, b), b).toFixed(6)).toEqual(a.clone().toFixed(6))
      expect(Vec.Dpr(a, b)).toBeCloseTo(a.x * b.x + a.y * b.y, 6)
      expect(Vec.Cpr(a, b)).toBeCloseTo(a.x * b.y - a.y * b.x, 6)
      expect(Vec.Len(a)).toBeCloseTo(Math.hypot(a.x, a.y), 6)
      expect(Vec.Len2(a)).toBeCloseTo(a.x * a.x + a.y * a.y, 6)
      expect(Vec.Dist(a, b)).toBeCloseTo(Math.hypot(a.x - b.x, a.y - b.y), 6)
      expect(Vec.Dist2(a, b)).toBeCloseTo(Vec.Dist(a, b) ** 2, 4)
      expect(Vec.Neg(Vec.Neg(a))).toMatchObject({ x: a.x, y: a.y })
      if (Vec.Len(a) > 0.001) expect(Vec.Len(Vec.Uni(a))).toBeCloseTo(1, 6)
      expect(Vec.Dpr(a, Vec.Per(a))).toBeCloseTo(0, 6)
      expect(Vec.Lrp(a, b, 0)).toMatchObject({ x: a.x, y: a.y })
      expect(Vec.Lrp(a, b, 1).toFixed(6)).toEqual(b.clone().toFixed(6))
      expect(Vec.Med(a, b).toFixed(6)).toEqual(Vec.Lrp(a, b, 0.5).toFixed(6))
    }
  })

  it('rotates by a whole turn back onto itself', () => {
    for (let run = 0; run < 200; run++) {
      const a = new Vec(spread(), spread())
      const turned = Vec.Rot(a, Math.PI * 2)
      expect(turned.x).toBeCloseTo(a.x, 6)
      expect(turned.y).toBeCloseTo(a.y, 6)
      const quarter = Vec.Rot(a, Math.PI / 2)
      expect(Vec.Len(quarter)).toBeCloseTo(Vec.Len(a), 6)
      expect(Vec.Dpr(a, quarter)).toBeCloseTo(0, 5)
    }
  })

  it('puts the nearest point on a segment inside that segment', () => {
    for (let run = 0; run < 300; run++) {
      const a = new Vec(spread(), spread())
      const b = new Vec(spread(), spread())
      const p = new Vec(spread(), spread())
      const nearest = Vec.NearestPointOnLineSegment(a, b, p, true)
      const along = Vec.Dist(a, nearest) + Vec.Dist(nearest, b)
      expect(along).toBeCloseTo(Vec.Dist(a, b), 4)
      expect(Vec.Dist(p, nearest)).toBeLessThanOrEqual(Vec.Dist(p, a) + 1e-6)
      expect(Vec.Dist(p, nearest)).toBeLessThanOrEqual(Vec.Dist(p, b) + 1e-6)
    }
  })
})

describe('probe: Box against known values', () => {
  it('reads its own edges back', () => {
    const box = new Box(10, 20, 30, 40)
    expect([box.minX, box.minY, box.maxX, box.maxY]).toEqual([10, 20, 40, 60])
    expect(box.center).toMatchObject({ x: 25, y: 40 })
    expect(box.corners.map(c => [c.x, c.y])).toEqual([
      [10, 20],
      [40, 20],
      [40, 60],
      [10, 60]
    ])
  })

  it('contains every point it was built from', () => {
    for (let run = 0; run < 200; run++) {
      const points = Array.from({ length: 2 + Math.floor(random() * 8) }, () => new Vec(spread(), spread()))
      const box = Box.FromPoints(points)
      for (const point of points) {
        expect(box.containsPoint(point, 1e-9)).toBe(true)
      }
      expect(box.w).toBeGreaterThanOrEqual(0)
      expect(box.h).toBeGreaterThanOrEqual(0)
    }
  })

  it('agrees with itself about containment and collision', () => {
    for (let run = 0; run < 300; run++) {
      const a = new Box(spread(), spread(), Math.abs(spread(100)) + 1, Math.abs(spread(100)) + 1)
      const b = new Box(spread(), spread(), Math.abs(spread(100)) + 1, Math.abs(spread(100)) + 1)
      if (a.contains(b)) expect(a.collides(b)).toBe(true)
      expect(a.collides(b)).toBe(b.collides(a))
      expect(a.contains(a)).toBe(true)
      expect(a.collides(a)).toBe(true)
    }
  })
})

describe('probe: Mat against known values', () => {
  it('composes and inverts back to the identity', () => {
    for (let run = 0; run < 200; run++) {
      const m = Mat.Compose(
        Mat.Translate(spread(), spread()),
        Mat.Rotate(random() * Math.PI * 2),
        Mat.Scale(1 + random() * 3, 1 + random() * 3)
      )
      const point = new Vec(spread(), spread())
      const there = Mat.applyToPoint(m, point)
      const back = Mat.applyToPoint(Mat.Inverse(m), there)
      expect(back.x).toBeCloseTo(point.x, 5)
      expect(back.y).toBeCloseTo(point.y, 5)
    }
  })

  it('decomposes what it composed', () => {
    for (let run = 0; run < 200; run++) {
      const x = spread()
      const y = spread()
      const rotation = (random() - 0.5) * Math.PI
      const scale = 0.5 + random() * 3
      const decomposed = Mat.Decompose(
        Mat.Compose(Mat.Translate(x, y), Mat.Rotate(rotation), Mat.Scale(scale, scale))
      )
      expect(decomposed.x).toBeCloseTo(x, 5)
      expect(decomposed.y).toBeCloseTo(y, 5)
      expect(decomposed.scaleX).toBeCloseTo(scale, 5)
      expect(decomposed.rotation).toBeCloseTo(rotation, 5)
    }
  })

  it('leaves a point where it found it under the identity', () => {
    const point = new Vec(3, 7)
    expect(Mat.applyToPoint(Mat.Identity(), point)).toMatchObject({ x: 3, y: 7 })
  })
})

describe('probe: signed distance is negative inside', () => {
  const filled = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })
  const hollow = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: false })
  const circle = new Circle2d({ x: 0, y: 0, radius: 50, isFilled: true })

  it('reads the middle of a filled shape as inside', () => {
    expect(filled.distanceToPoint({ x: 50, y: 30 })).toBeLessThan(0)
    expect(circle.distanceToPoint({ x: 50, y: 50 })).toBeLessThan(0)
  })

  it('reads outside as positive for both filled and hollow', () => {
    for (let run = 0; run < 200; run++) {
      const point = { x: 200 + random() * 100, y: 200 + random() * 100 }
      expect(filled.distanceToPoint(point)).toBeGreaterThan(0)
      expect(hollow.distanceToPoint(point)).toBeGreaterThan(0)
    }
  })

  it('reads the middle of a hollow shape as positive until it is let inside', () => {
    expect(hollow.distanceToPoint({ x: 50, y: 30 })).toBeGreaterThan(0)
    expect(hollow.distanceToPoint({ x: 50, y: 30 }, true)).toBeLessThan(0)
  })

  it('measures the distance to the nearest point of a circle', () => {
    expect(circle.distanceToPoint({ x: 150, y: 50 })).toBeCloseTo(50, 5)
    expect(Math.abs(circle.distanceToPoint({ x: 100, y: 50 }))).toBeCloseTo(0, 5)
  })

  it('agrees with nearestPoint everywhere outside', () => {
    const shapes: Geometry2d[] = [filled, hollow, circle, new Stadium2d({ x: 0, y: 0, width: 90, height: 40 })]
    for (const shape of shapes) {
      for (let run = 0; run < 100; run++) {
        const point = { x: 300 + spread(50), y: 300 + spread(50) }
        expect(shape.distanceToPoint(point)).toBeCloseTo(Vec.Dist(point, shape.nearestPoint(point)), 5)
      }
    }
  })
})

describe('probe: hitTestPoint and its margin', () => {
  const filled = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })
  const hollow = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: false })

  it('hits the middle of a filled shape at no margin', () => {
    expect(filled.hitTestPoint({ x: 50, y: 30 })).toBe(true)
  })

  it('misses the middle of a hollow shape until it is let inside', () => {
    expect(hollow.hitTestPoint({ x: 50, y: 30 })).toBe(false)
    expect(hollow.hitTestPoint({ x: 50, y: 30 }, 0, true)).toBe(true)
  })

  it('takes the margin exactly', () => {
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 4.9)).toBe(false)
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 5)).toBe(true)
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 5.1)).toBe(true)
  })

  it('agrees with the signed distance for every margin', () => {
    for (let run = 0; run < 300; run++) {
      const point = { x: spread(300), y: spread(300) }
      const margin = random() * 40
      for (const shape of [filled, hollow]) {
        expect(shape.hitTestPoint(point, margin)).toBe(shape.distanceToPoint(point) <= margin)
      }
    }
  })
})

describe('probe: hitTestLineSegment', () => {
  const rect = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })

  it('catches a line that crosses it', () => {
    expect(rect.hitTestLineSegment({ x: -50, y: 30 }, { x: 150, y: 30 })).toBe(true)
  })

  it('lets go of a line that stands clear of it', () => {
    expect(rect.hitTestLineSegment({ x: -50, y: 300 }, { x: 150, y: 300 })).toBe(false)
  })

  it('catches a line that only comes within the distance asked about', () => {
    expect(rect.hitTestLineSegment({ x: -50, y: 70 }, { x: 150, y: 70 }, 9)).toBe(false)
    expect(rect.hitTestLineSegment({ x: -50, y: 70 }, { x: 150, y: 70 }, 10)).toBe(true)
  })

  it('reads a line that never moves as a point', () => {
    expect(rect.hitTestLineSegment({ x: 50, y: 30 }, { x: 50, y: 30 })).toBe(true)
    expect(rect.hitTestLineSegment({ x: 500, y: 500 }, { x: 500, y: 500 })).toBe(false)
  })
})

describe('probe: what a geometry says about itself', () => {
  it('measures the area of a rectangle, a circle and a polygon', () => {
    expect(new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true }).area).toBeCloseTo(6000, 3)
    expect(new Circle2d({ x: 0, y: 0, radius: 50, isFilled: true }).area).toBeCloseTo(Math.PI * 2500, -2)
    const triangle = new Polygon2d({
      points: [new Vec(0, 0), new Vec(100, 0), new Vec(0, 60)],
      isFilled: true
    })
    expect(Math.abs(triangle.area)).toBeCloseTo(3000, 3)
  })

  it('measures the length of an edge and a polyline', () => {
    expect(new Edge2d({ start: new Vec(0, 0), end: new Vec(3, 4) }).length).toBeCloseTo(5, 6)
    expect(new Polyline2d({ points: [new Vec(0, 0), new Vec(3, 4), new Vec(3, 8)] }).length).toBeCloseTo(9, 6)
  })

  it('gives an open geometry no area at all', () => {
    expect(new Polyline2d({ points: [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10)] }).area).toBe(0)
  })

  it('bounds every geometry around its own vertices', () => {
    const shapes: Geometry2d[] = [
      new Rectangle2d({ x: 5, y: 7, width: 100, height: 60, isFilled: true }),
      new Circle2d({ x: 0, y: 0, radius: 50, isFilled: false }),
      new Stadium2d({ x: 0, y: 0, width: 90, height: 40 }),
      new Polyline2d({ points: [new Vec(0, 0), new Vec(30, 40), new Vec(-10, 5)] })
    ]
    for (const shape of shapes) {
      const bounds = shape.bounds
      for (const vertex of shape.vertices) {
        expect(bounds.containsPoint(vertex, 1e-6)).toBe(true)
      }
    }
  })

  it('puts a single point nowhere but on itself', () => {
    const point = new Point2d({ point: new Vec(4, 9) })
    expect(point.nearestPoint({ x: 100, y: 100 })).toMatchObject({ x: 4, y: 9 })
    expect(point.bounds.w).toBe(0)
    expect(point.bounds.h).toBe(0)
  })
})

describe('probe: the filter flags', () => {
  const plain = () => new Rectangle2d({ x: 0, y: 0, width: 10, height: 10, isFilled: true })
  const label = () =>
    new Rectangle2d({ x: 20, y: 0, width: 10, height: 10, isFilled: true, isLabel: true })
  const internal = () =>
    new Rectangle2d({ x: 40, y: 0, width: 10, height: 10, isFilled: true, isInternal: true })

  it('answers isExcludedByFilter for each flag', () => {
    expect(plain().isExcludedByFilter(Geometry2dFilters.EXCLUDE_NON_STANDARD)).toBe(false)
    expect(label().isExcludedByFilter(Geometry2dFilters.EXCLUDE_LABELS)).toBe(true)
    expect(label().isExcludedByFilter(Geometry2dFilters.INCLUDE_ALL)).toBe(false)
    expect(internal().isExcludedByFilter(Geometry2dFilters.EXCLUDE_INTERNAL)).toBe(true)
    expect(internal().isExcludedByFilter(Geometry2dFilters.INCLUDE_ALL)).toBe(false)
    expect(label().isExcludedByFilter(undefined)).toBe(false)
    expect(internal().isExcludedByFilter(undefined)).toBe(false)
  })

  it('leaves a label out of a group unless labels are asked for', () => {
    const group = new Group2d({ children: [plain(), label()] })
    expect(group.getVertices(Geometry2dFilters.EXCLUDE_LABELS)).toHaveLength(4)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
  })

  it('leaves an internal geometry out unless internals are asked for', () => {
    const group = new Group2d({ children: [plain(), internal()] })
    expect(group.getVertices(Geometry2dFilters.EXCLUDE_NON_STANDARD)).toHaveLength(4)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
  })

  it('keeps a geometry that says so out of the bounds but not out of the vertices', () => {
    const excluded = new Rectangle2d({
      x: 1000,
      y: 1000,
      width: 10,
      height: 10,
      isFilled: true,
      excludeFromShapeBounds: true
    })
    const group = new Group2d({ children: [plain(), excluded] })
    expect(group.bounds.maxX).toBeLessThan(100)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
    expect(excluded.getBoundsVertices()).toEqual([])
  })

  it('puts a child that says to ignore it to one side', () => {
    const ignored = new Rectangle2d({ x: 60, y: 0, width: 10, height: 10, isFilled: true, ignore: true })
    const group = new Group2d({ children: [plain(), ignored] })
    expect(group.children).toHaveLength(1)
    expect(group.ignoredChildren).toHaveLength(1)
  })
})

describe('probe: Group2d flattening', () => {
  const leaf = (x: number) => new Rectangle2d({ x, y: 0, width: 10, height: 10, isFilled: true })

  it('flattens a group it is handed rather than holding it whole', () => {
    const inner = new Group2d({ children: [leaf(0), leaf(20)] })
    const outer = new Group2d({ children: [inner, leaf(40)] })
    expect(outer.children).toHaveLength(3)
    expect(outer.children.every(child => !(child instanceof Group2d))).toBe(true)
  })

  it('flattens three deep', () => {
    const a = new Group2d({ children: [leaf(0)] })
    const b = new Group2d({ children: [a, leaf(20)] })
    const c = new Group2d({ children: [b, leaf(40)] })
    expect(c.children).toHaveLength(3)
  })

  it('refuses to stand with nothing in it', () => {
    expect(() => new Group2d({ children: [] })).toThrow()
  })

  it('takes its area from the first child alone', () => {
    const group = new Group2d({ children: [leaf(0), leaf(20)] })
    expect(group.area).toBeCloseTo(100, 6)
  })

  it('is as far from a point as its nearest child is', () => {
    const group = new Group2d({ children: [leaf(0), leaf(200)] })
    const point = { x: 205, y: 5 }
    expect(group.distanceToPoint(point)).toBeCloseTo(leaf(200).distanceToPoint(point), 6)
  })

  it('is hit wherever any one of its children is hit', () => {
    const group = new Group2d({ children: [leaf(0), leaf(200)] })
    expect(group.hitTestPoint({ x: 5, y: 5 }, 0, true)).toBe(true)
    expect(group.hitTestPoint({ x: 205, y: 5 }, 0, true)).toBe(true)
    expect(group.hitTestPoint({ x: 105, y: 5 }, 0, true)).toBe(false)
  })

  it('bounds itself around every child that counts', () => {
    const group = new Group2d({ children: [leaf(0), leaf(200)] })
    expect(group.bounds.minX).toBeCloseTo(0, 6)
    expect(group.bounds.maxX).toBeCloseTo(210, 6)
  })
})
