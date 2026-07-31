import { createElement, type ReactNode } from 'react'
import { CubicSpline2d, Edge2d, Polyline2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { lineShapeProps, type TLLineShapePoint, type TLShape } from '../schema'
import { ShapeUtil, type TLResizeInfo } from './ShapeUtil'
import { COLORS, STROKES } from './shared'

export type TLLineShape = TLShape<'line'>

export function linePoints(shape: TLLineShape): Vec[] {
  return Object.values(shape.props.points).sort((a, b) => a.index.localeCompare(b.index)).map(point => new Vec(point.x, point.y))
}

export class LineShapeUtil extends ShapeUtil<TLLineShape> {
  static override type = 'line' as const
  static override props = lineShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLLineShape['props'] {
    return { dash: 'draw', size: 'm', color: 'black', spline: 'line', points: { a1: { id: 'a1', index: 'a1', x: 0, y: 0 }, a2: { id: 'a2', index: 'a2', x: 0.1, y: 0.1 } }, scale: 1 }
  }
  override canEdit(): boolean { return true }
  override canResize(): boolean { return true }
  getGeometry(shape: TLLineShape): Geometry2d {
    const points = linePoints(shape)
    if (points.length < 2) return new Edge2d({ start: points[0] ?? new Vec(), end: (points[0] ?? new Vec()).clone().addXY(0.1, 0.1) })
    return shape.props.spline === 'cubic' && points.length > 2 ? new CubicSpline2d({ points }) : new Polyline2d({ points })
  }
  override onResize(shape: TLLineShape, info: TLResizeInfo<TLLineShape>): TLLineShape {
    const points: Record<string, TLLineShapePoint> = {}
    for (const [key, point] of Object.entries(shape.props.points)) points[key] = { ...point, x: point.x * info.scaleX, y: point.y * info.scaleY }
    return { ...shape, x: info.newPoint.x, y: info.newPoint.y, props: { ...shape.props, points } }
  }
  component(shape: TLLineShape): ReactNode {
    const width = STROKES[shape.props.size] * shape.props.scale
    const dash = shape.props.dash === 'dashed' ? `${width * 2} ${width * 2}` : shape.props.dash === 'dotted' ? `0 ${width * 2}` : undefined
    return createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } }, createElement('path', { d: this.getGeometry(shape).toSimpleSvgPath(), fill: 'none', stroke: COLORS[shape.props.color], strokeWidth: width, strokeDasharray: dash, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  }
}
