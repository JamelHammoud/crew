import { Vec, type VecLike } from './Vec'

export const PI = Math.PI
export const HALF_PI = PI / 2
export const PI2 = PI * 2
export const SIN = Math.sin
export const EPSILON = 0.000001

export function clamp(n: number, min: number, max?: number): number {
  return Math.max(min, typeof max !== 'undefined' ? Math.min(n, max) : n)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function invLerp(a: number, b: number, t: number): number {
  return (t - a) / (b - a)
}

export function approximately(a: number, b: number, precision = EPSILON): boolean {
  return Math.abs(a - b) <= precision
}

export function approximatelyLte(a: number, b: number, precision = EPSILON): boolean {
  return a < b || approximately(a, b, precision)
}

export function toPrecision(n: number, precision = 10000000000): number {
  if (!n) return 0
  return Math.round(n * precision) / precision
}

export function toDomPrecision(v: number): number {
  return Math.round(v * 1e4) / 1e4
}

export function toFixed(v: number): number {
  return Math.round(v * 1e2) / 1e2
}

export function precise(a: VecLike): string {
  return `${toDomPrecision(a.x)},${toDomPrecision(a.y)} `
}

export function isSafeFloat(n: number): boolean {
  return Math.abs(n) < Number.MAX_SAFE_INTEGER
}

export function perimeterOfEllipse(rx: number, ry: number): number {
  const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2)
  return PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

export function canonicalizeRotation(a: number): number {
  a = a % PI2
  if (a < 0) {
    a = a + PI2
  } else if (a === 0) {
    a = 0
  }
  return a
}

export function clampRadians(r: number): number {
  return (PI2 + r) % PI2
}

export function clockwiseAngleDist(a0: number, a1: number): number {
  a0 = canonicalizeRotation(a0)
  a1 = canonicalizeRotation(a1)
  if (a0 > a1) {
    a1 += PI2
  }
  return a1 - a0
}

export function counterClockwiseAngleDist(a0: number, a1: number): number {
  return PI2 - clockwiseAngleDist(a0, a1)
}

export function shortAngleDist(a0: number, a1: number): number {
  const da = (a1 - a0) % PI2
  return ((2 * da) % PI2) - da
}

export function angleDistance(fromAngle: number, toAngle: number, direction: number): number {
  return direction < 0 ? clockwiseAngleDist(fromAngle, toAngle) : counterClockwiseAngleDist(fromAngle, toAngle)
}

export function degreesToRadians(d: number): number {
  return (d * PI) / 180
}

export function radiansToDegrees(r: number): number {
  return (r * 180) / PI
}

export function getArcMeasure(a: number, b: number, sweepFlag: number, largeArcFlag: number): number {
  const m = ((2 * ((b - a) % PI2)) % PI2) - ((b - a) % PI2)
  if (!largeArcFlag) return m
  return (PI2 - Math.abs(m)) * (sweepFlag ? 1 : -1)
}

export function getPointInArcT(mAB: number, a: number, b: number, p: number): number {
  let mAP: number
  if (Math.abs(mAB) > PI) {
    mAP = shortAngleDist(a, p)
    const mPB = shortAngleDist(p, b)
    if (Math.abs(mAP) < Math.abs(mPB)) {
      return mAP / mAB
    }
    return (mAB - mPB) / mAB
  }
  mAP = shortAngleDist(a, p)
  const t = mAP / mAB
  if (Math.sign(mAP) !== Math.sign(mAB)) {
    return Math.abs(t) > 0.5 ? 1 : 0
  }
  return t
}

export function getPointOnCircle(center: VecLike, r: number, a: number): Vec {
  return new Vec(center.x, center.y).add(Vec.FromAngle(a, r))
}

export function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 && b0 < a1
}

export function rangeIntersection(a0: number, a1: number, b0: number, b1: number): [number, number] | null {
  const min = Math.max(a0, b0)
  const max = Math.min(a1, b1)
  if (min <= max) return [min, max]
  return null
}

function cross(x: VecLike, y: VecLike, z: VecLike): number {
  return (y.x - x.x) * (z.y - x.y) - (z.x - x.x) * (y.y - x.y)
}

export function pointInPolygon(a: VecLike, points: VecLike[]): boolean {
  let windingNumber = 0
  let p: VecLike
  let q: VecLike

  for (let i = 0; i < points.length; i++) {
    p = points[i]
    if (p.x === a.x && p.y === a.y) return true

    q = points[(i + 1) % points.length]

    if (p.y <= a.y) {
      if (q.y > a.y && cross(p, q, a) > 0) {
        windingNumber += 1
      }
    } else if (q.y <= a.y && cross(p, q, a) < 0) {
      windingNumber -= 1
    }
  }

  return windingNumber !== 0
}

function ccw(a: VecLike, b: VecLike, c: VecLike): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x)
}

export function linesIntersect(a: VecLike, b: VecLike, c: VecLike, d: VecLike): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d)
}

export function centerOfCircleFromThreePoints(a: VecLike, b: VecLike, c: VecLike): Vec | null {
  const u = -2 * (a.x * (b.y - c.y) - a.y * (b.x - c.x) + b.x * c.y - c.x * b.y)
  const x =
    ((a.x * a.x + a.y * a.y) * (c.y - b.y) +
      (b.x * b.x + b.y * b.y) * (a.y - c.y) +
      (c.x * c.x + c.y * c.y) * (b.y - a.y)) /
    u
  const y =
    ((a.x * a.x + a.y * a.y) * (b.x - c.x) +
      (b.x * b.x + b.y * b.y) * (c.x - a.x) +
      (c.x * c.x + c.y * c.y) * (a.x - b.x)) /
    u
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return new Vec(x, y)
}
