import { createElement, type ReactNode } from 'react'
import { holdsChildren, nodeDefaults, nodeShapeOf, type DesignNodeProps } from '../../../../shared/designNode'
import { Ellipse2d, Polygon2d, Rectangle2d } from '../geometry'
import { Vec } from '../math/Vec'
import { designNodeShapeProps, type TLShape as CrewShape } from '../schema'
import { loadFonts } from '../../design/fonts'
import { nodeStyle, polygonFillStyle, polygonStyle, strokeDash, textBoxStyle, textStyle } from '../../design/nodeCss'
import { nodeOutline, nodePolygon, polygonPath, type UnitPoint } from '../../design/nodeShape'
import { nextNodeName, nextNodeShape } from '../../design/nextShape'
import { ShapeUtil, resizeBox, type ShapeResizeInfo } from './ShapeUtil'

export type DesignNodeShape = CrewShape<'design-node'>

function NodeText({ props, centered }: { props: DesignNodeProps; centered?: boolean }): ReactNode {
  if (!props.text) return null
  loadFonts([props.type.family])
  return createElement('div', { style: { width: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...(centered ? { position: 'absolute', top: '50%', transform: 'translateY(-50%)' } : textBoxStyle(props.type)), ...textStyle(props.type) } }, props.text)
}

function BoxNode({ props }: { props: DesignNodeProps }): ReactNode {
  return createElement('div', { style: { width: '100%', height: '100%', position: 'relative', ...nodeStyle(props) } }, createElement(NodeText, { props }))
}

function PolygonNode({ shape, points }: { shape: DesignNodeShape; points: UnitPoint[] }): ReactNode {
  const props = shape.props
  const { w, h } = props
  const path = polygonPath(points, w, h)
  const strokes = props.strokes.filter(stroke => stroke.visible && stroke.weight > 0)
  return createElement('div', { style: { width: '100%', height: '100%', position: 'relative', ...polygonStyle(props) } }, createElement('div', { style: { position: 'absolute', inset: 0, ...polygonFillStyle(props, points) } }), createElement('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: { position: 'absolute', inset: 0, overflow: 'visible' } }, ...strokes.map((stroke, at) => createElement('path', { key: at, d: path, fill: 'none', stroke: stroke.color, strokeWidth: stroke.align === 'center' ? stroke.weight : stroke.weight * 2, strokeDasharray: strokeDash(stroke), strokeLinecap: stroke.style === 'dotted' ? 'round' : 'butt', strokeLinejoin: 'round' }))), createElement(NodeText, { props, centered: true }))
}

export class DesignNodeUtil extends ShapeUtil<DesignNodeShape> {
  static override type = 'design-node' as const
  static override props = designNodeShapeProps

  getDefaultProps(): DesignNodeProps {
    const shape = nextNodeShape()
    return { ...nodeDefaults(), shape, name: nextNodeName(shape) }
  }
  override canResize(): boolean { return true }
  override canEdit(): boolean { return true }
  override onResize(shape: DesignNodeShape, info: ShapeResizeInfo<DesignNodeShape>) { return resizeBox(shape, info) }
  getGeometry(shape: DesignNodeShape) {
    const { w, h } = shape.props
    const kind = nodeShapeOf(shape.props.shape)
    if (kind === 'ellipse') return new Ellipse2d({ width: w, height: h, isFilled: true })
    const points = nodePolygon(kind)
    if (points) return new Polygon2d({ points: points.map(point => new Vec(point.x * w, point.y * h)), isFilled: true })
    return new Rectangle2d({ width: w, height: h, isFilled: true })
  }
  override canReceiveNewChildrenOfType(shape: DesignNodeShape): boolean { return holdsChildren(nodeShapeOf(shape.props.shape)) && !shape.isLocked }
  override getClipPath(shape: DesignNodeShape) {
    if (!shape.props.clip && !shape.props.mask) return undefined
    return nodeOutline(nodeShapeOf(shape.props.shape), shape.props.w, shape.props.h, shape.props.radius).map(point => new Vec(point.x, point.y))
  }
  component(shape: DesignNodeShape): ReactNode {
    if (shape.props.mask) return createElement('div', { style: { width: shape.props.w, height: shape.props.h } })
    const points = nodePolygon(nodeShapeOf(shape.props.shape))
    return createElement('div', { style: { width: shape.props.w, height: shape.props.h, pointerEvents: 'all' } }, points ? createElement(PolygonNode, { shape, points }) : createElement(BoxNode, { props: shape.props }))
  }
  override getIndicatorPath(shape: DesignNodeShape) {
    if (typeof Path2D === 'undefined') return undefined
    const path = new Path2D()
    const kind = nodeShapeOf(shape.props.shape)
    if (kind === 'ellipse') path.ellipse(shape.props.w / 2, shape.props.h / 2, shape.props.w / 2, shape.props.h / 2, 0, 0, Math.PI * 2)
    else {
      const points = nodePolygon(kind)
      if (points) return new Path2D(polygonPath(points, shape.props.w, shape.props.h))
      path.roundRect(0, 0, shape.props.w, shape.props.h, shape.props.radius)
    }
    return path
  }
}
