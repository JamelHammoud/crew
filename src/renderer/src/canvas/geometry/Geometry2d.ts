import { Box } from '../math/Box'
import { linesIntersect, pointInPolygon } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'

const ARC_SPACING = 20
const ARC_MIN_COUNT = 8

export function getVerticesCountForArcLength(length: number, spacing = ARC_SPACING): number {
  return Math.max(ARC_MIN_COUNT, Math.ceil(length / spacing))
}

export interface Geometry2dFilters {
  readonly includeLabels?: boolean
  readonly includeInternal?: boolean
}

export const Geometry2dFilters: {
  EXCLUDE_NON_STANDARD: Geometry2dFilters
  INCLUDE_ALL: Geometry2dFilters
  EXCLUDE_LABELS: Geometry2dFilters
  EXCLUDE_INTERNAL: Geometry2dFilters
} = {
  EXCLUDE_NON_STANDARD: { includeLabels: false, includeInternal: false },
  INCLUDE_ALL: { includeLabels: true, includeInternal: true },
  EXCLUDE_LABELS: { includeLabels: false, includeInternal: true },
  EXCLUDE_INTERNAL: { includeLabels: true, includeInternal: false }
}

export interface Geometry2dOptions {
  isFilled: boolean
  isClosed: boolean
  isLabel?: boolean
  isEmptyLabel?: boolean
  isInternal?: boolean
  excludeFromShapeBounds?: boolean
  ignore?: boolean
  debugColor?: string
}

export abstract class Geometry2d {
  isFilled = false
  isClosed = true
  isLabel = false
  isEmptyLabel = false
  isInternal = false
  excludeFromShapeBounds = false
  ignore?: boolean
  debugColor?: string

  private cachedVertices: Vec[] | undefined
  private cachedBoundsVertices: Vec[] | undefined
  private cachedBounds: Box | undefined
  private cachedArea: number | undefined
  private cachedLength: number | undefined

  constructor(opts: Geometry2dOptions) {
    this.isFilled = opts.isFilled
    this.isClosed = opts.isClosed
    this.isLabel = opts.isLabel ?? false
    this.isEmptyLabel = opts.isEmptyLabel ?? false
    this.isInternal = opts.isInternal ?? false
    this.excludeFromShapeBounds = opts.excludeFromShapeBounds ?? false
    this.ignore = opts.ignore
    this.debugColor = opts.debugColor
  }

  abstract getVertices(filters?: Geometry2dFilters): Vec[]

  abstract nearestPoint(point: VecLike, filters?: Geometry2dFilters): Vec

  isExcludedByFilter(filters?: Geometry2dFilters): boolean {
    if (!filters) return false
    if (this.isLabel && !filters.includeLabels) return true
    if (this.isInternal && !filters.includeInternal) return true
    return false
  }

  get vertices(): Vec[] {
    if (this.cachedVertices === undefined) {
      this.cachedVertices = this.getVertices(Geometry2dFilters.EXCLUDE_LABELS)
    }
    return this.cachedVertices
  }

  getBoundsVertices(): Vec[] {
    if (this.excludeFromShapeBounds) return []
    return this.vertices
  }

  get boundsVertices(): Vec[] {
    if (this.cachedBoundsVertices === undefined) {
      this.cachedBoundsVertices = this.getBoundsVertices()
    }
    return this.cachedBoundsVertices
  }

  getBounds(): Box {
    return Box.FromPoints(this.boundsVertices)
  }

  get bounds(): Box {
    if (this.cachedBounds === undefined) {
      this.cachedBounds = this.getBounds()
    }
    return this.cachedBounds
  }

  get center(): Vec {
    return this.bounds.center
  }

  getArea(): number {
    if (!this.isClosed) return 0
    const { vertices } = this
    let area = 0
    for (let i = 0, n = vertices.length; i < n; i++) {
      const curr = vertices[i]
      const next = vertices[(i + 1) % n]
      area += curr.x * next.y - next.x * curr.y
    }
    return area / 2
  }

  get area(): number {
    if (this.cachedArea === undefined) {
      this.cachedArea = this.getArea()
    }
    return this.cachedArea
  }

  getLength(filters?: Geometry2dFilters): number {
    const vertices = this.getVertices(filters ?? Geometry2dFilters.EXCLUDE_LABELS)
    if (vertices.length === 0) return 0
    let prev = vertices[0]
    let length = 0
    for (let i = 1; i < vertices.length; i++) {
      const next = vertices[i]
      length += Vec.Dist(prev, next)
      prev = next
    }
    if (this.isClosed) {
      length += Vec.Dist(vertices[vertices.length - 1], vertices[0])
    }
    return length
  }

  get length(): number {
    if (this.cachedLength === undefined) {
      this.cachedLength = this.getLength(Geometry2dFilters.EXCLUDE_LABELS)
    }
    return this.cachedLength
  }

  distanceToPoint(point: VecLike, hitInside = false, filters?: Geometry2dFilters): number {
    return (
      Vec.Dist(point, this.nearestPoint(point, filters)) *
      (this.isClosed && (this.isFilled || hitInside) && pointInPolygon(point, this.vertices) ? -1 : 1)
    )
  }

  hitTestPoint(point: VecLike, margin = 0, hitInside = false, filters?: Geometry2dFilters): boolean {
    return this.distanceToPoint(point, hitInside, filters) <= margin
  }

  distanceToLineSegment(a: VecLike, b: VecLike, filters?: Geometry2dFilters): number {
    if (Vec.Equals(a, b)) return this.distanceToPoint(a, false, filters)
    const { vertices } = this
    if (vertices.length === 0) throw Error('nearest point not found')
    if (vertices.length === 1) return Vec.Dist(a, vertices[0])
    let nearest: Vec | undefined
    let dist = Infinity
    let d: number
    let p: Vec
    let q: Vec
    const nextLimit = this.isClosed ? vertices.length : vertices.length - 1
    for (let i = 0; i < vertices.length; i++) {
      p = vertices[i]
      if (i < nextLimit) {
        const next = vertices[(i + 1) % vertices.length]
        if (linesIntersect(a, b, p, next)) return 0
      }
      q = Vec.NearestPointOnLineSegment(a, b, p, true)
      d = Vec.Dist2(p, q)
      if (d < dist) {
        dist = d
        nearest = q
      }
    }
    if (!nearest) throw Error('nearest point not found')
    dist = Math.sqrt(dist)
    return this.isClosed && this.isFilled && pointInPolygon(nearest, this.vertices) ? -dist : dist
  }

  hitTestLineSegment(a: VecLike, b: VecLike, distance = 0, filters?: Geometry2dFilters): boolean {
    return this.distanceToLineSegment(a, b, filters) <= distance
  }

  overlapsPolygon(polygon: VecLike[]): boolean {
    const { vertices, center, isFilled, isEmptyLabel, isClosed } = this

    if (isEmptyLabel) return false

    if (vertices.some(vertex => pointInPolygon(vertex, polygon))) return true

    if (!isClosed) return polygonIntersectsPolyline(polygon, vertices)

    if (isFilled) {
      if (pointInPolygon(center, polygon)) return true
      if (polygon.every(vertex => pointInPolygon(vertex, vertices))) return true
    }

    return polygonsIntersect(polygon, vertices)
  }

  isPointInBounds(point: VecLike, margin = 0): boolean {
    const { bounds } = this
    return !(
      point.x < bounds.minX - margin ||
      point.y < bounds.minY - margin ||
      point.x > bounds.maxX + margin ||
      point.y > bounds.maxY + margin
    )
  }

  ignoreHit(_point: VecLike): boolean {
    return false
  }

  toSimpleSvgPath(): string {
    let path = ''

    const { vertices } = this
    const n = vertices.length

    if (n === 0) return path

    path += `M${vertices[0].x},${vertices[0].y}`

    for (let i = 1; i < n; i++) {
      path += `L${vertices[i].x},${vertices[i].y}`
    }

    if (this.isClosed) {
      path += 'Z'
    }

    return path
  }
}
