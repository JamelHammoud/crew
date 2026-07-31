import { Vec, type VecLike } from '../math/Vec'
import { CubicBezier2d } from './CubicBezier2d'
import { Geometry2d, type Geometry2dOptions } from './Geometry2d'

const TENSION = 1.25

export class CubicSpline2d extends Geometry2d {
  readonly points: Vec[]
  private cachedSegments: CubicBezier2d[] | undefined

  constructor(config: Omit<Geometry2dOptions, 'isClosed' | 'isFilled'> & { points: Vec[] }) {
    super({ ...config, isClosed: false, isFilled: false })
    this.points = config.points
  }

  get segments(): CubicBezier2d[] {
    if (this.cachedSegments === undefined) {
      this.cachedSegments = []
      const { points } = this
      const len = points.length
      const last = len - 2

      for (let i = 0; i < len - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i - 1]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = i === last ? p2 : points[i + 2]
        const cp1 = i === 0 ? p0 : new Vec(p1.x + ((p2.x - p0.x) / 6) * TENSION, p1.y + ((p2.y - p0.y) / 6) * TENSION)
        const cp2 =
          i === last ? p2 : new Vec(p2.x - ((p3.x - p1.x) / 6) * TENSION, p2.y - ((p3.y - p1.y) / 6) * TENSION)

        this.cachedSegments.push(new CubicBezier2d({ start: p1, cp1, cp2, end: p2 }))
      }
    }

    return this.cachedSegments
  }

  override getVertices(): Vec[] {
    const vertices = this.segments.reduce<Vec[]>((acc, segment) => acc.concat(segment.vertices), [])
    vertices.push(this.points[this.points.length - 1])
    return vertices
  }

  override getLength(): number {
    return this.segments.reduce((acc, segment) => acc + segment.length, 0)
  }

  override nearestPoint(a: VecLike): Vec {
    let nearest: Vec | undefined
    let dist = Infinity
    for (const segment of this.segments) {
      const p = segment.nearestPoint(a)
      const d = Vec.Dist2(p, a)
      if (d < dist) {
        nearest = p
        dist = d
      }
    }
    if (!nearest) throw Error('nearest point not found')
    return nearest
  }

  override distanceToPoint(point: VecLike): number {
    const { segments } = this
    let minDist = Infinity
    for (let i = 0; i < segments.length; i++) {
      const d = segments[i].distanceToPoint(point)
      if (d < minDist) minDist = d
    }
    return minDist
  }

  override hitTestLineSegment(a: VecLike, b: VecLike): boolean {
    return this.segments.some(segment => segment.hitTestLineSegment(a, b))
  }
}
