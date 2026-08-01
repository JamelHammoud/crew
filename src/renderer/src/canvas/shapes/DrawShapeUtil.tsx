import { createElement, type ReactNode } from 'react'
import { Circle2d, Polygon2d, Polyline2d, type Geometry2d } from '../geometry'
import { drawShapeProps, type TLShape as CrewShape } from '../schema'
import { isSinglePoint } from '../schema/points'
import { ShapeUtil, type ShapeResizeInfo } from './ShapeUtil'
import { freehandCenterline, freehandOptions, freehandOutline } from './freehand'
import { STROKES, pathFromPoints, segmentPoints } from './shared'
import { canvasSurface, shapeColor } from './theme'

export type DrawShape = CrewShape<'draw'>

export function isDot(shape: DrawShape | CrewShape<'highlight'>): boolean {
  const segment = shape.props.segments[0]
  return shape.props.segments.length === 1 && isSinglePoint(segment.path, segment.dim)
}

export class DrawShapeUtil extends ShapeUtil<DrawShape> {
  static override type = 'draw' as const
  static override props = drawShapeProps
  override options = { getCustomDisplayValues: () => ({}) }

  getDefaultProps(): DrawShape['props'] {
    return {
      segments: [],
      color: 'black',
      fill: 'none',
      dash: 'draw',
      size: 'm',
      isComplete: false,
      isClosed: false,
      isPen: false,
      scale: 1,
      scaleX: 1,
      scaleY: 1
    }
  }
  override canEdit(): boolean {
    return true
  }
  override hideResizeHandles(shape: DrawShape): boolean {
    return isDot(shape)
  }
  override hideRotateHandle(shape: DrawShape): boolean {
    return isDot(shape)
  }
  override hideSelectionBoundsFg(shape: DrawShape): boolean {
    return isDot(shape)
  }
  getGeometry(shape: DrawShape): Geometry2d {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = (STROKES[shape.props.size] + 1) * shape.props.scale
    if (points.length < 2) return new Circle2d({ x: -width, y: -width, radius: width, isFilled: true })
    const complete = shape.props.isComplete || shape.props.isPen || shape.props.segments.at(-1)?.type === 'straight'
    const centerline = freehandCenterline(points, freehandOptions(shape.props, width, complete, true))
    if (shape.props.isClosed && centerline.length > 2)
      return new Polygon2d({ points: centerline, isFilled: shape.props.fill !== 'none' })
    return centerline.length > 1
      ? new Polyline2d({ points: centerline })
      : new Circle2d({ x: -width, y: -width, radius: width, isFilled: true })
  }
  override onResize(shape: DrawShape, info: ShapeResizeInfo<DrawShape>): DrawShape {
    return {
      ...shape,
      x: info.newPoint.x,
      y: info.newPoint.y,
      props: { ...shape.props, scaleX: shape.props.scaleX * info.scaleX, scaleY: shape.props.scaleY * info.scaleY }
    }
  }
  component(shape: DrawShape): ReactNode {
    const points = segmentPoints(shape.props.segments, shape.props.scaleX, shape.props.scaleY)
    const width = (STROKES[shape.props.size] + 1) * shape.props.scale
    const complete = shape.props.isComplete || shape.props.segments.at(-1)?.type === 'straight'
    const options = freehandOptions(shape.props, width, complete, false)
    const outline = freehandOutline(points, options)
    const stroke = shapeColor(this.editor, shape.props.color)
    const fill =
      shape.props.fill === 'none'
        ? 'none'
        : shape.props.fill === 'semi'
          ? canvasSurface(this.editor)
          : shapeColor(
              this.editor,
              shape.props.color,
              shape.props.fill === 'solid' ? 'semi' : shape.props.fill === 'lined-fill' ? 'linedFill' : shape.props.fill
            )
    const dash =
      shape.props.dash === 'dashed'
        ? `${width * 2} ${width * 2}`
        : shape.props.dash === 'dotted'
          ? `0 ${width * 2}`
          : undefined
    if (points.length < 2)
      return createElement(
        'svg',
        { width: '100%', height: '100%', style: { overflow: 'visible' } },
        createElement('circle', { cx: 0, cy: 0, r: width / 2, fill: stroke })
      )
    const body =
      shape.props.dash === 'draw'
        ? createElement('path', { d: pathFromPoints(outline, true), fill: stroke })
        : createElement('path', {
            d: pathFromPoints(freehandCenterline(points, options), shape.props.isClosed),
            fill: 'none',
            stroke,
            strokeWidth: width,
            strokeDasharray: dash,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          })
    const closedFill =
      shape.props.isClosed && fill !== 'none'
        ? createElement('path', { d: pathFromPoints(freehandCenterline(points, options), true), fill })
        : null
    return createElement(
      'svg',
      { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } },
      closedFill,
      body
    )
  }
}
