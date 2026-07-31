import { createElement, type ReactNode } from 'react'
import { Circle2d, Edge2d, Polygon2d, Polyline2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { drawShapeProps, type TLShape } from '../schema'
import { ShapeUtil, type TLResizeInfo } from './ShapeUtil'
import { COLORS, STROKES, pathFromPoints, segmentPoints } from './shared'

export type TLDrawShape = TLShape<'draw'>

export class DrawShapeUtil extends ShapeUtil<TLDrawShape> {
  static override type = 'draw' as const
  static override props = drawShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLDrawShape['props'] { return { segments: [], color: 'black', fill: 'none', dash: 'draw', size: 'm', isComplete: false, isClosed: false, isPen: false, scale: 1, scaleX: 1, scaleY: 1 } }
  override canEdit(): boolean { return true }
  getGeometry(shape: TLDrawShape): Geometry2d {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale
    if (points.length < 2) return new Circle2d({ x: -width / 2, y: -width / 2, radius: width / 2, isFilled: true })
    if (shape.props.isClosed) return new Polygon2d({ points, isFilled: shape.props.fill !== 'none' })
    return points.length === 2 ? new Edge2d({ start: points[0], end: points[1] }) : new Polyline2d({ points })
  }
  override onResize(shape: TLDrawShape, info: TLResizeInfo<TLDrawShape>): TLDrawShape {
    return { ...shape, x: info.newPoint.x, y: info.newPoint.y, props: { ...shape.props, scaleX: shape.props.scaleX * info.scaleX, scaleY: shape.props.scaleY * info.scaleY } }
  }
  component(shape: TLDrawShape): ReactNode {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale
    const fill = shape.props.fill === 'none' ? 'none' : shape.props.fill === 'semi' ? `${COLORS[shape.props.color]}33` : COLORS[shape.props.color]
    const dash = shape.props.dash === 'dashed' ? `${width * 2} ${width * 2}` : shape.props.dash === 'dotted' ? `0 ${width * 2}` : undefined
    if (points.length < 2) return createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible' } }, createElement('circle', { cx: 0, cy: 0, r: width / 2, fill: COLORS[shape.props.color] }))
    return createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } }, createElement('path', { d: pathFromPoints(points, shape.props.isClosed), fill, stroke: COLORS[shape.props.color], strokeWidth: width, strokeDasharray: dash, strokeLinecap: 'round', strokeLinejoin: 'round' }))
  }
}
