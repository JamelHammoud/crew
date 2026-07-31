import { Box } from '../math/Box'
import { getPointOnCircle, PI2 } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'
import { Geometry2d, type Geometry2dOptions, getVerticesCountForArcLength } from './Geometry2d'
import { intersectLineSegmentCircle } from './intersect'

export class Circle2d extends Geometry2d {
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly circleCenter: Vec

  constructor(
    config: Omit<Geometry2dOptions, 'isClosed'> & {
      x?: number
      y?: number
      radius: number
    }
  ) {
    super({ isClosed: true, ...config })
    const { x = 0, y = 0, radius } = config
    this.x = x
    this.y = y
    this.radius = radius
    this.circleCenter = new Vec(radius + x, radius + y)
  }

  override getBounds(): Box {
    return new Box(this.x, this.y, this.radius * 2, this.radius * 2)
  }

  override getVertices(): Vec[] {
    const { circleCenter, radius } = this
    const perimeter = PI2 * radius
    const vertices: Vec[] = []
    for (let i = 0, n = getVerticesCountForArcLength(perimeter); i < n; i++) {
      vertices.push(getPointOnCircle(circleCenter, radius, (i / n) * PI2))
    }
    return vertices
  }

  override nearestPoint(point: VecLike): Vec {
    const { circleCenter, radius } = this
    const dx = point.x - circleCenter.x
    const dy = point.y - circleCenter.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return new Vec(circleCenter.x + radius, circleCenter.y)
    const scale = radius / len
    return new Vec(circleCenter.x + dx * scale, circleCenter.y + dy * scale)
  }

  override distanceToPoint(point: VecLike, hitInside = false): number {
    const { circleCenter, radius } = this
    const dx = point.x - circleCenter.x
    const dy = point.y - circleCenter.y
    const distToEdge = Math.sqrt(dx * dx + dy * dy) - radius
    if (distToEdge < 0 && (this.isFilled || hitInside)) return distToEdge
    return Math.abs(distToEdge)
  }

  override hitTestLineSegment(a: VecLike, b: VecLike, distance = 0): boolean {
    const { circleCenter, radius } = this
    return intersectLineSegmentCircle(a, b, circleCenter, radius + distance) !== null
  }
}
