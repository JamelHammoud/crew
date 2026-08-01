import { describe, expect, it } from 'vitest'
import {
  Arc2d,
  Circle2d,
  CubicBezier2d,
  CubicSpline2d,
  Edge2d,
  Ellipse2d,
  Geometry2d,
  Geometry2dFilters,
  Group2d,
  Point2d,
  Polygon2d,
  Polyline2d,
  Rectangle2d,
  Stadium2d
} from '../src/renderer/src/canvas/geometry'
import { Box, PI, Vec } from '../src/renderer/src/canvas/math'

function makeOne(): Record<string, Geometry2d> {
  return {
    'a filled rectangle': new Rectangle2d({ width: 100, height: 50, isFilled: true }),
    'a hollow rectangle': new Rectangle2d({ width: 100, height: 50, isFilled: false }),
    'a rectangle standing away from the origin': new Rectangle2d({
      x: -40,
      y: 25,
      width: 30,
      height: 80,
      isFilled: true
    }),
    'a filled circle': new Circle2d({ radius: 40, isFilled: true }),
    'a hollow circle': new Circle2d({ x: 12, y: -6, radius: 25, isFilled: false }),
    'a filled ellipse': new Ellipse2d({ width: 120, height: 60, isFilled: true }),
    'a hollow ellipse': new Ellipse2d({ width: 40, height: 90, isFilled: false }),
    'a wide stadium': new Stadium2d({ width: 120, height: 40, isFilled: true }),
    'a tall stadium': new Stadium2d({ width: 40, height: 120, isFilled: false }),
    'a filled polygon': new Polygon2d({
      points: [new Vec(0, 0), new Vec(80, 10), new Vec(60, 70), new Vec(-10, 50)],
      isFilled: true
    }),
    'a polygon with a notch': new Polygon2d({
      points: [new Vec(0, 0), new Vec(100, 0), new Vec(100, 100), new Vec(50, 40), new Vec(0, 100)],
      isFilled: true
    }),
    'an open polyline': new Polyline2d({ points: [new Vec(0, 0), new Vec(40, 60), new Vec(90, 10), new Vec(120, 80)] }),
    'an edge': new Edge2d({ start: new Vec(-20, -10), end: new Vec(60, 45) }),
    'a point': new Point2d({ point: new Vec(15, -25), margin: 0 }),
    'an arc': new Arc2d({
      center: new Vec(0, 0),
      start: new Vec(50, 0),
      end: new Vec(0, 50),
      sweepFlag: 1,
      largeArcFlag: 0
    }),
    'a cubic bezier': new CubicBezier2d({
      start: new Vec(0, 0),
      cp1: new Vec(30, 80),
      cp2: new Vec(90, -40),
      end: new Vec(120, 30)
    }),
    'a cubic spline': new CubicSpline2d({
      points: [new Vec(0, 0), new Vec(40, 50), new Vec(90, -10), new Vec(140, 40)]
    }),
    'a group': new Group2d({
      children: [
        new Rectangle2d({ width: 60, height: 40, isFilled: true }),
        new Circle2d({ x: 80, y: 10, radius: 20, isFilled: true })
      ]
    })
  }
}

const named = Object.entries(makeOne())

function probePoints(bounds: Box): Vec[] {
  const points: Vec[] = []
  const pad = Math.max(20, bounds.w * 0.4, bounds.h * 0.4)
  const steps = 9
  for (let ix = 0; ix <= steps; ix++) {
    for (let iy = 0; iy <= steps; iy++) {
      points.push(
        new Vec(
          bounds.minX - pad + ((bounds.w + pad * 2) * ix) / steps,
          bounds.minY - pad + ((bounds.h + pad * 2) * iy) / steps
        )
      )
    }
  }
  return points
}

describe('the box every geometry reports', () => {
  it.each(named)('is a real Box for %s', (_name, geometry) => {
    expect(geometry.bounds).toBeInstanceOf(Box)
    expect(geometry.getBounds()).toBeInstanceOf(Box)
    expect(typeof geometry.bounds.containsPoint).toBe('function')
  })

  it.each(named)('answers containsPoint on its own middle for %s', (_name, geometry) => {
    expect(geometry.bounds.containsPoint(geometry.bounds.center)).toBe(true)
    expect(geometry.bounds.containsPoint(new Vec(geometry.bounds.maxX + 1000, geometry.bounds.maxY + 1000))).toBe(false)
  })

  it.each(named)('holds every one of its own vertices for %s', (_name, geometry) => {
    const { bounds } = geometry
    for (const vertex of geometry.vertices) {
      expect(bounds.containsPoint(vertex, 1e-6)).toBe(true)
    }
  })

  it.each(named)('is the same Box every time it is asked for %s', (_name, geometry) => {
    expect(geometry.bounds).toBe(geometry.bounds)
  })

  it('is a real Box even when a geometry keeps itself out of the bounds', () => {
    const hidden = new Rectangle2d({ width: 10, height: 10, isFilled: true, excludeFromShapeBounds: true })
    expect(hidden.bounds).toBeInstanceOf(Box)
    expect(hidden.boundsVertices).toEqual([])
    expect(() => hidden.bounds.containsPoint(new Vec(0, 0))).not.toThrow()
  })
})

describe('the signed distance every geometry measures', () => {
  it.each(named)('is the way to its own nearest point for %s', (_name, geometry) => {
    for (const point of probePoints(geometry.bounds)) {
      const nearest = geometry.nearestPoint(point)
      expect(Math.abs(geometry.distanceToPoint(point))).toBeCloseTo(Vec.Dist(point, nearest), 6)
    }
  })

  it.each(named)('lands its nearest point on itself for %s', (_name, geometry) => {
    for (const point of probePoints(geometry.bounds)) {
      const nearest = geometry.nearestPoint(point)
      expect(Math.abs(geometry.distanceToPoint(nearest))).toBeLessThan(1e-6)
    }
  })

  it.each(named)('never goes negative on something open or hollow for %s', (_name, geometry) => {
    if (geometry.isClosed && geometry.isFilled) return
    if (geometry instanceof Group2d) return
    for (const point of probePoints(geometry.bounds)) {
      expect(geometry.distanceToPoint(point, false)).toBeGreaterThanOrEqual(0)
    }
  })

  it('lets a group report the inside of a filled child even though the group holds no fill of its own', () => {
    const body = new Rectangle2d({ width: 100, height: 60, isFilled: true })
    const group = new Group2d({ children: [body] })
    expect(group.isFilled).toBe(false)
    expect(group.distanceToPoint(new Vec(50, 30), false)).toBeLessThan(0)
  })

  it.each(named)('agrees with its own hit test for %s', (_name, geometry) => {
    for (const margin of [0, 1, 8]) {
      for (const hitInside of [false, true]) {
        for (const point of probePoints(geometry.bounds)) {
          const distance = geometry.distanceToPoint(point, hitInside)
          expect(geometry.hitTestPoint(point, margin, hitInside)).toBe(distance <= margin)
        }
      }
    }
  })
})

describe('a closed and filled geometry', () => {
  const filled = named.filter(([, geometry]) => geometry.isClosed && geometry.isFilled)
  const solid = filled.filter(([name, geometry]) => name !== 'a polygon with a notch' && !(geometry instanceof Point2d))

  it.each(solid)('reads its own middle as inside for %s', (_name, geometry) => {
    expect(geometry.distanceToPoint(geometry.bounds.center)).toBeLessThan(0)
    expect(geometry.hitTestPoint(geometry.bounds.center, 0, false)).toBe(true)
  })

  it.each(filled)('reads a point far outside as outside for %s', (_name, geometry) => {
    const far = new Vec(geometry.bounds.maxX + 500, geometry.bounds.maxY + 500)
    expect(geometry.distanceToPoint(far)).toBeGreaterThan(0)
    expect(geometry.hitTestPoint(far, 0, true)).toBe(false)
  })

  it('reads the middle of a notch as outside the shape it is cut into', () => {
    const notched = new Polygon2d({
      points: [new Vec(0, 0), new Vec(100, 0), new Vec(100, 100), new Vec(50, 40), new Vec(0, 100)],
      isFilled: true
    })
    expect(notched.bounds.center.y).toBe(50)
    expect(notched.distanceToPoint(notched.bounds.center)).toBeGreaterThan(0)
    expect(notched.distanceToPoint(new Vec(50, 10))).toBeLessThan(0)
  })

  it('holds no inside at all when it is one point', () => {
    const point = new Point2d({ point: new Vec(15, -25), margin: 0 })
    expect(point.isFilled).toBe(true)
    expect(Math.abs(point.distanceToPoint(new Vec(15, -25)))).toBe(0)
    expect(point.distanceToPoint(new Vec(15, -20))).toBeCloseTo(5, 10)
  })
})

describe('a hollow geometry', () => {
  it('is missed in the middle until the hit is allowed inside', () => {
    const hollow = new Circle2d({ radius: 60, isFilled: false })
    const middle = hollow.bounds.center
    expect(hollow.hitTestPoint(middle, 0, false)).toBe(false)
    expect(hollow.hitTestPoint(middle, 0, true)).toBe(true)
    expect(hollow.distanceToPoint(middle, false)).toBeCloseTo(60, 6)
    expect(hollow.distanceToPoint(middle, true)).toBeCloseTo(-60, 6)
  })

  it('is hit on its own edge either way', () => {
    const hollow = new Rectangle2d({ width: 80, height: 40, isFilled: false })
    expect(hollow.hitTestPoint(new Vec(0, 20), 0, false)).toBe(true)
    expect(hollow.hitTestPoint(new Vec(80, 20), 0, false)).toBe(true)
  })
})

describe('the way a geometry meets a line', () => {
  it.each(named)('agrees with its own crossing test for %s', (_name, geometry) => {
    if (geometry instanceof Point2d) return
    const { bounds } = geometry
    const probes: [Vec, Vec][] = [
      [new Vec(bounds.minX - 30, bounds.center.y), new Vec(bounds.maxX + 30, bounds.center.y)],
      [new Vec(bounds.center.x, bounds.minY - 30), new Vec(bounds.center.x, bounds.maxY + 30)],
      [new Vec(bounds.minX - 30, bounds.minY - 30), new Vec(bounds.maxX + 30, bounds.maxY + 30)],
      [new Vec(bounds.maxX + 200, bounds.maxY + 200), new Vec(bounds.maxX + 400, bounds.maxY + 400)]
    ]
    for (const [a, b] of probes) {
      for (const distance of [0, 5]) {
        expect(geometry.hitTestLineSegment(a, b, distance)).toBe(geometry.distanceToLineSegment(a, b) <= distance)
      }
    }
  })

  it('reads a line that never leaves one place as a point', () => {
    const rectangle = new Rectangle2d({ width: 40, height: 40, isFilled: true })
    const point = new Vec(20, 20)
    expect(rectangle.distanceToLineSegment(point, point)).toBe(rectangle.distanceToPoint(point, false))
  })

  it('catches a line by a single point only inside the margin it is asked about', () => {
    const point = new Point2d({ point: new Vec(0, 0), margin: 0 })
    const a = new Vec(-100, 5)
    const b = new Vec(100, 5)
    expect(point.hitTestLineSegment(a, b, 10)).toBe(true)
    expect(point.hitTestLineSegment(a, b, 4)).toBe(false)
    expect(point.hitTestLineSegment(a, b, 0)).toBe(false)
  })
})

describe('what a geometry says about itself', () => {
  it.each(named)('measures a length that adds up for %s', (_name, geometry) => {
    expect(geometry.length).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(geometry.length)).toBe(true)
  })

  it.each(named)('holds no area when it is open for %s', (_name, geometry) => {
    if (geometry.isClosed) return
    expect(geometry.area).toBe(0)
  })

  it('measures a rectangle, a circle and a stadium against their own formulas', () => {
    expect(Math.abs(new Rectangle2d({ width: 100, height: 50, isFilled: true }).area)).toBeCloseTo(5000, 6)
    expect(new Edge2d({ start: new Vec(0, 0), end: new Vec(3, 4) }).length).toBeCloseTo(5, 10)
    expect(new Stadium2d({ width: 120, height: 40, isFilled: true }).length).toBeCloseTo((PI * 20 + 80) * 2, 6)
    expect(new Arc2d({
      center: new Vec(0, 0),
      start: new Vec(50, 0),
      end: new Vec(0, 50),
      sweepFlag: 1,
      largeArcFlag: 0
    }).length).toBeCloseTo((PI / 2) * 50, 6)
  })
})

describe('a group of geometries', () => {
  const label = new Rectangle2d({ x: 5, y: 5, width: 10, height: 10, isFilled: true, isLabel: true })
  const body = new Rectangle2d({ width: 100, height: 60, isFilled: true })
  const group = new Group2d({ children: [body, label] })

  it('takes its area from the first child alone', () => {
    expect(group.area).toBe(body.area)
  })

  it('flattens a group it is handed rather than holding it whole', () => {
    const outer = new Group2d({ children: [new Group2d({ children: [body, label] })] })
    expect(outer.children).toHaveLength(2)
    expect(outer.children.every(child => !(child instanceof Group2d))).toBe(true)
  })

  it('puts a child that says to ignore it to one side', () => {
    const ignored = new Rectangle2d({ width: 5, height: 5, isFilled: true, ignore: true })
    const withIgnored = new Group2d({ children: [body, ignored] })
    expect(withIgnored.children).toHaveLength(1)
    expect(withIgnored.ignoredChildren).toEqual([ignored])
  })

  it('leaves a label out of its vertices unless it is asked for one', () => {
    expect(group.getVertices(Geometry2dFilters.EXCLUDE_LABELS)).toHaveLength(4)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
  })

  it('keeps a child out of its bounds when that child says so', () => {
    const hidden = new Rectangle2d({ x: 500, y: 500, width: 10, height: 10, isFilled: true, excludeFromShapeBounds: true })
    const withHidden = new Group2d({ children: [body, hidden] })
    expect(withHidden.bounds).toBeInstanceOf(Box)
    expect(withHidden.bounds.maxX).toBe(100)
    expect(withHidden.bounds.maxY).toBe(60)
  })

  it('is as far from a point as its nearest child is', () => {
    const point = new Vec(-30, -30)
    const nearest = Math.min(body.distanceToPoint(point, false), label.distanceToPoint(point, false))
    expect(group.distanceToPoint(point, false, Geometry2dFilters.INCLUDE_ALL)).toBeCloseTo(nearest, 10)
  })

  it('refuses to stand with nothing in it', () => {
    expect(() => new Group2d({ children: [] })).toThrow()
  })
})

describe('whether a geometry overlaps a polygon', () => {
  const square = (x: number, y: number, size: number) => [
    new Vec(x, y),
    new Vec(x + size, y),
    new Vec(x + size, y + size),
    new Vec(x, y + size)
  ]

  const filled = new Rectangle2d({ width: 100, height: 100, isFilled: true })

  it('catches a polygon that swallows it whole', () => {
    expect(filled.overlapsPolygon(square(-50, -50, 300))).toBe(true)
  })

  it('catches a polygon it swallows whole', () => {
    expect(filled.overlapsPolygon(square(40, 40, 20))).toBe(true)
  })

  it('catches a polygon that only cuts a corner off it', () => {
    expect(filled.overlapsPolygon(square(90, 90, 40))).toBe(true)
  })

  it('lets go of a polygon that stands clear of it', () => {
    expect(filled.overlapsPolygon(square(400, 400, 30))).toBe(false)
  })

  it('reads a hollow shape by its outline rather than by its middle', () => {
    const hollow = new Rectangle2d({ width: 100, height: 100, isFilled: false })
    expect(hollow.overlapsPolygon(square(30, 30, 40))).toBe(false)
    expect(hollow.overlapsPolygon(square(90, 30, 40))).toBe(true)
  })

  it('reads an open run by the line it draws', () => {
    const line = new Polyline2d({ points: [new Vec(0, 0), new Vec(200, 200)] })
    expect(line.overlapsPolygon(square(90, 90, 20))).toBe(true)
    expect(line.overlapsPolygon(square(300, 0, 20))).toBe(false)
  })

  it('never catches a label with nothing written in it', () => {
    const empty = new Rectangle2d({ width: 100, height: 100, isFilled: true, isLabel: true, isEmptyLabel: true })
    expect(empty.isEmptyLabel).toBe(true)
    expect(empty.overlapsPolygon(square(-50, -50, 300))).toBe(false)
  })

  it('catches a group wherever any one of its children is caught', () => {
    const group = new Group2d({
      children: [
        new Rectangle2d({ width: 20, height: 20, isFilled: true }),
        new Rectangle2d({ x: 500, y: 500, width: 20, height: 20, isFilled: true })
      ]
    })
    expect(group.overlapsPolygon(square(505, 505, 5))).toBe(true)
    expect(group.overlapsPolygon(square(5, 5, 5))).toBe(true)
    expect(group.overlapsPolygon(square(200, 200, 5))).toBe(false)
  })
})

describe('the filters a geometry is read through', () => {
  it('leaves a label out unless labels are asked for', () => {
    const label = new Rectangle2d({ width: 10, height: 10, isFilled: true, isLabel: true })
    expect(label.isExcludedByFilter(Geometry2dFilters.EXCLUDE_LABELS)).toBe(true)
    expect(label.isExcludedByFilter(Geometry2dFilters.INCLUDE_ALL)).toBe(false)
    expect(label.isExcludedByFilter(Geometry2dFilters.EXCLUDE_NON_STANDARD)).toBe(true)
    expect(label.isExcludedByFilter(undefined)).toBe(false)
  })

  it('leaves an internal geometry out unless internals are asked for', () => {
    const internal = new Rectangle2d({ width: 10, height: 10, isFilled: true, isInternal: true })
    expect(internal.isExcludedByFilter(Geometry2dFilters.EXCLUDE_INTERNAL)).toBe(true)
    expect(internal.isExcludedByFilter(Geometry2dFilters.EXCLUDE_LABELS)).toBe(false)
    expect(internal.isExcludedByFilter(Geometry2dFilters.INCLUDE_ALL)).toBe(false)
  })
})

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const roll = seededRandom(20260801)
const scatter = (scale = 400): number => (roll() - 0.5) * scale

describe('the sign a distance carries', () => {
  const filled = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })
  const hollow = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: false })
  const circle = new Circle2d({ x: 0, y: 0, radius: 50, isFilled: true })

  it('goes negative inside a filled shape', () => {
    expect(filled.distanceToPoint({ x: 50, y: 30 })).toBeLessThan(0)
    expect(circle.distanceToPoint({ x: 50, y: 50 })).toBeLessThan(0)
  })

  it('stays positive outside, filled or hollow', () => {
    for (let run = 0; run < 200; run++) {
      const point = { x: 200 + roll() * 100, y: 200 + roll() * 100 }
      expect(filled.distanceToPoint(point)).toBeGreaterThan(0)
      expect(hollow.distanceToPoint(point)).toBeGreaterThan(0)
    }
  })

  it('reads the middle of a hollow shape as outside until it is let in', () => {
    expect(hollow.distanceToPoint({ x: 50, y: 30 })).toBeGreaterThan(0)
    expect(hollow.distanceToPoint({ x: 50, y: 30 }, true)).toBeLessThan(0)
  })

  it('measures to the nearest point of a circle', () => {
    expect(circle.distanceToPoint({ x: 150, y: 50 })).toBeCloseTo(50, 5)
    expect(Math.abs(circle.distanceToPoint({ x: 100, y: 50 }))).toBeCloseTo(0, 5)
  })

  it('agrees with the nearest point everywhere outside', () => {
    const shapes = [filled, hollow, circle, new Stadium2d({ width: 90, height: 40, isFilled: false })]
    for (const shape of shapes) {
      for (let run = 0; run < 100; run++) {
        const point = { x: 300 + scatter(50), y: 300 + scatter(50) }
        expect(shape.distanceToPoint(point)).toBeCloseTo(Vec.Dist(point, shape.nearestPoint(point)), 5)
      }
    }
  })
})

describe('the margin a hit is allowed', () => {
  const filled = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true })
  const hollow = new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: false })

  it('takes it exactly', () => {
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 4.9)).toBe(false)
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 5)).toBe(true)
    expect(hollow.hitTestPoint({ x: -5, y: 30 }, 5.1)).toBe(true)
  })

  it('says the same thing as the signed distance at every margin', () => {
    for (let run = 0; run < 300; run++) {
      const point = { x: scatter(300), y: scatter(300) }
      const margin = roll() * 40
      for (const shape of [filled, hollow]) {
        expect(shape.hitTestPoint(point, margin)).toBe(shape.distanceToPoint(point) <= margin)
      }
    }
  })

  it('reads a line that never moves by the edges alone', () => {
    expect(filled.hitTestLineSegment({ x: 50, y: 30 }, { x: 50, y: 30 })).toBe(false)
    expect(filled.hitTestLineSegment({ x: 0, y: 30 }, { x: 0, y: 30 })).toBe(true)
    expect(filled.hitTestLineSegment({ x: 500, y: 500 }, { x: 500, y: 500 })).toBe(false)
  })

  it('catches a line only once it comes within the distance asked about', () => {
    expect(filled.hitTestLineSegment({ x: -50, y: 70 }, { x: 150, y: 70 }, 9)).toBe(false)
    expect(filled.hitTestLineSegment({ x: -50, y: 70 }, { x: 150, y: 70 }, 10)).toBe(true)
  })
})

describe('what each geometry measures of itself', () => {
  it('measures a rectangle and a triangle against their own formulas', () => {
    expect(new Rectangle2d({ x: 0, y: 0, width: 100, height: 60, isFilled: true }).area).toBeCloseTo(6000, 3)
    const triangle = new Polygon2d({ points: [new Vec(0, 0), new Vec(100, 0), new Vec(0, 60)], isFilled: true })
    expect(Math.abs(triangle.area)).toBeCloseTo(3000, 3)
  })

  it('measures a circle by the ring of points it is drawn with', () => {
    const area = new Circle2d({ x: 0, y: 0, radius: 50, isFilled: true }).area
    expect(area).toBeLessThan(PI * 2500)
    expect(area).toBeGreaterThan(PI * 2500 * 0.95)
  })

  it('measures the length of an edge and a run of points', () => {
    expect(new Edge2d({ start: new Vec(0, 0), end: new Vec(3, 4) }).length).toBeCloseTo(5, 6)
    expect(new Polyline2d({ points: [new Vec(0, 0), new Vec(3, 4), new Vec(3, 8)] }).length).toBeCloseTo(9, 6)
  })

  it('gives an open run no area at all', () => {
    expect(new Polyline2d({ points: [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10)] }).area).toBe(0)
  })

  it('holds every one of its own vertices inside its own box', () => {
    const shapes = [
      new Rectangle2d({ x: 5, y: 7, width: 100, height: 60, isFilled: true }),
      new Circle2d({ x: 0, y: 0, radius: 50, isFilled: false }),
      new Stadium2d({ width: 90, height: 40, isFilled: false }),
      new Polyline2d({ points: [new Vec(0, 0), new Vec(30, 40), new Vec(-10, 5)] })
    ]
    for (const shape of shapes) {
      for (const vertex of shape.vertices) expect(shape.bounds.containsPoint(vertex, 1e-6)).toBe(true)
    }
  })

  it('puts a single point nowhere but on itself', () => {
    const point = new Point2d({ point: new Vec(4, 9), margin: 0 })
    expect(point.nearestPoint()).toMatchObject({ x: 4, y: 9 })
    expect(point.bounds.w).toBe(0)
    expect(point.bounds.h).toBe(0)
  })
})

describe('each flag a geometry can be read through', () => {
  const plain = (): Rectangle2d => new Rectangle2d({ x: 0, y: 0, width: 10, height: 10, isFilled: true })
  const label = (): Rectangle2d =>
    new Rectangle2d({ x: 20, y: 0, width: 10, height: 10, isFilled: true, isLabel: true })
  const internal = (): Rectangle2d =>
    new Rectangle2d({ x: 40, y: 0, width: 10, height: 10, isFilled: true, isInternal: true })

  it('answers for a label, an internal and a plain one', () => {
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

  it('leaves an internal one out unless internals are asked for', () => {
    const group = new Group2d({ children: [plain(), internal()] })
    expect(group.getVertices(Geometry2dFilters.EXCLUDE_NON_STANDARD)).toHaveLength(4)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
  })

  it('keeps one that says so out of the box but not out of the vertices', () => {
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

  it('puts one that says to ignore it to one side', () => {
    const ignored = new Rectangle2d({ x: 60, y: 0, width: 10, height: 10, isFilled: true, ignore: true })
    const group = new Group2d({ children: [plain(), ignored] })
    expect(group.children).toHaveLength(1)
    expect(group.ignoredChildren).toHaveLength(1)
  })
})

describe('how far down a group flattens', () => {
  const leaf = (x: number): Rectangle2d => new Rectangle2d({ x, y: 0, width: 10, height: 10, isFilled: true })

  it('holds no group of its own', () => {
    const inner = new Group2d({ children: [leaf(0), leaf(20)] })
    const outer = new Group2d({ children: [inner, leaf(40)] })
    expect(outer.children).toHaveLength(3)
    expect(outer.children.every(child => !(child instanceof Group2d))).toBe(true)
  })

  it('flattens three deep', () => {
    const first = new Group2d({ children: [leaf(0)] })
    const second = new Group2d({ children: [first, leaf(20)] })
    const third = new Group2d({ children: [second, leaf(40)] })
    expect(third.children).toHaveLength(3)
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

  it('boxes itself around every child that counts', () => {
    const group = new Group2d({ children: [leaf(0), leaf(200)] })
    expect(group.bounds.minX).toBeCloseTo(0, 6)
    expect(group.bounds.maxX).toBeCloseTo(210, 6)
  })
})
