import { createElement, type ReactNode } from 'react'
import { Circle2d, Polygon2d, type Geometry2d } from '../geometry'
import { highlightShapeProps, type TLShape as CrewShape } from '../schema'
import { ShapeUtil, type ShapeResizeInfo } from './ShapeUtil'
import { isDot } from './DrawShapeUtil'
import { freehandOutline, highlightOptions } from './freehand'
import { STROKES, pathFromPoints, segmentPoints } from './shared'
import { shapeColor } from './theme'

export type HighlightShape = CrewShape<'highlight'>

export class HighlightShapeUtil extends ShapeUtil<HighlightShape> {
  static override type = 'highlight' as const
  static override props = highlightShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): HighlightShape['props'] {
    return { segments: [], color: 'black', size: 'm', isComplete: false, isPen: false, scale: 1, scaleX: 1, scaleY: 1 }
  }
  override hideResizeHandles(shape: HighlightShape): boolean {
    return isDot(shape)
  }
  override hideRotateHandle(shape: HighlightShape): boolean {
    return isDot(shape)
  }
  override hideSelectionBoundsFg(shape: HighlightShape): boolean {
    return isDot(shape)
  }
  getGeometry(shape: HighlightShape): Geometry2d {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale
    if (points.length < 2) return new Circle2d({ x: -width / 2, y: -width / 2, radius: width / 2, isFilled: true })
    const complete = shape.props.isComplete || shape.props.segments.at(-1)?.type === 'straight'
    return new Polygon2d({ points: freehandOutline(points, highlightOptions(width, complete)), isFilled: true })
  }
  override onResize(shape: HighlightShape, info: ShapeResizeInfo<HighlightShape>): HighlightShape {
    return {
      ...shape,
      x: info.newPoint.x,
      y: info.newPoint.y,
      props: { ...shape.props, scaleX: shape.props.scaleX * info.scaleX, scaleY: shape.props.scaleY * info.scaleY }
    }
  }
  component(shape: HighlightShape): ReactNode {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = STROKES[shape.props.size] * shape.props.scale
    const color = shapeColor(this.editor, shape.props.color, 'highlightSrgb')
    if (points.length < 2)
      return createElement(
        'svg',
        { width: '100%', height: '100%', style: { overflow: 'visible' } },
        createElement('circle', { cx: 0, cy: 0, r: width / 2, fill: color, opacity: 0.35 })
      )
    const complete = shape.props.isComplete || shape.props.segments.at(-1)?.type === 'straight'
    const outline = freehandOutline(points, highlightOptions(width, complete))
    return createElement(
      'svg',
      { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all', mixBlendMode: 'multiply' } },
      createElement('path', { d: pathFromPoints(outline, true), fill: color, opacity: 0.35 })
    )
  }
}
