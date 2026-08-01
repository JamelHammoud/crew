import type { Vec, VecLike } from '../math/Vec'
import { computeRadii, strokePoints } from './freehand/points'
import { strokeOutline } from './freehand/outline'
import type { StrokeOptions } from './freehand/types'

export type { StrokeOptions, StrokePoint } from './freehand/types'
export { freehandOptions, highlightOptions } from './freehand/options'
export { strokePoints, computeRadii } from './freehand/points'
export { strokeOutline, strokeTracks } from './freehand/outline'

export function freehandCenterline(input: readonly VecLike[], options: StrokeOptions = {}): Vec[] {
  return strokePoints(input, options).map(point => point.point)
}

export function freehandOutline(input: readonly VecLike[], options: StrokeOptions = {}): Vec[] {
  const points = strokePoints(input, options)
  if (points.length === 0) return []
  computeRadii(points, options)
  return strokeOutline(points, options)
}
