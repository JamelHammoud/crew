import { Box } from '../math/Box'
import { PI, pointInPolygon } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'
import { Arc2d } from './Arc2d'
import { Edge2d } from './Edge2d'
import { Geometry2d, type Geometry2dOptions } from './Geometry2d'

export class Stadium2d extends Geometry2d {
  readonly w: number
  readonly h: number
  readonly parts: [Arc2d, Edge2d, Arc2d, Edge2d]

  constructor(
    config: Omit<Geometry2dOptions, 'isClosed'> & {
      width: number
      height: number
    }
  ) {
    super({ ...config, isClosed: true })
    const { width: w, height: h } = config
    this.w = w
    this.h = h

    if (h > w) {
      const r = w / 2
      this.parts = [
        new Arc2d({
          start: new Vec(0, r),
          end: new Vec(w, r),
          center: new Vec(w / 2, r),
          sweepFlag: 1,
          largeArcFlag: 1
        }),
        new Edge2d({ start: new Vec(w, r), end: new Vec(w, h - r) }),
        new Arc2d({
          start: new Vec(w, h - r),
          end: new Vec(0, h - r),
          center: new Vec(w / 2, h - r),
          sweepFlag: 1,
          largeArcFlag: 1
        }),
        new Edge2d({ start: new Vec(0, h - r), end: new Vec(0, r) })
      ]
    } else {
      const r = h / 2
      this.parts = [
        new Arc2d({
          start: new Vec(r, h),
          end: new Vec(r, 0),
          center: new Vec(r, r),
          sweepFlag: 1,
          largeArcFlag: 1
        }),
        new Edge2d({ start: new Vec(r, 0), end: new Vec(w - r, 0) }),
        new Arc2d({
          start: new Vec(w - r, 0),
          end: new Vec(w - r, h),
          center: new Vec(w - r, r),
          sweepFlag: 1,
          largeArcFlag: 1
        }),
        new Edge2d({ start: new Vec(w - r, h), end: new Vec(r, h) })
      ]
    }
  }

  override getVertices(): Vec[] {
    return this.parts.flatMap(part => part.vertices)
  }

  override getBounds(): Box {
    return new Box(0, 0, this.w, this.h)
  }

  override getLength(): number {
    const { h, w } = this
    if (h > w) return (PI * (w / 2) + (h - w)) * 2
    return (PI * (h / 2) + (w - h)) * 2
  }

  override nearestPoint(a: VecLike): Vec {
    let nearest: Vec | undefined
    let dist = Infinity
    for (const part of this.parts) {
      const p = part.nearestPoint(a)
      const d = Vec.Dist2(p, a)
      if (d < dist) {
        nearest = p
        dist = d
      }
    }
    if (!nearest) throw Error('nearest point not found')
    return nearest
  }

  override distanceToPoint(point: VecLike, hitInside = false): number {
    let minDist = Infinity
    for (const part of this.parts) {
      const dist = part.distanceToPoint(point)
      if (dist < minDist) minDist = dist
    }
    if (this.isClosed && (this.isFilled || hitInside) && pointInPolygon(point, this.vertices)) {
      return -minDist
    }
    return minDist
  }

  override hitTestLineSegment(a: VecLike, b: VecLike): boolean {
    return this.parts.some(part => part.hitTestLineSegment(a, b))
  }
}
