import { createElement, type ReactNode } from 'react'
import { Circle2d, Edge2d, Polyline2d, type Geometry2d } from '../geometry'
import { highlightShapeProps, type TLShape } from '../schema'
import { ShapeUtil, type TLResizeInfo } from './ShapeUtil'
import { COLORS, STROKES, pathFromPoints, segmentPoints } from './shared'

export type TLHighlightShape = TLShape<'highlight'>

export class HighlightShapeUtil extends ShapeUtil<TLHighlightShape> {
  static override type = 'highlight' as const
  static override props = highlightShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLHighlightShape['props'] { return { segments: [], color: 'black', size: 'm', isComplete: false, isPen: false, scale: 1, scaleX: 1, scaleY: 1 } }
  getGeometry(shape: TLHighlightShape): Geometry2d {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale * 4
    if (points.length < 2) return new Circle2d({ x: -width / 2, y: -width / 2, radius: width / 2, isFilled: true })
    return points.length === 2 ? new Edge2d({ start: points[0], end: points[1] }) : new Polyline2d({ points })
  }
  override onResize(shape: TLHighlightShape, info: TLResizeInfo<TLHighlightShape>): TLHighlightShape {
    return { ...shape, x: info.newPoint.x, y: info.newPoint.y, props: { ...shape.props, scaleX: shape.props.scaleX * info.scaleX, scaleY: shape.props.scaleY * info.scaleY } }
  }
  component(shape: TLHighlightShape): ReactNode {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale * 4
    if (points.length < 2) return createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible' } }, createElement('circle', { cx: 0, cy: 0, r: width / 2, fill: COLORS[shape.props.color], opacity: 0.32 }))
    return createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all', mixBlendMode: 'multiply' } }, createElement('path', { d: pathFromPoints(points), fill: 'none', stroke: COLORS[shape.props.color], strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.32 }))
  }
}
