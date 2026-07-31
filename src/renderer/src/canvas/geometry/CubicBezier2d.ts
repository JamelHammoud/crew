import { Vec, type VecLike } from '../math/Vec'
import { type Geometry2dOptions } from './Geometry2d'
import { Polyline2d } from './Polyline2d'

export class CubicBezier2d extends Polyline2d {
  readonly a: Vec
  readonly b: Vec
  readonly c: Vec
  readonly d: Vec
  readonly resolution: number

  constructor(
    config: Omit<Geometry2dOptions, 'isFilled' | 'isClosed'> & {
      start: Vec
      cp1: Vec
      cp2: Vec
      end: Vec
      resolution?: number
    }
  ) {
    const { start, cp1, cp2, end } = config
    super({ ...config, points: [start, end] })

    this.a = start
    this.b = cp1
    this.c = cp2
    this.d = end
    this.resolution = config.resolution ?? 10
  }

  override getVertices(): Vec[] {
    const vertices: Vec[] = []
    for (let i = 0, n = this.resolution; i <= n; i++) {
      vertices.push(CubicBezier2d.GetAtT(this, i / n))
    }
    return vertices
  }

  override getLength(): number {
    return this.getLengthAtPrecision(32)
  }

  getLengthAtPrecision(precision: number): number {
    let p1 = this.a
    let length = 0
    for (let i = 1; i <= precision; i++) {
      const n1 = CubicBezier2d.GetAtT(this, i / precision)
      length += Vec.Dist(p1, n1)
      p1 = n1
    }
    return length
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

  static GetAtT(segment: CubicBezier2d, t: number): Vec {
    const { a, b, c, d } = segment
    const u = 1 - t
    return new Vec(
      u * u * u * a.x + 3 * (u * u) * t * b.x + 3 * u * (t * t) * c.x + t * t * t * d.x,
      u * u * u * a.y + 3 * (u * u) * t * b.y + 3 * u * (t * t) * c.y + t * t * t * d.y
    )
  }
}
