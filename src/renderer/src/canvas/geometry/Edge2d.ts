import { Vec, type VecLike } from '../math/Vec'
import { Geometry2d } from './Geometry2d'

export class Edge2d extends Geometry2d {
  private start: Vec
  private end: Vec
  private dx: number
  private dy: number
  private len2: number

  constructor(config: { start: Vec; end: Vec }) {
    super({ isClosed: false, isFilled: false })
    const { start, end } = config

    this.start = start
    this.end = end
    this.dx = end.x - start.x
    this.dy = end.y - start.y
    this.len2 = this.dx * this.dx + this.dy * this.dy
  }

  override getVertices(): Vec[] {
    return [this.start, this.end]
  }

  override getLength(): number {
    return Math.sqrt(this.len2)
  }

  override nearestPoint(point: VecLike): Vec {
    const { start, end, dx, dy, len2 } = this
    if (len2 === 0) return start

    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2
    if (t <= 0) return start
    if (t >= 1) return end
    return new Vec(start.x + dx * t, start.y + dy * t)
  }

  override distanceToPoint(point: VecLike): number {
    const { start, end, dx, dy, len2 } = this
    if (len2 === 0) return Vec.Dist(point, start)

    const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2
    let nx: number
    let ny: number
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
    const ex = point.x - nx
    const ey = point.y - ny
    return Math.sqrt(ex * ex + ey * ey)
  }
}
