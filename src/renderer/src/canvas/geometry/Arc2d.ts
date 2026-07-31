import { getArcMeasure, getPointInArcT, getPointOnCircle } from '../math/utils'
import { Vec, type VecLike } from '../math/Vec'
import { Geometry2d, type Geometry2dOptions, getVerticesCountForArcLength } from './Geometry2d'
import { intersectLineSegmentCircle } from './intersect'

export class Arc2d extends Geometry2d {
  readonly arcCenter: Vec
  readonly radius: number
  readonly start: Vec
  readonly end: Vec
  readonly largeArcFlag: number
  readonly sweepFlag: number
  readonly measure: number
  readonly angleStart: number
  readonly angleEnd: number

  constructor(
    config: Omit<Geometry2dOptions, 'isFilled' | 'isClosed'> & {
      center: Vec
      start: Vec
      end: Vec
      sweepFlag: number
      largeArcFlag: number
    }
  ) {
    super({ ...config, isFilled: false, isClosed: false })
    const { center, sweepFlag, largeArcFlag, start, end } = config
    if (start.equals(end)) throw Error('Arc must have different start and end points.')

    this.angleStart = Vec.Angle(center, start)
    this.angleEnd = Vec.Angle(center, end)
    this.radius = Vec.Dist(center, start)
    this.measure = getArcMeasure(this.angleStart, this.angleEnd, sweepFlag, largeArcFlag)

    this.start = start
    this.end = end
    this.sweepFlag = sweepFlag
    this.largeArcFlag = largeArcFlag
    this.arcCenter = center
  }

  override getVertices(): Vec[] {
    const { arcCenter, measure, length, radius, angleStart } = this
    const vertices: Vec[] = []
    for (let i = 0, n = getVerticesCountForArcLength(Math.abs(length)); i < n + 1; i++) {
      vertices.push(getPointOnCircle(arcCenter, radius, angleStart + (i / n) * measure))
    }
    return vertices
  }

  override getLength(): number {
    return Math.abs(this.measure * this.radius)
  }

  override nearestPoint(point: VecLike): Vec {
    const { arcCenter, measure, radius, angleEnd, angleStart, start, end } = this
    const t = getPointInArcT(measure, angleStart, angleEnd, arcCenter.angle(point))
    if (t <= 0) return start
    if (t >= 1) return end

    const dx = point.x - arcCenter.x
    const dy = point.y - arcCenter.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) return start
    const scale = radius / len
    return new Vec(arcCenter.x + dx * scale, arcCenter.y + dy * scale)
  }

  override hitTestLineSegment(a: VecLike, b: VecLike): boolean {
    const { arcCenter, radius, measure, angleStart, angleEnd } = this
    const intersection = intersectLineSegmentCircle(a, b, arcCenter, radius)
    if (intersection === null) return false

    return intersection.some(p => {
      const t = getPointInArcT(measure, angleStart, angleEnd, arcCenter.angle(p))
      return t >= 0 && t <= 1
    })
  }
}
