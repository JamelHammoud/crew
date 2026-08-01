import { describe, expect, it } from 'vitest'
import { Box } from '../src/renderer/src/canvas/math/Box'
import { Mat } from '../src/renderer/src/canvas/math/Mat'
import { Vec } from '../src/renderer/src/canvas/math/Vec'
import {
  approximately,
  canonicalizeRotation,
  clamp,
  EPSILON,
  HALF_PI,
  lerp,
  linesIntersect,
  perimeterOfEllipse,
  PI,
  PI2,
  pointInPolygon,
  precise,
  shortAngleDist,
  toDomPrecision,
  toFixed
} from '../src/renderer/src/canvas/math/utils'

const HANDLES = ['top_left', 'top', 'top_right', 'right', 'bottom_right', 'bottom', 'bottom_left', 'left'] as const

function near(a: Vec, b: { x: number; y: number }, digits = 10) {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
}

describe('the numbers underneath', () => {
  it('holds the constants it is built on', () => {
    expect(PI).toBe(Math.PI)
    expect(PI2).toBe(Math.PI * 2)
    expect(HALF_PI).toBe(Math.PI / 2)
    expect(EPSILON).toBeGreaterThan(0)
    expect(EPSILON).toBeLessThan(0.001)
  })

  it('clamps against one bound and against two', () => {
    expect(clamp(-4, 0)).toBe(0)
    expect(clamp(4, 0)).toBe(4)
    expect(clamp(11, 1, 10)).toBe(10)
    expect(clamp(-1, 1, 10)).toBe(1)
    expect(clamp(5, 1, 10)).toBe(5)
  })

  it('walks between two numbers', () => {
    expect(lerp(0, 10, 0)).toBe(0)
    expect(lerp(0, 10, 1)).toBe(10)
    expect(lerp(0, 10, 0.25)).toBe(2.5)
    expect(lerp(-4, 4, 0.5)).toBe(0)
  })

  it('calls two numbers equal only inside the precision it is given', () => {
    expect(approximately(1, 1 + 1e-9)).toBe(true)
    expect(approximately(1, 1.1)).toBe(false)
    expect(approximately(1, 1.05, 0.1)).toBe(true)
  })

  it('rounds for the screen and for a record', () => {
    expect(toFixed(1.005)).toBe(1)
    expect(toFixed(1.006)).toBe(1.01)
    expect(toDomPrecision(1.000049)).toBe(1)
    expect(toDomPrecision(1.00005)).toBe(1.0001)
    expect(precise(new Vec(1.000051, 2.5))).toBe('1.0001,2.5 ')
  })

  it('brings any angle back inside one turn', () => {
    expect(canonicalizeRotation(0)).toBe(0)
    expect(canonicalizeRotation(PI2)).toBe(0)
    expect(canonicalizeRotation(-HALF_PI)).toBeCloseTo(PI2 - HALF_PI, 10)
    expect(canonicalizeRotation(PI2 + PI)).toBeCloseTo(PI, 10)
  })

  it('takes the short way round between two angles', () => {
    expect(shortAngleDist(0, HALF_PI)).toBeCloseTo(HALF_PI, 10)
    expect(shortAngleDist(0, PI2 - 0.1)).toBeCloseTo(-0.1, 10)
    expect(shortAngleDist(0.1, PI2)).toBeCloseTo(-0.1, 10)
  })

  it('measures an ellipse and agrees with a circle where it is one', () => {
    expect(perimeterOfEllipse(10, 10)).toBeCloseTo(PI2 * 10, 6)
    expect(perimeterOfEllipse(20, 10)).toBeGreaterThan(PI2 * 10)
    expect(perimeterOfEllipse(20, 10)).toBeLessThan(PI2 * 20)
    expect(perimeterOfEllipse(5, 0)).toBeGreaterThan(0)
  })

  it('has no perimeter to give for an ellipse with no radius at all', () => {
    expect(Number.isNaN(perimeterOfEllipse(0, 0))).toBe(true)
  })
})

describe('a vector', () => {
  it('adds and subtracts back to where it started', () => {
    const a = new Vec(3, 4)
    const b = new Vec(-7, 11)
    near(Vec.Sub(Vec.Add(a, b), b), a)
    near(a.clone().add(b).sub(b), a)
  })

  it('is its own length along its own unit vector', () => {
    const a = new Vec(3, 4)
    expect(a.len()).toBe(5)
    expect(a.len2()).toBe(25)
    near(Vec.Mul(Vec.Uni(a), a.len()), a)
    expect(Vec.Uni(new Vec(0, 0)).len()).toBe(0)
  })

  it('holds the dot and cross identities', () => {
    const a = new Vec(3, 4)
    const b = new Vec(-2, 5)
    expect(Vec.Dpr(a, b)).toBe(14)
    expect(Vec.Cpr(a, b)).toBe(23)
    expect(Vec.Dpr(a, Vec.Per(a))).toBe(0)
    expect(Vec.Cpr(a, a)).toBe(0)
    expect(Vec.Dpr(a, b)).toBe(Vec.Dpr(b, a))
    expect(Vec.Cpr(a, b)).toBe(-Vec.Cpr(b, a))
  })

  it('negates, scales and divides the way the algebra says', () => {
    const a = new Vec(3, -4)
    near(Vec.Neg(a), { x: -3, y: 4 })
    near(Vec.Mul(a, 2), { x: 6, y: -8 })
    near(Vec.Div(a, 2), { x: 1.5, y: -2 })
    near(Vec.AddScalar(a, 1), { x: 4, y: -3 })
    near(a.clone().neg().neg(), a)
  })

  it('turns a full circle back onto itself', () => {
    const a = new Vec(7, -3)
    near(Vec.Rot(a, PI2), a, 9)
    near(Vec.Rot(Vec.Rot(a, 1.1), -1.1), a, 9)
    near(Vec.Rot(new Vec(1, 0), HALF_PI), { x: 0, y: 1 }, 9)
  })

  it('keeps its length through a rotation', () => {
    const a = new Vec(3, 4)
    for (const r of [0.3, 1, 2.2, 5]) {
      expect(Vec.Rot(a, r).len()).toBeCloseTo(5, 10)
      expect(Vec.RotWith(a, new Vec(10, 10), r).dist(new Vec(10, 10))).toBeCloseTo(a.dist(new Vec(10, 10)), 10)
    }
  })

  it('rotates about a centre and comes home', () => {
    const c = new Vec(4, 4)
    const a = new Vec(10, 4)
    near(Vec.RotWith(a, c, PI), { x: -2, y: 4 }, 9)
    near(Vec.RotWith(Vec.RotWith(a, c, 0.7), c, -0.7), a, 9)
    near(a.clone().rotWith(c, PI2), a, 9)
  })

  it('is perpendicular to its own perpendicular, four turns round', () => {
    const a = new Vec(2, 5)
    near(Vec.Per(Vec.Per(Vec.Per(Vec.Per(a)))), a)
    expect(Vec.Dpr(a, Vec.Per(a))).toBe(0)
  })

  it('measures distance both ways and squared', () => {
    const a = new Vec(0, 0)
    const b = new Vec(3, 4)
    expect(Vec.Dist(a, b)).toBe(5)
    expect(Vec.Dist(b, a)).toBe(5)
    expect(Vec.Dist2(a, b)).toBe(25)
    expect(a.dist(b)).toBe(5)
    expect(a.dist2(b)).toBe(25)
  })

  it('walks a distance along a tangent with nudge', () => {
    const a = new Vec(0, 0)
    const b = new Vec(10, 0)
    near(Vec.Nudge(a, b, 3), { x: 3, y: 0 })
    near(a.clone().nudge(b, 3), { x: 3, y: 0 })
  })

  it('interpolates and takes the midpoint', () => {
    const a = new Vec(0, 0)
    const b = new Vec(10, 20)
    near(Vec.Lrp(a, b, 0), a)
    near(Vec.Lrp(a, b, 1), b)
    near(Vec.Lrp(a, b, 0.5), { x: 5, y: 10 })
    near(Vec.Med(a, b), Vec.Lrp(a, b, 0.5))
  })

  it('reads the angle from one point to another', () => {
    expect(Vec.Angle(new Vec(0, 0), new Vec(1, 0))).toBeCloseTo(0, 10)
    expect(Vec.Angle(new Vec(0, 0), new Vec(0, 1))).toBeCloseTo(HALF_PI, 10)
    expect(new Vec(0, 0).angle(new Vec(-1, 0))).toBeCloseTo(PI, 10)
    near(Vec.FromAngle(1.3, 5), { x: Math.cos(1.3) * 5, y: Math.sin(1.3) * 5 })
    expect(Vec.FromAngle(1.3, 5).toAngle()).toBeCloseTo(1.3, 10)
  })

  it('clamps, snaps and rounds', () => {
    near(Vec.Clamp(new Vec(-5, 20), 0), { x: 0, y: 20 })
    near(Vec.Clamp(new Vec(-5, 20), 0, 10), { x: 0, y: 10 })
    near(new Vec(-5, 20).clamp(0, 10), { x: 0, y: 10 })
    near(Vec.Snap(new Vec(11, -14), 10), { x: 10, y: -10 })
    near(Vec.ToFixed(new Vec(1.005, 1.006)), { x: 1, y: 1.01 })
    near(new Vec(1.005, 1.006).toFixed(), { x: 1, y: 1.01 })
  })

  it('reads a min, a max and an average of many', () => {
    const pts = [new Vec(0, 10), new Vec(4, -2), new Vec(-4, 4)]
    near(Vec.Min(pts[0], pts[1]), { x: 0, y: -2 })
    near(Vec.Max(pts[0], pts[1]), { x: 4, y: 10 })
    near(Vec.Average(pts), { x: 0, y: 4 })
    near(Vec.Average([]), { x: 0, y: 0 })
  })

  it('casts and builds from whatever it is handed', () => {
    const v = new Vec(1, 2, 0.5)
    expect(Vec.Cast(v)).toBe(v)
    near(Vec.Cast({ x: 3, y: 4 }), { x: 3, y: 4 })
    expect(Vec.From({ x: 3, y: 4 }).z).toBe(1)
    expect(Vec.From({ x: 3, y: 4, z: 0.2 }).z).toBe(0.2)
    near(Vec.FromArray([7, 8]), { x: 7, y: 8 })
  })

  it('calls two points equal only within a hair', () => {
    expect(new Vec(1, 1).equals(new Vec(1.00001, 1))).toBe(true)
    expect(new Vec(1, 1).equals(new Vec(1.001, 1))).toBe(false)
  })

  it('finds the nearest point on a segment and the distance to it', () => {
    const a = new Vec(0, 0)
    const b = new Vec(10, 0)
    near(Vec.NearestPointOnLineSegment(a, b, new Vec(4, 5)), { x: 4, y: 0 })
    near(Vec.NearestPointOnLineSegment(a, b, new Vec(-4, 5)), { x: 0, y: 0 })
    near(Vec.NearestPointOnLineSegment(a, b, new Vec(40, 5)), { x: 10, y: 0 })
    expect(Vec.DistanceToLineSegment(a, b, new Vec(4, 5))).toBeCloseTo(5, 10)
    expect(Vec.DistanceToLineSegment(a, b, new Vec(-3, 4))).toBeCloseTo(5, 10)
    expect(Vec.DistanceToLineSegment(a, a, new Vec(3, 4))).toBeCloseTo(5, 10)
  })
})

describe('a box', () => {
  it('reads its own edges, middle and size', () => {
    const b = new Box(10, 20, 100, 40)
    expect([b.minX, b.midX, b.maxX]).toEqual([10, 60, 110])
    expect([b.minY, b.midY, b.maxY]).toEqual([20, 40, 60])
    expect([b.width, b.height]).toEqual([100, 40])
    expect(b.aspectRatio).toBe(2.5)
    near(b.center, { x: 60, y: 40 })
    near(b.point, { x: 10, y: 20 })
    near(b.size, { x: 100, y: 40 })
  })

  it('names its corners clockwise from the top left', () => {
    const b = new Box(0, 0, 10, 20)
    expect(b.corners.map(c => [c.x, c.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 20],
      [0, 20]
    ])
    expect(b.cornersAndCenter).toHaveLength(5)
    near(b.cornersAndCenter[4], { x: 5, y: 10 })
    expect(b.sides).toHaveLength(4)
    expect(Box.Sides(b)).toHaveLength(4)
    near(b.sides[0][0], b.corners[0])
    near(b.sides[3][1], b.corners[0])
  })

  it('gives a point for every one of the eight handles', () => {
    const b = new Box(10, 20, 100, 40)
    const want = {
      top_left: { x: 10, y: 20 },
      top: { x: 60, y: 20 },
      top_right: { x: 110, y: 20 },
      right: { x: 110, y: 40 },
      bottom_right: { x: 110, y: 60 },
      bottom: { x: 60, y: 60 },
      bottom_left: { x: 10, y: 60 },
      left: { x: 10, y: 40 }
    }
    for (const handle of HANDLES) {
      near(b.getHandlePoint(handle), want[handle])
    }
    expect(new Set(HANDLES.map(h => b.getHandlePoint(h).toString())).size).toBe(8)
  })

  it('grows to hold every point it is given', () => {
    const b = Box.FromPoints([new Vec(4, 9), new Vec(-2, 3), new Vec(0, 20)])
    expect([b.x, b.y, b.w, b.h]).toEqual([-2, 3, 6, 17])
    expect(Box.FromPoints([])).toEqual(new Box())
    const one = Box.FromPoints([new Vec(5, 5)])
    expect([one.x, one.y, one.w, one.h]).toEqual([5, 5, 0, 0])
  })

  it('finds the box every box stands inside', () => {
    const common = Box.Common([new Box(0, 0, 10, 10), new Box(20, -5, 5, 5), new Box(5, 5, 5, 30)])
    expect([common.x, common.y, common.w, common.h]).toEqual([0, -5, 25, 40])
    const one = new Box(3, 4, 5, 6)
    expect(Box.Common([one]).equals(one)).toBe(true)
  })

  it('builds from a centre and from a model', () => {
    const b = Box.FromCenter(new Vec(50, 50), new Vec(20, 10))
    expect([b.x, b.y, b.w, b.h]).toEqual([40, 45, 20, 10])
    near(b.center, { x: 50, y: 50 })
    expect(Box.From({ x: 1, y: 2, w: 3, h: 4 }).equals(new Box(1, 2, 3, 4))).toBe(true)
  })

  it('tells collision from containment', () => {
    const a = new Box(0, 0, 100, 100)
    const inside = new Box(10, 10, 10, 10)
    const across = new Box(90, 90, 100, 100)
    const away = new Box(500, 500, 10, 10)

    expect(a.contains(inside)).toBe(true)
    expect(a.contains(across)).toBe(false)
    expect(a.collides(across)).toBe(true)
    expect(a.collides(away)).toBe(false)
    expect(a.includes(inside)).toBe(true)
    expect(a.includes(across)).toBe(true)
    expect(a.includes(away)).toBe(false)
  })

  it('holds a point, its own edge, and one a margin outside', () => {
    const b = new Box(0, 0, 10, 10)
    expect(b.containsPoint(new Vec(5, 5))).toBe(true)
    expect(b.containsPoint(new Vec(0, 0))).toBe(true)
    expect(b.containsPoint(new Vec(10, 10))).toBe(true)
    expect(b.containsPoint(new Vec(11, 5))).toBe(false)
    expect(b.containsPoint(new Vec(11, 5), 1)).toBe(true)
  })

  it('expands, moves and scales', () => {
    expect(Box.ExpandBy(new Box(0, 0, 10, 10), 5).equals(new Box(-5, -5, 20, 20))).toBe(true)
    expect(new Box(0, 0, 10, 10).expandBy(5).equals(new Box(-5, -5, 20, 20))).toBe(true)
    expect(Box.Expand(new Box(0, 0, 10, 10), new Box(20, 20, 10, 10)).equals(new Box(0, 0, 30, 30))).toBe(true)
    expect(new Box(0, 0, 10, 10).union({ x: 20, y: 20, w: 10, h: 10 }).equals(new Box(0, 0, 30, 30))).toBe(true)
    expect(new Box(1, 2, 3, 4).translate(new Vec(10, 10)).equals(new Box(11, 12, 3, 4))).toBe(true)
    expect(new Box(10, 20, 30, 40).scale(10).equals(new Box(1, 2, 3, 4))).toBe(true)
  })

  it('never leaves a side at nothing when it is zero fixed', () => {
    expect(Box.ZeroFix({ x: 1, y: 2, w: 0, h: 0 }).equals(new Box(1, 2, 1, 1))).toBe(true)
    expect(new Box(1, 2, 0, 5).zeroFix().equals(new Box(1, 2, 1, 5))).toBe(true)
  })

  it('rounds itself off', () => {
    const b = new Box(0.1 + 0.2, 1, 2, 3).toFixed()
    expect(b.x).toBe(0.3)
  })

  it('resizes from the handle that was dragged', () => {
    expect(Box.Resize(new Box(0, 0, 100, 100), 'right', 50, 0).box.equals(new Box(0, 0, 150, 100))).toBe(true)
    expect(Box.Resize(new Box(0, 0, 100, 100), 'left', 50, 0).box.equals(new Box(50, 0, 50, 100))).toBe(true)
    expect(Box.Resize(new Box(0, 0, 100, 100), 'bottom_right', 50, 50).box.equals(new Box(0, 0, 150, 150))).toBe(true)
    expect(Box.Resize(new Box(0, 0, 100, 100), 'top_left', 50, 50).box.equals(new Box(50, 50, 50, 50))).toBe(true)
    expect(new Box(0, 0, 100, 100).resize('right', 50, 0).equals(new Box(0, 0, 150, 100))).toBe(true)
  })

  it('flips rather than folding inside out when a drag crosses over', () => {
    const { box, scaleX } = Box.Resize(new Box(0, 0, 100, 100), 'right', -150, 0)
    expect(box.width).toBe(50)
    expect(box.minX).toBe(-50)
    expect(scaleX).toBeLessThan(0)
  })
})

describe('a matrix', () => {
  it('leaves a point where it found it', () => {
    near(Mat.applyToPoint(Mat.Identity(), new Vec(3, 4)), { x: 3, y: 4 })
    expect(Mat.Identity().equals(Mat.Identity())).toBe(true)
    expect(Mat.Identity().equals(Mat.Translate(1, 0))).toBe(false)
  })

  it('moves, turns and scales a point', () => {
    near(Mat.applyToPoint(Mat.Translate(10, -5), new Vec(1, 1)), { x: 11, y: -4 })
    near(Mat.applyToPoint(Mat.Rotate(HALF_PI), new Vec(1, 0)), { x: 0, y: 1 }, 9)
    near(Mat.applyToPoint(Mat.Scale(2, 3), new Vec(2, 2)), { x: 4, y: 6 })
    near(Mat.applyToPoint(Mat.Rotate(PI, 5, 5), new Vec(10, 5)), { x: 0, y: 5 }, 9)
    near(Mat.applyToPoint(Mat.Scale(2, 2, 5, 5), new Vec(10, 5)), { x: 15, y: 5 })
  })

  it('composes in the order it was handed', () => {
    const composed = Mat.Compose(Mat.Translate(10, 0), Mat.Scale(2, 2))
    near(Mat.applyToPoint(composed, new Vec(3, 4)), { x: 16, y: 8 })

    const other = Mat.Compose(Mat.Scale(2, 2), Mat.Translate(10, 0))
    near(Mat.applyToPoint(other, new Vec(3, 4)), { x: 26, y: 8 })
  })

  it('undoes itself, however it was built', () => {
    const m = Mat.Compose(Mat.Translate(30, -12), Mat.Rotate(0.9), Mat.Scale(2.5, 2.5))
    const back = Mat.From(Mat.Inverse(m))
    const p = new Vec(7, -3)
    near(back.applyToPoint(m.applyToPoint(p)), p, 9)
    near(m.applyToPoint(back.applyToPoint(p)), p, 9)

    const round = Mat.From(Mat.Multiply(m, Mat.Inverse(m)))
    near(round.applyToPoint(p), p, 9)
  })

  it('inverts in place the same way it inverts as a value', () => {
    const m = Mat.Compose(Mat.Translate(4, 5), Mat.Rotate(0.4))
    const a = m.clone().invert()
    const b = Mat.From(Mat.Inverse(m))
    expect(a.equals(b)).toBe(true)
  })

  it('reads back the move, the turn and the scale it was made of', () => {
    const d = Mat.Decompose(Mat.Compose(Mat.Translate(12, 34), Mat.Rotate(0.75), Mat.Scale(3, 3)))
    expect(d.x).toBeCloseTo(12, 9)
    expect(d.y).toBeCloseTo(34, 9)
    expect(d.rotation).toBeCloseTo(0.75, 9)
    expect(d.scaleX).toBeCloseTo(3, 9)
    expect(d.scaleY).toBeCloseTo(3, 9)

    const m = Mat.Compose(Mat.Translate(1, 2), Mat.Rotate(2.5))
    expect(m.rotation()).toBeCloseTo(2.5, 9)
    expect(m.decomposed().rotation).toBeCloseTo(2.5, 9)
    near(m.point(), { x: 1, y: 2 })
    near(Mat.Point(m), { x: 1, y: 2 })
  })

  it('reads nothing out of a matrix that scaled to nothing', () => {
    const d = Mat.Decompose(new Mat(0, 0, 0, 0, 5, 6))
    expect(d).toEqual({ x: 5, y: 6, scaleX: 0, scaleY: 0, rotation: 0 })
  })

  it('carries a whole list of points through at once', () => {
    const m = Mat.Translate(1, 2)
    const out = m.applyToPoints([new Vec(0, 0), new Vec(10, 10)])
    near(out[0], { x: 1, y: 2 })
    near(out[1], { x: 11, y: 12 })
    expect(Mat.applyToXY(m, 3, 4)).toEqual([4, 6])
  })

  it('writes itself out for css', () => {
    expect(Mat.Translate(10, 20).toCssString()).toBe('matrix(1, 0, 0, 1, 10, 20)')
    expect(Mat.Identity().toCssString()).toBe('matrix(1, 0, 0, 1, 0, 0)')
  })

  it('casts what is already a matrix without copying it', () => {
    const m = Mat.Identity()
    expect(Mat.Cast(m)).toBe(m)
    expect(Mat.Cast({ a: 1, b: 0, c: 0, d: 1, e: 3, f: 4 })).toBeInstanceOf(Mat)
    expect(Mat.Cast({ a: 1, b: 0, c: 0, d: 1, e: 3, f: 4 }).e).toBe(3)
  })
})

describe('a point against a polygon', () => {
  const square = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(0, 10)]

  it('knows inside from outside', () => {
    expect(pointInPolygon(new Vec(5, 5), square)).toBe(true)
    expect(pointInPolygon(new Vec(15, 5), square)).toBe(false)
    expect(pointInPolygon(new Vec(-1, -1), square)).toBe(false)
  })

  it('counts a vertex as inside', () => {
    expect(pointInPolygon(new Vec(0, 0), square)).toBe(true)
    expect(pointInPolygon(new Vec(10, 10), square)).toBe(true)
  })

  it('reads the notch of a concave polygon as outside', () => {
    const arrow = [new Vec(0, 0), new Vec(10, 0), new Vec(10, 10), new Vec(5, 5), new Vec(0, 10)]
    expect(pointInPolygon(new Vec(5, 2), arrow)).toBe(true)
    expect(pointInPolygon(new Vec(1, 2), arrow)).toBe(true)
    expect(pointInPolygon(new Vec(5, 8), arrow)).toBe(false)
    expect(pointInPolygon(new Vec(5, 4.9), arrow)).toBe(true)
  })
})

describe('two lines', () => {
  it('cross when they really cross', () => {
    expect(linesIntersect(new Vec(0, 0), new Vec(10, 10), new Vec(0, 10), new Vec(10, 0))).toBe(true)
  })

  it('do not cross when they miss or run alongside', () => {
    expect(linesIntersect(new Vec(0, 0), new Vec(1, 1), new Vec(5, 5), new Vec(6, 6))).toBe(false)
    expect(linesIntersect(new Vec(0, 0), new Vec(10, 0), new Vec(0, 1), new Vec(10, 1))).toBe(false)
  })
})

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const random = seeded(20260801)
const spread = (scale = 400): number => (random() - 0.5) * scale

describe('the identities every vector operation rests on', () => {
  it('holds across four hundred random pairs', () => {
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
      expect(Vec.Neg(Vec.Neg(a))).toMatchObject({ x: a.x, y: a.y })
      expect(Vec.Dpr(a, Vec.Per(a))).toBeCloseTo(0, 6)
      expect(Vec.Lrp(a, b, 0)).toMatchObject({ x: a.x, y: a.y })
      expect(Vec.Lrp(a, b, 1).toFixed(6)).toEqual(b.clone().toFixed(6))
      expect(Vec.Med(a, b).toFixed(6)).toEqual(Vec.Lrp(a, b, 0.5).toFixed(6))
      if (Vec.Len(a) > 0.001) expect(Vec.Len(Vec.Uni(a))).toBeCloseTo(1, 6)
    }
  })

  it('turns a whole way round back onto itself', () => {
    for (let run = 0; run < 200; run++) {
      const a = new Vec(spread(), spread())
      const whole = Vec.Rot(a, PI * 2)
      expect(whole.x).toBeCloseTo(a.x, 6)
      expect(whole.y).toBeCloseTo(a.y, 6)
      const quarter = Vec.Rot(a, PI / 2)
      expect(Vec.Len(quarter)).toBeCloseTo(Vec.Len(a), 6)
      expect(Vec.Dpr(a, quarter)).toBeCloseTo(0, 5)
    }
  })

  it('keeps the nearest point on a segment inside that segment', () => {
    for (let run = 0; run < 300; run++) {
      const a = new Vec(spread(), spread())
      const b = new Vec(spread(), spread())
      const point = new Vec(spread(), spread())
      const nearest = Vec.NearestPointOnLineSegment(a, b, point, true)
      expect(Vec.Dist(a, nearest) + Vec.Dist(nearest, b)).toBeCloseTo(Vec.Dist(a, b), 4)
      expect(Vec.Dist(point, nearest)).toBeLessThanOrEqual(Vec.Dist(point, a) + 1e-6)
      expect(Vec.Dist(point, nearest)).toBeLessThanOrEqual(Vec.Dist(point, b) + 1e-6)
    }
  })
})

describe('what a box says about the points it was built from', () => {
  it('reads its own edges and corners back', () => {
    const box = new Box(10, 20, 30, 40)
    expect([box.minX, box.minY, box.maxX, box.maxY]).toEqual([10, 20, 40, 60])
    expect(box.center).toMatchObject({ x: 25, y: 40 })
    expect(box.corners.map(corner => [corner.x, corner.y])).toEqual([
      [10, 20],
      [40, 20],
      [40, 60],
      [10, 60]
    ])
  })

  it('holds every point it was built from', () => {
    for (let run = 0; run < 200; run++) {
      const points = Array.from({ length: 2 + Math.floor(random() * 8) }, () => new Vec(spread(), spread()))
      const box = Box.FromPoints(points)
      for (const point of points) expect(box.containsPoint(point, 1e-9)).toBe(true)
      expect(box.w).toBeGreaterThanOrEqual(0)
      expect(box.h).toBeGreaterThanOrEqual(0)
    }
  })

  it('collides either way round and never contains itself', () => {
    for (let run = 0; run < 300; run++) {
      const a = new Box(spread(), spread(), Math.abs(spread(100)) + 1, Math.abs(spread(100)) + 1)
      const b = new Box(spread(), spread(), Math.abs(spread(100)) + 1, Math.abs(spread(100)) + 1)
      if (a.contains(b)) expect(a.collides(b)).toBe(true)
      expect(a.collides(b)).toBe(b.collides(a))
      expect(a.collides(a)).toBe(true)
      expect(a.contains(a)).toBe(false)
    }
  })
})

describe('what a matrix does and undoes', () => {
  it('inverts back onto the point it started from', () => {
    for (let run = 0; run < 200; run++) {
      const matrix = Mat.Compose(
        Mat.Translate(spread(), spread()),
        Mat.Rotate(random() * PI * 2),
        Mat.Scale(1 + random() * 3, 1 + random() * 3)
      )
      const point = new Vec(spread(), spread())
      const back = Mat.applyToPoint(Mat.Inverse(matrix), Mat.applyToPoint(matrix, point))
      expect(back.x).toBeCloseTo(point.x, 5)
      expect(back.y).toBeCloseTo(point.y, 5)
    }
  })

  it('decomposes what it composed, with the turn read the short way', () => {
    for (let run = 0; run < 200; run++) {
      const x = spread()
      const y = spread()
      const rotation = (random() - 0.5) * PI
      const scale = 0.5 + random() * 3
      const decomposed = Mat.Decompose(
        Mat.Compose(Mat.Translate(x, y), Mat.Rotate(rotation), Mat.Scale(scale, scale))
      )
      expect(decomposed.x).toBeCloseTo(x, 5)
      expect(decomposed.y).toBeCloseTo(y, 5)
      expect(decomposed.scaleX).toBeCloseTo(scale, 5)
      expect(Math.cos(decomposed.rotation)).toBeCloseTo(Math.cos(rotation), 5)
      expect(Math.sin(decomposed.rotation)).toBeCloseTo(Math.sin(rotation), 5)
    }
  })

  it('leaves a point where it found it under the identity', () => {
    expect(Mat.applyToPoint(Mat.Identity(), new Vec(3, 7))).toMatchObject({ x: 3, y: 7 })
  })
})
