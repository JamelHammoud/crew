import { Box } from '../math/Box'
import { Vec, type VecLike } from '../math/Vec'
import { Geometry2d, Geometry2dFilters, type Geometry2dOptions } from './Geometry2d'

export class Group2d extends Geometry2d {
  children: Geometry2d[] = []
  ignoredChildren: Geometry2d[] = []

  constructor(config: Omit<Geometry2dOptions, 'isClosed' | 'isFilled'> & { children: Geometry2d[] }) {
    super({ ...config, isClosed: true, isFilled: false })

    const addChildren = (children: Geometry2d[]) => {
      for (const child of children) {
        if (child instanceof Group2d) {
          addChildren(child.children)
        } else if (child.ignore) {
          this.ignoredChildren.push(child)
        } else {
          this.children.push(child)
        }
      }
    }

    addChildren(config.children)

    if (this.children.length === 0) throw Error('Group2d must have at least one child')
  }

  override getVertices(filters?: Geometry2dFilters): Vec[] {
    if (this.isExcludedByFilter(filters)) return []
    return this.children.filter(c => !c.isExcludedByFilter(filters)).flatMap(c => c.getVertices(filters))
  }

  override getBoundsVertices(): Vec[] {
    if (this.excludeFromShapeBounds) return []
    return this.children.flatMap(child => child.getBoundsVertices())
  }

  override getArea(): number {
    return this.children[0].area
  }

  override getLength(filters?: Geometry2dFilters): number {
    let length = 0
    for (const child of this.children) {
      if (child.isExcludedByFilter(filters)) continue
      length += child.length
    }
    return length
  }

  override nearestPoint(point: VecLike, filters?: Geometry2dFilters): Vec {
    let dist = Infinity
    let nearest: Vec | undefined

    for (const child of this.children) {
      if (child.isExcludedByFilter(filters)) continue
      const p = child.nearestPoint(point, filters)
      const d = Vec.Dist2(p, point)
      if (d < dist) {
        dist = d
        nearest = p
      }
    }
    if (!nearest) throw Error('nearest point not found')
    return nearest
  }

  override distanceToPoint(
    point: VecLike,
    hitInside = false,
    filters: Geometry2dFilters = Geometry2dFilters.EXCLUDE_LABELS
  ): number {
    let smallest = Infinity
    for (const child of this.children) {
      if (child.isExcludedByFilter(filters)) continue
      const distance = child.distanceToPoint(point, hitInside, filters)
      if (distance < smallest) smallest = distance
    }
    return smallest
  }

  override distanceToLineSegment(
    a: VecLike,
    b: VecLike,
    filters: Geometry2dFilters = Geometry2dFilters.EXCLUDE_LABELS
  ): number {
    let smallest = Infinity
    for (const child of this.children) {
      if (child.isExcludedByFilter(filters)) continue
      const distance = child.distanceToLineSegment(a, b, filters)
      if (distance < smallest) smallest = distance
    }
    return smallest
  }

  override toSimpleSvgPath(): string {
    let path = ''
    for (const child of this.children) {
      path += child.toSimpleSvgPath()
    }

    const corners = Box.FromPoints(this.boundsVertices).corners

    for (let i = 0, n = corners.length; i < n; i++) {
      const corner = corners[i]
      const prevCorner = corners[(i - 1 + n) % n]
      const nextCorner = corners[(i + 1) % n]

      const a = corner.clone().lrp(prevCorner, 4 / corner.dist(prevCorner))
      const c = corner.clone().lrp(nextCorner, 4 / corner.dist(nextCorner))

      path += `M${a.x},${a.y} L${corner.x},${corner.y} L${c.x},${c.y} `
    }
    return path
  }
}
