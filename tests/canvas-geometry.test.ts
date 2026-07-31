import { describe, expect, it } from 'vitest'
import {
  Arc2d,
  Circle2d,
  CubicBezier2d,
  CubicSpline2d,
  Edge2d,
  Ellipse2d,
  Geometry2dFilters,
  Group2d,
  intersectCircleCircle,
  intersectCirclePolygon,
  intersectLineSegmentCircle,
  intersectLineSegmentLineSegment,
  intersectLineSegmentPolygon,
  intersectLineSegmentPolyline,
  intersectPolygonBounds,
  intersectPolygonPolygon,
  intersectPolys,
  Point2d,
  Polygon2d,
  Polyline2d,
  polygonsIntersect,
  Rectangle2d,
  Stadium2d
} from '../src/renderer/src/canvas/geometry'
import { Box, HALF_PI, Mat, PI, PI2, Vec } from '../src/renderer/src/canvas/math'

function coords(points: { x: number; y: number }[] | null) {
  if (!points) return null
  return points.map(p => [Math.round(p.x * 1e6) / 1e6, Math.round(p.y * 1e6) / 1e6])
}

function box(b: Box) {
  return [b.x, b.y, b.w, b.h]
}

describe('a rectangle', () => {
  const filled = new Rectangle2d({ width: 100, height: 50, isFilled: true })
  const hollow = new Rectangle2d({ width: 100, height: 50, isFilled: false })

  it('knows its own box without walking its corners', () => {
    expect(box(filled.getBounds())).toEqual([0, 0, 100, 50])
    expect(box(new Rectangle2d({ x: 10, y: 20, width: 5, height: 6, isFilled: true }).bounds)).toEqual([10, 20, 5, 6])
  })

  it('measures its own area and the way round it', () => {
    expect(filled.area).toBe(5000)
    expect(filled.length).toBe(300)
    expect(filled.vertices).toHaveLength(4)
    expect(filled.isClosed).toBe(true)
  })

  it('reads the middle of a filled one as inside and a hollow one as far from the edge', () => {
    expect(filled.distanceToPoint(new Vec(50, 25))).toBe(-25)
    expect(hollow.distanceToPoint(new Vec(50, 25))).toBe(25)
    expect(hollow.distanceToPoint(new Vec(50, 25), true)).toBe(-25)
  })

  it('is hit in the middle only when it is filled or the hit reaches inside', () => {
    expect(filled.hitTestPoint(new Vec(50, 25))).toBe(true)
    expect(hollow.hitTestPoint(new Vec(50, 25))).toBe(false)
    expect(hollow.hitTestPoint(new Vec(50, 25), 0, true)).toBe(true)
    expect(hollow.hitTestPoint(new Vec(50, 25), 30)).toBe(true)
  })

  it('is hit on its own edge whether it is filled or not', () => {
    for (const rect of [filled, hollow]) {
      expect(rect.distanceToPoint(new Vec(0, 25))).toBe(rect.isFilled ? -0 : 0)
      expect(rect.hitTestPoint(new Vec(0, 25))).toBe(true)
      expect(rect.hitTestPoint(new Vec(100, 25))).toBe(true)
      expect(rect.hitTestPoint(new Vec(50, 0))).toBe(true)
    }
  })

  it('is missed from outside until the margin reaches it', () => {
    expect(filled.hitTestPoint(new Vec(-5, 25))).toBe(false)
    expect(filled.hitTestPoint(new Vec(-5, 25), 4)).toBe(false)
    expect(filled.hitTestPoint(new Vec(-5, 25), 5)).toBe(true)
    expect(filled.distanceToPoint(new Vec(-5, 25))).toBe(5)
  })

  it('finds the nearest point on its edge', () => {
    expect(coords([filled.nearestPoint(new Vec(-10, 25))])).toEqual([[0, 25]])
    expect(coords([filled.nearestPoint(new Vec(50, 80))])).toEqual([[50, 50]])
    expect(coords([filled.nearestPoint(new Vec(-10, -10))])).toEqual([[0, 0]])
  })

  it('is crossed by a line that goes through it', () => {
    expect(filled.hitTestLineSegment(new Vec(-10, 25), new Vec(110, 25))).toBe(true)
    expect(filled.hitTestLineSegment(new Vec(-10, -10), new Vec(-5, -5))).toBe(false)
    expect(filled.distanceToLineSegment(new Vec(-10, 25), new Vec(110, 25))).toBe(0)
  })

  it('says where it is in bounds and writes itself out as a path', () => {
    expect(filled.isPointInBounds(new Vec(50, 25))).toBe(true)
    expect(filled.isPointInBounds(new Vec(150, 25))).toBe(false)
    expect(filled.isPointInBounds(new Vec(150, 25), 60)).toBe(true)
    expect(filled.toSimpleSvgPath()).toBe('M0,0L100,0L100,50L0,50Z')
  })
})

describe('a rotated shape', () => {
  it('takes the bounds of where its corners really landed', () => {
    const rect = new Rectangle2d({ width: 100, height: 50, isFilled: true })
    const turned = new Polygon2d({
      isFilled: true,
      points: Mat.applyToPoints(Mat.Rotate(PI / 4, 50, 25), rect.vertices)
    })

    const half = (100 / 2) * Math.cos(PI / 4) + (50 / 2) * Math.sin(PI / 4)
    expect(turned.bounds.width).toBeCloseTo(half * 2, 9)
    expect(turned.bounds.height).toBeCloseTo(half * 2, 9)
    expect(turned.bounds.center.x).toBeCloseTo(50, 9)
    expect(turned.bounds.center.y).toBeCloseTo(25, 9)
  })

  it('keeps its area through the turn', () => {
    const rect = new Rectangle2d({ width: 100, height: 50, isFilled: true })
    const turned = new Polygon2d({
      isFilled: true,
      points: Mat.applyToPoints(Mat.Rotate(0.6, 50, 25), rect.vertices)
    })
    expect(Math.abs(turned.area)).toBeCloseTo(5000, 6)
  })

  it('comes back to the box it started in after a whole turn', () => {
    const rect = new Rectangle2d({ width: 100, height: 50, isFilled: true })
    const turned = new Polygon2d({
      isFilled: true,
      points: Mat.applyToPoints(Mat.Rotate(PI2, 50, 25), rect.vertices)
    })
    expect(turned.bounds.width).toBeCloseTo(100, 9)
    expect(turned.bounds.height).toBeCloseTo(50, 9)
  })
})

describe('a circle', () => {
  const filled = new Circle2d({ radius: 10, isFilled: true })
  const hollow = new Circle2d({ radius: 10, isFilled: false })

  it('stands in a box twice its radius', () => {
    expect(box(filled.getBounds())).toEqual([0, 0, 20, 20])
    expect(box(new Circle2d({ x: 5, y: 5, radius: 10, isFilled: true }).bounds)).toEqual([5, 5, 20, 20])
  })

  it('measures distance from the edge rather than from the middle', () => {
    expect(hollow.distanceToPoint(new Vec(10, 10))).toBe(10)
    expect(filled.distanceToPoint(new Vec(10, 10))).toBe(-10)
    expect(filled.distanceToPoint(new Vec(30, 10))).toBe(10)
    expect(hollow.distanceToPoint(new Vec(10, 10), true)).toBe(-10)
  })

  it('is hit exactly on its edge and nowhere a hair outside without a margin', () => {
    expect(hollow.distanceToPoint(new Vec(20, 10))).toBe(0)
    expect(hollow.hitTestPoint(new Vec(20, 10))).toBe(true)
    expect(filled.hitTestPoint(new Vec(20, 10))).toBe(true)
    expect(hollow.hitTestPoint(new Vec(20.5, 10))).toBe(false)
    expect(hollow.hitTestPoint(new Vec(20.5, 10), 1)).toBe(true)
  })

  it('is hollow in the middle until it is filled', () => {
    expect(hollow.hitTestPoint(new Vec(10, 10))).toBe(false)
    expect(hollow.hitTestPoint(new Vec(10, 10), 0, true)).toBe(true)
    expect(filled.hitTestPoint(new Vec(10, 10))).toBe(true)
  })

  it('projects a point onto its edge', () => {
    expect(coords([filled.nearestPoint(new Vec(40, 10))])).toEqual([[20, 10]])
    expect(coords([filled.nearestPoint(new Vec(10, 10))])).toEqual([[20, 10]])
  })

  it('draws itself as a ring of points that under-runs the true area', () => {
    expect(filled.vertices).toHaveLength(8)
    expect(filled.area).toBeCloseTo(0.5 * 8 * 100 * Math.sin(PI2 / 8), 6)
    expect(filled.area).toBeLessThan(PI * 100)
  })

  it('is crossed by a line that passes through it', () => {
    expect(filled.hitTestLineSegment(new Vec(-10, 10), new Vec(30, 10))).toBe(true)
    expect(filled.hitTestLineSegment(new Vec(-10, -10), new Vec(-5, -5))).toBe(false)
  })
})

describe('an ellipse', () => {
  const wide = new Ellipse2d({ width: 100, height: 50, isFilled: true })

  it('stands in the box it was given', () => {
    expect(box(wide.getBounds())).toEqual([0, 0, 100, 50])
  })

  it('measures a way round that sits between its two circles', () => {
    expect(wide.getLength()).toBeGreaterThan(PI2 * 25)
    expect(wide.getLength()).toBeLessThan(PI2 * 50)
    expect(new Ellipse2d({ width: 100, height: 100, isFilled: true }).getLength()).toBeCloseTo(PI2 * 50, 6)
  })

  it('is hit inside, missed outside, and hit on its own rim', () => {
    expect(wide.hitTestPoint(new Vec(50, 25))).toBe(true)
    expect(wide.hitTestPoint(new Vec(99, 1))).toBe(false)
    expect(wide.hitTestPoint(new Vec(100, 25))).toBe(true)
    expect(wide.distanceToPoint(new Vec(100, 25))).toBeCloseTo(0, 9)
    expect(wide.distanceToPoint(new Vec(50, 25))).toBeLessThan(0)
  })

  it('is crossed by a line through its middle', () => {
    expect(wide.hitTestLineSegment(new Vec(-10, 25), new Vec(110, 25))).toBe(true)
    expect(wide.hitTestLineSegment(new Vec(-10, -10), new Vec(-5, -5))).toBe(false)
  })
})

describe('a polygon', () => {
  const arrow = new Polygon2d({
    isFilled: true,
    points: [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(5, 5), new Vec(0, 10)]
  })

  it('refuses to be built from fewer than three points', () => {
    expect(() => new Polygon2d({ isFilled: true, points: [new Vec(0, 0), new Vec(1, 1)] })).toThrow()
  })

  it('holds a point in its body and lets go of one in its notch', () => {
    expect(arrow.hitTestPoint(new Vec(5, 2))).toBe(true)
    expect(arrow.hitTestPoint(new Vec(1, 2))).toBe(true)
    expect(arrow.hitTestPoint(new Vec(9, 9))).toBe(true)
    expect(arrow.hitTestPoint(new Vec(5, 8))).toBe(false)
  })

  it('reads the notch as outside and says how far out it is', () => {
    expect(arrow.distanceToPoint(new Vec(5, 8))).toBeCloseTo(3 / Math.SQRT2, 9)
    expect(arrow.distanceToPoint(new Vec(5, 2))).toBeCloseTo(-2, 9)
    expect(arrow.hitTestPoint(new Vec(5, 8), 3)).toBe(true)
  })

  it('is hit right on the lip of the notch', () => {
    expect(arrow.distanceToPoint(new Vec(5, 5))).toBe(-0)
    expect(arrow.hitTestPoint(new Vec(5, 5))).toBe(true)
  })
})

describe('a polyline', () => {
  const line = new Polyline2d({ points: [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10)] })

  it('is open, so it holds no area and closes no ring', () => {
    expect(line.isClosed).toBe(false)
    expect(line.getArea()).toBe(0)
    expect(line.length).toBe(20)
    expect(line.toSimpleSvgPath().endsWith('Z')).toBe(false)
  })

  it('refuses to be built from one point', () => {
    expect(() => new Polyline2d({ points: [new Vec(0, 0)] })).toThrow()
  })

  it('is hit along its run and missed off it', () => {
    expect(line.distanceToPoint(new Vec(5, 0))).toBe(0)
    expect(line.hitTestPoint(new Vec(5, 0))).toBe(true)
    expect(line.distanceToPoint(new Vec(5, 3))).toBe(3)
    expect(line.hitTestPoint(new Vec(5, 3), 2)).toBe(false)
    expect(line.hitTestPoint(new Vec(5, 3), 3)).toBe(true)
  })

  it('never counts the inside of the shape it nearly makes', () => {
    expect(line.distanceToPoint(new Vec(9, 1), true)).toBeGreaterThan(0)
  })

  it('finds the nearest point along it', () => {
    expect(coords([line.nearestPoint(new Vec(5, 9))])).toEqual([[10, 9]])
    expect(coords([line.nearestPoint(new Vec(-5, -5))])).toEqual([[0, 0]])
    expect(coords([line.nearestPoint(new Vec(20, 5))])).toEqual([[10, 5]])
  })
})

describe('a stadium', () => {
  const wide = new Stadium2d({ width: 100, height: 50, isFilled: true })
  const tall = new Stadium2d({ width: 50, height: 100, isFilled: true })

  it('stands in the box it was given whichever way round it is', () => {
    expect(box(wide.getBounds())).toEqual([0, 0, 100, 50])
    expect(box(tall.getBounds())).toEqual([0, 0, 50, 100])
  })

  it('measures two caps and two straights', () => {
    expect(wide.getLength()).toBeCloseTo((PI * 25 + 50) * 2, 9)
    expect(tall.getLength()).toBeCloseTo((PI * 25 + 50) * 2, 9)
  })

  it('is hit through the middle and on its flat edge', () => {
    expect(wide.hitTestPoint(new Vec(50, 25))).toBe(true)
    expect(wide.distanceToPoint(new Vec(50, 25))).toBeCloseTo(-25, 9)
    expect(wide.distanceToPoint(new Vec(50, 0))).toBeCloseTo(0, 9)
    expect(wide.hitTestPoint(new Vec(50, 0))).toBe(true)
  })

  it('is missed in the corner its cap curves away from', () => {
    expect(wide.hitTestPoint(new Vec(0, 0))).toBe(false)
    expect(wide.hitTestPoint(new Vec(200, 25))).toBe(false)
  })

  it('is crossed by a line through it', () => {
    expect(wide.hitTestLineSegment(new Vec(-10, 25), new Vec(110, 25))).toBe(true)
    expect(wide.hitTestLineSegment(new Vec(-10, -10), new Vec(-5, -5))).toBe(false)
  })
})

describe('an edge', () => {
  const edge = new Edge2d({ start: new Vec(0, 0), end: new Vec(10, 0) })

  it('is as long as the two points are apart', () => {
    expect(edge.getLength()).toBe(10)
    expect(edge.vertices).toHaveLength(2)
    expect(edge.getArea()).toBe(0)
  })

  it('measures square onto itself and clamps at both ends', () => {
    expect(edge.distanceToPoint(new Vec(5, 5))).toBe(5)
    expect(edge.distanceToPoint(new Vec(-3, 4))).toBe(5)
    expect(edge.distanceToPoint(new Vec(13, 4))).toBe(5)
    expect(edge.distanceToPoint(new Vec(5, 0))).toBe(0)
  })

  it('gives back its own ends for anything past them', () => {
    expect(coords([edge.nearestPoint(new Vec(-10, 0))])).toEqual([[0, 0]])
    expect(coords([edge.nearestPoint(new Vec(20, 0))])).toEqual([[10, 0]])
    expect(coords([edge.nearestPoint(new Vec(4, 9))])).toEqual([[4, 0]])
  })

  it('is a point when both its ends are one', () => {
    const dot = new Edge2d({ start: new Vec(2, 2), end: new Vec(2, 2) })
    expect(dot.getLength()).toBe(0)
    expect(dot.distanceToPoint(new Vec(2, 5))).toBe(3)
    expect(coords([dot.nearestPoint(new Vec(9, 9))])).toEqual([[2, 2]])
  })
})

describe('a point', () => {
  const dot = new Point2d({ point: new Vec(5, 5), margin: 3 })

  it('is only ever itself', () => {
    expect(coords(dot.vertices)).toEqual([[5, 5]])
    expect(coords([dot.nearestPoint()])).toEqual([[5, 5]])
    expect(box(dot.bounds)).toEqual([5, 5, 0, 0])
  })

  it('measures straight out from where it stands', () => {
    expect(dot.distanceToPoint(new Vec(5, 9))).toBe(4)
    expect(dot.hitTestPoint(new Vec(5, 9))).toBe(false)
    expect(dot.hitTestPoint(new Vec(5, 9), 4)).toBe(true)
    expect(dot.hitTestPoint(new Vec(5, 5))).toBe(true)
  })

  it('is caught by a line only inside the margin it is asked about', () => {
    expect(dot.hitTestLineSegment(new Vec(0, 0), new Vec(10, 0), 6)).toBe(true)
    expect(dot.hitTestLineSegment(new Vec(0, 0), new Vec(10, 0), 4)).toBe(false)
  })
})

describe('an arc', () => {
  const quarter = new Arc2d({
    center: new Vec(0, 0),
    start: new Vec(10, 0),
    end: new Vec(0, 10),
    sweepFlag: 1,
    largeArcFlag: 0
  })

  it('refuses to be built with no distance to travel', () => {
    expect(
      () =>
        new Arc2d({
          center: new Vec(0, 0),
          start: new Vec(10, 0),
          end: new Vec(10, 0),
          sweepFlag: 1,
          largeArcFlag: 0
        })
    ).toThrow()
  })

  it('is a quarter of the way round its own circle', () => {
    expect(quarter.radius).toBe(10)
    expect(quarter.measure).toBeCloseTo(HALF_PI, 9)
    expect(quarter.getLength()).toBeCloseTo(HALF_PI * 10, 9)
  })

  it('runs from its start to its end, every point on the circle', () => {
    const vertices = quarter.vertices
    expect(coords([vertices[0]])).toEqual([[10, 0]])
    expect(vertices[vertices.length - 1].x).toBeCloseTo(0, 9)
    expect(vertices[vertices.length - 1].y).toBeCloseTo(10, 9)
    for (const v of vertices) {
      expect(v.len()).toBeCloseTo(10, 9)
    }
  })

  it('holds a point to the stretch it really covers', () => {
    const on = quarter.nearestPoint(new Vec(20, 20))
    expect(on.len()).toBeCloseTo(10, 9)
    expect(coords([quarter.nearestPoint(new Vec(30, -30))])).toEqual([[10, 0]])
    expect(coords([quarter.nearestPoint(new Vec(-30, 30))])).toEqual([[0, 10]])
  })

  it('is crossed only where the line meets the stretch it covers', () => {
    expect(quarter.hitTestLineSegment(new Vec(0, 0), new Vec(20, 20))).toBe(true)
    expect(quarter.hitTestLineSegment(new Vec(0, 0), new Vec(-20, -20))).toBe(true)
  })
})

describe('a cubic bezier', () => {
  const straight = new CubicBezier2d({
    start: new Vec(0, 0),
    cp1: new Vec(10, 0),
    cp2: new Vec(20, 0),
    end: new Vec(30, 0)
  })

  it('is a straight run when its handles lie along one', () => {
    expect(straight.getLength()).toBeCloseTo(30, 9)
    expect(straight.vertices).toHaveLength(11)
    for (const v of straight.vertices) {
      expect(v.y).toBeCloseTo(0, 9)
    }
  })

  it('starts and ends where it was told to', () => {
    expect(coords([CubicBezier2d.GetAtT(straight, 0)])).toEqual([[0, 0]])
    expect(coords([CubicBezier2d.GetAtT(straight, 1)])).toEqual([[30, 0]])
    expect(coords([CubicBezier2d.GetAtT(straight, 0.5)])).toEqual([[15, 0]])
  })

  it('bends toward its handles and stays short of the way round them', () => {
    const curve = new CubicBezier2d({
      start: new Vec(0, 0),
      cp1: new Vec(0, 100),
      cp2: new Vec(100, 100),
      end: new Vec(100, 0)
    })
    expect(CubicBezier2d.GetAtT(curve, 0.5).y).toBeCloseTo(75, 9)
    expect(curve.getLength()).toBeLessThan(300)
    expect(curve.getLength()).toBeGreaterThan(100)
  })

  it('measures onto itself', () => {
    expect(straight.distanceToPoint(new Vec(15, 4))).toBeCloseTo(4, 9)
    expect(coords([straight.nearestPoint(new Vec(15, 4))])).toEqual([[15, 0]])
  })

  it('takes the resolution it is given', () => {
    const coarse = new CubicBezier2d({
      start: new Vec(0, 0),
      cp1: new Vec(10, 0),
      cp2: new Vec(20, 0),
      end: new Vec(30, 0),
      resolution: 4
    })
    expect(coarse.vertices).toHaveLength(5)
  })
})

describe('a cubic spline', () => {
  const spline = new CubicSpline2d({
    points: [new Vec(0, 0), new Vec(10, 0), new Vec(20, 0), new Vec(30, 0)]
  })

  it('holds one segment per gap between its points', () => {
    expect(spline.segments).toHaveLength(3)
    expect(spline.isClosed).toBe(false)
  })

  it('runs straight through points that are already in a line', () => {
    expect(spline.getLength()).toBeCloseTo(30, 6)
    for (const v of spline.vertices) {
      expect(v.y).toBeCloseTo(0, 9)
    }
    expect(coords([spline.vertices[spline.vertices.length - 1]])).toEqual([[30, 0]])
  })

  it('measures onto itself and is crossed by a line through it', () => {
    expect(spline.distanceToPoint(new Vec(15, 5))).toBeCloseTo(5, 6)
    expect(spline.hitTestLineSegment(new Vec(15, -5), new Vec(15, 5))).toBe(true)
    expect(spline.hitTestLineSegment(new Vec(15, 5), new Vec(15, 10))).toBe(false)
  })
})

describe('a group', () => {
  const near = () => new Rectangle2d({ width: 100, height: 100, isFilled: true })
  const far = () => new Rectangle2d({ x: 200, y: 200, width: 10, height: 10, isFilled: true })

  it('flattens a group it is handed rather than nesting it', () => {
    const group = new Group2d({ children: [new Group2d({ children: [near(), far()] }), near()] })
    expect(group.children).toHaveLength(3)
    for (const child of group.children) {
      expect(child).toBeInstanceOf(Rectangle2d)
    }
  })

  it('refuses to stand with nothing in it', () => {
    expect(() => new Group2d({ children: [] })).toThrow()
  })

  it('puts a child that says to ignore it to one side', () => {
    const ignored = new Rectangle2d({ width: 10, height: 10, isFilled: true, ignore: true })
    const group = new Group2d({ children: [near(), ignored] })
    expect(group.children).toHaveLength(1)
    expect(group.ignoredChildren).toEqual([ignored])
  })

  it('takes its area from the first child and nothing else', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(group.getArea()).toBe(10000)
    expect(group.area).toBe(10000)

    const other = new Group2d({ children: [far(), near()] })
    expect(other.getArea()).toBe(100)
  })

  it('leaves a child out of its bounds when that child says to', () => {
    const excluded = new Rectangle2d({
      x: 200,
      y: 200,
      width: 10,
      height: 10,
      isFilled: true,
      excludeFromShapeBounds: true
    })
    const group = new Group2d({ children: [near(), excluded] })

    expect(box(group.bounds)).toEqual([0, 0, 100, 100])
    expect(group.boundsVertices).toHaveLength(4)
    expect(excluded.getBoundsVertices()).toEqual([])
  })

  it('still counts an excluded child everywhere that is not the bounds', () => {
    const excluded = new Rectangle2d({
      x: 200,
      y: 200,
      width: 10,
      height: 10,
      isFilled: true,
      excludeFromShapeBounds: true
    })
    const group = new Group2d({ children: [near(), excluded] })

    expect(group.vertices).toHaveLength(8)
    expect(group.hitTestPoint(new Vec(205, 205))).toBe(true)
  })

  it('grows its bounds to hold every child that is not excluded', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(box(group.bounds)).toEqual([0, 0, 210, 210])
  })

  it('is as far from a point as its nearest child is', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(group.distanceToPoint(new Vec(50, 50))).toBe(-50)
    expect(group.distanceToPoint(new Vec(150, 150))).toBeCloseTo(Math.sqrt(5000), 9)
    expect(coords([group.nearestPoint(new Vec(150, 100))])).toEqual([[100, 100]])
  })

  it('is hit where any of its children is', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(group.hitTestPoint(new Vec(50, 50))).toBe(true)
    expect(group.hitTestPoint(new Vec(205, 205))).toBe(true)
    expect(group.hitTestPoint(new Vec(150, 150))).toBe(false)
    expect(group.hitTestPoint(new Vec(150, 150), 60)).toBe(false)
  })

  it('is crossed where any of its children is', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(group.hitTestLineSegment(new Vec(-10, 50), new Vec(110, 50))).toBe(true)
    expect(group.hitTestLineSegment(new Vec(195, 205), new Vec(215, 205))).toBe(true)
    expect(group.hitTestLineSegment(new Vec(140, 140), new Vec(150, 150))).toBe(false)
  })

  it('leaves a label out when it is told to and counts it when it is not', () => {
    const label = new Rectangle2d({
      x: 200,
      y: 200,
      width: 10,
      height: 10,
      isFilled: true,
      isLabel: true
    })
    const group = new Group2d({ children: [near(), label] })

    expect(group.getVertices(Geometry2dFilters.EXCLUDE_LABELS)).toHaveLength(4)
    expect(group.getVertices(Geometry2dFilters.INCLUDE_ALL)).toHaveLength(8)
    expect(group.hitTestPoint(new Vec(205, 205))).toBe(false)
    expect(group.hitTestPoint(new Vec(205, 205), 0, false, Geometry2dFilters.INCLUDE_ALL)).toBe(true)
  })

  it('adds up the length of every child it counts', () => {
    const group = new Group2d({ children: [near(), far()] })
    expect(group.getLength()).toBe(400 + 40)
  })
})

describe('two line segments', () => {
  it('meet where they cross', () => {
    expect(
      coords([intersectLineSegmentLineSegment(new Vec(0, 0), new Vec(10, 10), new Vec(0, 10), new Vec(10, 0))!])
    ).toEqual([[5, 5]])
  })

  it('meet where one runs into the middle of the other', () => {
    expect(
      coords([intersectLineSegmentLineSegment(new Vec(0, 0), new Vec(10, 0), new Vec(5, -5), new Vec(5, 5))!])
    ).toEqual([[5, 0]])
  })

  it('never meet when they are parallel, apart, or stop short', () => {
    expect(intersectLineSegmentLineSegment(new Vec(0, 0), new Vec(10, 0), new Vec(0, 1), new Vec(10, 1))).toBe(null)
    expect(intersectLineSegmentLineSegment(new Vec(0, 0), new Vec(1, 1), new Vec(5, 5), new Vec(6, 6))).toBe(null)
    expect(intersectLineSegmentLineSegment(new Vec(0, 0), new Vec(4, 0), new Vec(5, -5), new Vec(5, 5))).toBe(null)
  })
})

describe('a line segment and a circle', () => {
  it('meets it twice going straight through the middle', () => {
    expect(coords(intersectLineSegmentCircle(new Vec(-20, 0), new Vec(20, 0), new Vec(0, 0), 10))).toEqual([
      [10, 0],
      [-10, 0]
    ])
  })

  it('meets it once when it starts inside', () => {
    expect(coords(intersectLineSegmentCircle(new Vec(0, 0), new Vec(20, 0), new Vec(0, 0), 10))).toEqual([[10, 0]])
  })

  it('never meets it when it grazes, misses, or is swallowed whole', () => {
    expect(intersectLineSegmentCircle(new Vec(-20, 10), new Vec(20, 10), new Vec(0, 0), 10)).toBe(null)
    expect(intersectLineSegmentCircle(new Vec(-20, 40), new Vec(20, 40), new Vec(0, 0), 10)).toBe(null)
    expect(intersectLineSegmentCircle(new Vec(-1, 0), new Vec(1, 0), new Vec(0, 0), 10)).toBe(null)
  })
})

describe('a line segment and a run of points', () => {
  const polyline = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10)]
  const square = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]

  it('meets an open run only on the edges it really has', () => {
    expect(coords(intersectLineSegmentPolyline(new Vec(5, -5), new Vec(5, 5), polyline))).toEqual([[5, 0]])
    expect(intersectLineSegmentPolyline(new Vec(5, 5), new Vec(5, 9), polyline)).toBe(null)
  })

  it('meets a closed ring on both sides going through it', () => {
    expect(coords(intersectLineSegmentPolygon(new Vec(-5, 5), new Vec(15, 5), square))).toEqual([
      [10, 5],
      [0, 5]
    ])
  })

  it('never meets a ring it stays outside of', () => {
    expect(intersectLineSegmentPolygon(new Vec(-5, -5), new Vec(-1, -1), square)).toBe(null)
  })

  it('closes the ring the open run leaves open', () => {
    expect(intersectLineSegmentPolyline(new Vec(5, 5), new Vec(5, 15), polyline)).toBe(null)
    expect(intersectLineSegmentPolygon(new Vec(5, 5), new Vec(5, 15), polyline)).toBe(null)
  })
})

describe('a circle and a ring of points', () => {
  it('meets each edge it reaches across', () => {
    const square = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]
    expect(coords(intersectCirclePolygon(new Vec(0, 0), 5, square))).toEqual([
      [5, 0],
      [0, 5]
    ])
  })

  it('never meets a ring it stands clear of', () => {
    const square = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]
    expect(intersectCirclePolygon(new Vec(100, 100), 5, square)).toBe(null)
    expect(intersectCirclePolygon(new Vec(5, 5), 1, square)).toBe(null)
  })
})

describe('two circles', () => {
  it('meet at the two points either side of the line between them', () => {
    expect(coords(intersectCircleCircle(new Vec(0, 0), 5, new Vec(6, 0), 5))).toEqual([
      [3, 4],
      [3, -4]
    ])
  })

  it('meet on one point twice where they only touch', () => {
    const points = intersectCircleCircle(new Vec(0, 0), 5, new Vec(10, 0), 5)
    expect(points[0].x).toBeCloseTo(5, 9)
    expect(points[0].y).toBeCloseTo(0, 9)
    expect(points[1].x).toBeCloseTo(5, 9)
    expect(points[1].y).toBeCloseTo(0, 9)
  })
})

describe('two rings of points', () => {
  const a = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]
  const b = [new Vec(5, 5), new Vec(15, 5), new Vec(15, 15), new Vec(5, 15)]

  it('make the corner they share', () => {
    const hit = intersectPolygonPolygon(a, b)!
    expect(hit).toHaveLength(4)
    expect(coords(hit)!.sort()).toEqual(
      [
        [5, 5],
        [5, 10],
        [10, 5],
        [10, 10]
      ].sort()
    )
  })

  it('make nothing when they stand apart', () => {
    expect(intersectPolygonPolygon(a, [new Vec(50, 50), new Vec(60, 50), new Vec(60, 60)])).toBe(null)
  })

  it('cross when an edge of one really crosses an edge of the other', () => {
    expect(polygonsIntersect(a, b)).toBe(true)
    expect(polygonsIntersect(a, [new Vec(50, 50), new Vec(60, 50), new Vec(60, 60)])).toBe(false)
  })

  it('do not cross when one stands wholly inside the other', () => {
    expect(polygonsIntersect(a, [new Vec(2, 2), new Vec(4, 2), new Vec(4, 4), new Vec(2, 4)])).toBe(false)
  })

  it('find the points where they meet without ordering them', () => {
    expect(coords(intersectPolys(a, b, true, true))!.sort()).toEqual(
      [
        [10, 5],
        [5, 10]
      ].sort()
    )
    expect(intersectPolys(a, [new Vec(50, 50), new Vec(60, 60)], true, false)).toEqual([])
  })
})

describe('a ring of points and a box', () => {
  const square = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]

  it('meets the box along the sides that cut it', () => {
    expect(coords(intersectPolygonBounds(square, new Box(5, 5, 20, 20)))!.sort()).toEqual(
      [
        [10, 5],
        [5, 10]
      ].sort()
    )
  })

  it('never meets a box standing clear of it', () => {
    expect(intersectPolygonBounds(square, new Box(50, 50, 10, 10))).toBe(null)
  })

  it('never meets a box that swallows it whole', () => {
    expect(intersectPolygonBounds(square, new Box(-50, -50, 200, 200))).toBe(null)
  })
})
