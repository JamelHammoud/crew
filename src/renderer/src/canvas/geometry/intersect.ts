import { type Box } from '../math/Box'
import { linesIntersect, pointInPolygon } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'

export function intersectLineSegmentLineSegment(
  a1: VecLike,
  a2: VecLike,
  b1: VecLike,
  b2: VecLike,
  precision = 1e-10
): Vec | null {
  const abx = a1.x - b1.x
  const aby = a1.y - b1.y
  const bvx = b2.x - b1.x
  const bvy = b2.y - b1.y
  const avx = a2.x - a1.x
  const avy = a2.y - a1.y
  const uaT = bvx * aby - bvy * abx
  const ubT = avx * aby - avy * abx
  const uB = bvy * avx - bvx * avy

  if (Math.abs(uaT) <= precision || Math.abs(ubT) <= precision) return null
  if (Math.abs(uB) <= precision) return null

  const ua = uaT / uB
  const ub = ubT / uB

  if (ua >= -precision && ua <= 1 + precision && ub >= -precision && ub <= 1 + precision) {
    return new Vec(a1.x + ua * avx, a1.y + ua * avy)
  }

  return null
}

export function intersectLineSegmentCircle(a1: VecLike, a2: VecLike, c: VecLike, r: number): VecLike[] | null {
  const dx = a2.x - a1.x
  const dy = a2.y - a1.y
  const ocx = a1.x - c.x
  const ocy = a1.y - c.y

  const a = dx * dx + dy * dy
  const b = 2 * (dx * ocx + dy * ocy)
  const cc = ocx * ocx + ocy * ocy - r * r
  const deter = b * b - 4 * a * cc

  if (deter <= 0) return null

  const e = Math.sqrt(deter)
  const u1 = (-b + e) / (2 * a)
  const u2 = (-b - e) / (2 * a)

  if ((u1 < 0 || u1 > 1) && (u2 < 0 || u2 > 1)) return null

  const result: VecLike[] = []

  if (u1 >= 0 && u1 <= 1) result.push(new Vec(a1.x + dx * u1, a1.y + dy * u1))
  if (u2 >= 0 && u2 <= 1) result.push(new Vec(a1.x + dx * u2, a1.y + dy * u2))

  if (result.length === 0) return null

  return result
}

export function intersectLineSegmentPolyline(a1: VecLike, a2: VecLike, points: VecLike[]): VecLike[] | null {
  const result: VecLike[] = []

  for (let i = 0, n = points.length - 1; i < n; i++) {
    const hit = intersectLineSegmentLineSegment(a1, a2, points[i], points[i + 1])
    if (hit) result.push(hit)
  }

  if (result.length === 0) return null

  return result
}

export function intersectLineSegmentPolygon(a1: VecLike, a2: VecLike, points: VecLike[]): VecLike[] | null {
  const result: VecLike[] = []

  for (let i = 1, n = points.length; i < n + 1; i++) {
    const hit = intersectLineSegmentLineSegment(a1, a2, points[i - 1], points[i % points.length])
    if (hit) result.push(hit)
  }

  if (result.length === 0) return null

  return result
}

export function intersectCircleCircle(c1: VecLike, r1: number, c2: VecLike, r2: number): VecLike[] {
  let dx = c2.x - c1.x
  let dy = c2.y - c1.y
  const d = Math.sqrt(dx * dx + dy * dy)
  const x = (d * d - r2 * r2 + r1 * r1) / (2 * d)
  const y = Math.sqrt(r1 * r1 - x * x)
  dx /= d
  dy /= d
  return [
    new Vec(c1.x + dx * x - dy * y, c1.y + dy * x + dx * y),
    new Vec(c1.x + dx * x + dy * y, c1.y + dy * x - dx * y)
  ]
}

export function intersectCirclePolygon(c: VecLike, r: number, points: VecLike[]): VecLike[] | null {
  const result: VecLike[] = []

  for (let i = 0, n = points.length; i < n; i++) {
    const hit = intersectLineSegmentCircle(points[i], points[(i + 1) % n], c, r)
    if (hit) result.push(...hit)
  }

  if (result.length === 0) return null

  return result
}

export function intersectCirclePolyline(c: VecLike, r: number, points: VecLike[]): VecLike[] | null {
  const result: VecLike[] = []

  for (let i = 1, n = points.length; i < n; i++) {
    const hit = intersectLineSegmentCircle(points[i - 1], points[i], c, r)
    if (hit) result.push(...hit)
  }

  if (result.length === 0) return null

  return result
}

export function intersectPolygonBounds(points: VecLike[], bounds: Box): VecLike[] | null {
  const result: VecLike[] = []

  for (const side of bounds.sides) {
    const hit = intersectLineSegmentPolygon(side[0], side[1], points)
    if (hit) result.push(...hit)
  }

  if (result.length === 0) return null

  return result
}

export function intersectPolygonPolygon(polygonA: VecLike[], polygonB: VecLike[]): VecLike[] | null {
  const result = new Map<string, VecLike>()

  const keep = (point: VecLike) => {
    const id = `${point.x},${point.y}`
    if (!result.has(id)) result.set(id, point)
  }

  for (let i = 0, n = polygonA.length; i < n; i++) {
    if (pointInPolygon(polygonA[i], polygonB)) keep(polygonA[i])
  }

  for (let i = 0, n = polygonB.length; i < n; i++) {
    if (pointInPolygon(polygonB[i], polygonA)) keep(polygonB[i])
  }

  for (let i = 0, n = polygonA.length; i < n; i++) {
    const a = polygonA[i]
    const b = polygonA[(i + 1) % n]

    for (let j = 0, m = polygonB.length; j < m; j++) {
      const hit = intersectLineSegmentLineSegment(a, b, polygonB[j], polygonB[(j + 1) % m])
      if (hit !== null) keep(hit)
    }
  }

  if (result.size === 0) return null

  const points = [...result.values()]
  const c = Vec.Average(points)
  return points.sort((a, b) => Vec.Angle(c, a) - Vec.Angle(c, b))
}

export function intersectPolys(polyA: VecLike[], polyB: VecLike[], isAClosed: boolean, isBClosed: boolean): VecLike[] {
  const result = new Map<string, VecLike>()

  for (let i = 0, n = isAClosed ? polyA.length : polyA.length - 1; i < n; i++) {
    const currentA = polyA[i]
    const nextA = polyA[(i + 1) % polyA.length]

    for (let j = 0, m = isBClosed ? polyB.length : polyB.length - 1; j < m; j++) {
      const hit = intersectLineSegmentLineSegment(currentA, nextA, polyB[j], polyB[(j + 1) % polyB.length])
      if (hit !== null) {
        const id = `${hit.x},${hit.y}`
        if (!result.has(id)) result.set(id, hit)
      }
    }
  }

  return [...result.values()]
}

export function polygonsIntersect(a: VecLike[], b: VecLike[]): boolean {
  for (let i = 0, n = a.length; i < n; i++) {
    const a0 = a[i]
    const a1 = a[(i + 1) % n]
    for (let j = 0, m = b.length; j < m; j++) {
      if (linesIntersect(a0, a1, b[j], b[(j + 1) % m])) return true
    }
  }
  return false
}

export function polygonIntersectsPolyline(polygon: VecLike[], polyline: VecLike[]): boolean {
  for (let i = 0, n = polygon.length; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]

    for (let j = 1, m = polyline.length; j < m; j++) {
      if (linesIntersect(a, b, polyline[j - 1], polyline[j])) return true
    }
  }
  return false
}
