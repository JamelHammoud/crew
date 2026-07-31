import { createElement, type ReactNode } from 'react'
import { CubicSpline2d, Edge2d, Polyline2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { lineShapeProps, type TLLineShapePoint as LinePoint, type TLShape as CrewShape } from '../schema'
import {
  ShapeUtil,
  type CrewShapePartial,
  type ShapeHandle,
  type ShapeHandleDragInfo,
  type ShapeResizeInfo
} from './ShapeUtil'
import { STROKES } from './shared'
import { shapeColor } from './theme'

export type LineShape = CrewShape<'line'>

export function linePoints(shape: LineShape): Vec[] {
  return Object.values(shape.props.points)
    .sort((a, b) => a.index.localeCompare(b.index))
    .map(point => new Vec(point.x, point.y))
}

export class LineShapeUtil extends ShapeUtil<LineShape> {
  static override type = 'line' as const
  static override props = lineShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): LineShape['props'] {
    return {
      dash: 'draw',
      size: 'm',
      color: 'black',
      spline: 'line',
      points: { a1: { id: 'a1', index: 'a1', x: 0, y: 0 }, a2: { id: 'a2', index: 'a2', x: 0.1, y: 0.1 } },
      scale: 1
    }
  }
  override canEdit(): boolean {
    return true
  }
  override canResize(): boolean {
    return true
  }
  override getHandles(shape: LineShape): ShapeHandle[] {
    return Object.values(shape.props.points)
      .sort((a, b) => a.index.localeCompare(b.index))
      .map(point => ({ ...point, type: 'vertex', canSnap: true }))
  }
  override onHandleDrag(shape: LineShape, info: ShapeHandleDragInfo<LineShape>): CrewShapePartial<LineShape> | void {
    const point = shape.props.points[info.handle.id]
    if (!point) return
    return {
      id: shape.id,
      type: 'line',
      props: {
        points: {
          ...shape.props.points,
          [point.id]: { ...point, x: info.handle.x, y: info.handle.y }
        }
      }
    }
  }
  getGeometry(shape: LineShape): Geometry2d {
    const points = linePoints(shape)
    if (points.length < 2)
      return new Edge2d({ start: points[0] ?? new Vec(), end: (points[0] ?? new Vec()).clone().addXY(0.1, 0.1) })
    return shape.props.spline === 'cubic' && points.length > 2
      ? new CubicSpline2d({ points })
      : new Polyline2d({ points })
  }
  override onResize(shape: LineShape, info: ShapeResizeInfo<LineShape>): LineShape {
    const points: Record<string, LinePoint> = {}
    for (const [key, point] of Object.entries(shape.props.points))
      points[key] = { ...point, x: point.x * info.scaleX, y: point.y * info.scaleY }
    return { ...shape, x: info.newPoint.x, y: info.newPoint.y, props: { ...shape.props, points } }
  }
  component(shape: LineShape): ReactNode {
    const width = STROKES[shape.props.size] * shape.props.scale
    const dash =
      shape.props.dash === 'dashed'
        ? `${width * 2} ${width * 2}`
        : shape.props.dash === 'dotted'
          ? `0 ${width * 2}`
          : undefined
    return createElement(
      'svg',
      { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } },
      createElement('path', {
        d: this.getGeometry(shape).toSimpleSvgPath(),
        fill: 'none',
        stroke: shapeColor(this.editor, shape.props.color),
        strokeWidth: width,
        strokeDasharray: dash,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      })
    )
  }
}
