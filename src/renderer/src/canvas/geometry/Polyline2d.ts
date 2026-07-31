import { pointInPolygon } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'
import { Edge2d } from './Edge2d'
import { Geometry2d, type Geometry2dOptions } from './Geometry2d'

export class Polyline2d extends Geometry2d {
  private points: Vec[]
  private cachedSegments: Edge2d[] | undefined

  constructor(config: Omit<Geometry2dOptions, 'isFilled' | 'isClosed'> & { points: Vec[] }) {
    super({ isClosed: false, isFilled: false, ...config })
    const { points } = config
    this.points = points

    if (points.length < 2) {
      throw new Error('Polyline2d: points must be an array of at least 2 points')
    }
  }

  protected get segments(): Edge2d[] {
    if (this.cachedSegments === undefined) {
      this.cachedSegments = []
      const { vertices } = this
      for (let i = 0, n = vertices.length - 1; i < n; i++) {
        this.cachedSegments.push(new Edge2d({ start: vertices[i], end: vertices[i + 1] }))
      }
      if (this.isClosed) {
        this.cachedSegments.push(new Edge2d({ start: vertices[vertices.length - 1], end: vertices[0] }))
      }
    }

    return this.cachedSegments
  }

  override getVertices(): Vec[] {
    return this.points
  }

  override getLength(): number {
    return this.segments.reduce((acc, segment) => acc + segment.length, 0)
  }

  override nearestPoint(a: VecLike): Vec {
    const { vertices } = this
    let bestX = vertices[0].x
    let bestY = vertices[0].y
    let bestDist2 = (a.x - bestX) * (a.x - bestX) + (a.y - bestY) * (a.y - bestY)

    const limit = this.isClosed ? vertices.length : vertices.length - 1
    for (let i = 0; i < limit; i++) {
      const start = vertices[i]
      const end = vertices[(i + 1) % vertices.length]
      const dx = end.x - start.x
      const dy = end.y - start.y
      const len2 = dx * dx + dy * dy

      let nx: number
      let ny: number
      if (len2 === 0) {
        nx = start.x
        ny = start.y
      } else {
        const t = ((a.x - start.x) * dx + (a.y - start.y) * dy) / len2
        if (t <= 0) {
          nx = start.x
          ny = start.y
        } else if (t >= 1) {
          nx = end.x
          ny = end.y
        } else {
          nx = start.x + dx * t
          ny = start.y + dy * t
        }
      }

      const ex = a.x - nx
      const ey = a.y - ny
      const d2 = ex * ex + ey * ey
      if (d2 < bestDist2) {
        bestX = nx
        bestY = ny
        bestDist2 = d2
      }
    }

    return new Vec(bestX, bestY)
  }

  override distanceToPoint(point: VecLike, hitInside = false): number {
    const { segments } = this
    let minDist = Infinity
    for (let i = 0; i < segments.length; i++) {
      const d = segments[i].distanceToPoint(point)
      if (d < minDist) minDist = d
    }
    if (this.isClosed && (this.isFilled || hitInside) && pointInPolygon(point, this.vertices)) {
      return -minDist
    }
    return minDist
  }

  override hitTestLineSegment(a: VecLike, b: VecLike, distance = 0): boolean {
    const { segments } = this
    for (let i = 0, n = segments.length; i < n; i++) {
      if (segments[i].hitTestLineSegment(a, b, distance)) return true
    }
    return false
  }
}
