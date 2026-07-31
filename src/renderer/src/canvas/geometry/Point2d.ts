import { Vec, type VecLike } from '../math/Vec'
import { Geometry2d, type Geometry2dOptions } from './Geometry2d'

export class Point2d extends Geometry2d {
  readonly point: Vec

  constructor(config: Omit<Geometry2dOptions, 'isClosed' | 'isFilled'> & { margin: number; point: Vec }) {
    super({ ...config, isClosed: true, isFilled: true })
    this.point = config.point
  }

  override getVertices(): Vec[] {
    return [this.point]
  }

  override nearestPoint(): Vec {
    return this.point
  }

  override hitTestLineSegment(a: VecLike, b: VecLike, margin = 0): boolean {
    return Vec.DistanceToLineSegment(a, b, this.point) < margin
  }
}
