import { Box } from '../math/Box'
import { clamp, PI, PI2, perimeterOfEllipse, pointInPolygon } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'
import { Edge2d } from './Edge2d'
import { Geometry2d, type Geometry2dOptions, getVerticesCountForArcLength } from './Geometry2d'

export class Ellipse2d extends Geometry2d {
  readonly w: number
  readonly h: number
  private cachedEdges: Edge2d[] | undefined

  constructor(
    config: Omit<Geometry2dOptions, 'isClosed'> & {
      width: number
      height: number
    }
  ) {
    super({ ...config, isClosed: true })
    this.w = config.width
    this.h = config.height
  }

  get edges(): Edge2d[] {
    if (this.cachedEdges === undefined) {
      const { vertices } = this
      this.cachedEdges = []
      for (let i = 0, n = vertices.length; i < n; i++) {
        this.cachedEdges.push(new Edge2d({ start: vertices[i], end: vertices[(i + 1) % n] }))
      }
    }

    return this.cachedEdges
  }

  override getVertices(): Vec[] {
    const w = Math.max(1, this.w)
    const h = Math.max(1, this.h)
    const cx = w / 2
    const cy = h / 2
    const q = Math.pow(cx - cy, 2) / Math.pow(cx + cy, 2)
    const p = PI * (cx + cy) * (1 + (3 * q) / (10 + Math.sqrt(4 - 3 * q)))
    const len = getVerticesCountForArcLength(p)
    const step = PI2 / len

    const a = Math.cos(step)
    const b = Math.sin(step)

    let sin = 0
    let cos = 1

    const vertices: Vec[] = Array(len)

    for (let i = 0; i < len; i++) {
      vertices[i] = new Vec(clamp(cx + cx * cos, 0, w), clamp(cy + cy * sin, 0, h))
      const ts = b * cos + a * sin
      const tc = a * cos - b * sin
      sin = ts
      cos = tc
    }

    return vertices
  }

  override getBounds(): Box {
    return new Box(0, 0, this.w, this.h)
  }

  override getLength(): number {
    return perimeterOfEllipse(Math.max(0, this.w / 2), Math.max(0, this.h / 2))
  }

  override nearestPoint(a: VecLike): Vec {
    let nearest: Vec | undefined
    let dist = Infinity
    for (const edge of this.edges) {
      const p = edge.nearestPoint(a)
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
    const { edges } = this
    let minDist = Infinity
    for (let i = 0; i < edges.length; i++) {
      const d = edges[i].distanceToPoint(point)
      if (d < minDist) minDist = d
    }
    if (this.isClosed && (this.isFilled || hitInside) && pointInPolygon(point, this.vertices)) {
      return -minDist
    }
    return minDist
  }

  override hitTestLineSegment(a: VecLike, b: VecLike): boolean {
    return this.edges.some(edge => edge.hitTestLineSegment(a, b))
  }
}
