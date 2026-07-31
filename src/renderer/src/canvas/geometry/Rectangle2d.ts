import { Box } from '../math/Box'
import { Vec } from '../math/Vec'
import { type Geometry2dOptions } from './Geometry2d'
import { Polygon2d } from './Polygon2d'

export class Rectangle2d extends Polygon2d {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number

  constructor(
    config: Omit<Geometry2dOptions, 'isClosed'> & {
      x?: number
      y?: number
      width: number
      height: number
    }
  ) {
    const { x = 0, y = 0, width, height } = config
    super({
      ...config,
      points: [new Vec(x, y), new Vec(x + width, y), new Vec(x + width, y + height), new Vec(x, y + height)]
    })
    this.x = x
    this.y = y
    this.w = width
    this.h = height
  }

  override getBounds(): Box {
    return new Box(this.x, this.y, this.w, this.h)
  }
}
