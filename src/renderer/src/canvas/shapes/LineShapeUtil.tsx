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
import { PathBuilder } from './PathBuilder'
import { STROKES } from './shared'
import { shapeColor } from './theme'

export type LineShape = CrewShape<'line'>

export function linePoints(shape: LineShape): Vec[] {
  return Object.values(shape.props.points)
    .sort((a, b) => a.index.localeCompare(b.index))
    .map(point => new Vec(point.x, point.y))
}

export function linePath(shape: LineShape): PathBuilder {
  const points = linePoints(shape)
  const spread = points.length < 2 ? [points[0] ?? new Vec(), (points[0] ?? new Vec()).clone().addXY(0.1, 0.1)] : points
  return shape.props.spline === 'cubic' && spread.length > 2
    ? PathBuilder.cubicSplineThroughPoints(spread, { endOffsets: 0 })
    : PathBuilder.lineThroughPoints(spread, { endOffsets: 0 })
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
  override hideResizeHandles(): boolean {
    return true
  }
  override hideRotateHandle(): boolean {
    return true
  }
  override hideSelectionBoundsFg(): boolean {
    return true
  }
  override hideSelectionBoundsBg(): boolean {
    return true
  }
  override getHandles(shape: LineShape): ShapeHandle[] {
    return Object.values(shape.props.points)
      .sort((a, b) => a.index.localeCompare(b.index))
      .map(point => ({ ...point, type: 'vertex', canSnap: true }))
  }
  override onHandleDrag(
    shape: LineShape,
    info: ShapeHandleDragInfo<LineShape>
  ): CrewShapePartial<LineShape> | undefined {
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
  override getIndicatorPath(shape: LineShape): Path2D | undefined {
    if (typeof Path2D === 'undefined') return undefined
    return linePath(shape).toPath2D({
      style: shape.props.dash === 'draw' ? 'draw' : 'solid',
      strokeWidth: 1,
      passes: 1,
      randomSeed: shape.id,
      offset: 0,
      roundness: STROKES[shape.props.size] * shape.props.scale * 2
    })
  }
  component(shape: LineShape): ReactNode {
    const width = STROKES[shape.props.size] * shape.props.scale
    return createElement(
      'svg',
      { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } },
      linePath(shape).toSvg({
        style: shape.props.dash,
        strokeWidth: width,
        randomSeed: shape.id,
        props: {
          fill: 'none',
          stroke: shapeColor(this.editor, shape.props.color),
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        }
      })
    )
  }
}
