import { createElement, type ReactNode } from 'react'
import { Arc2d, Edge2d, Group2d, Polyline2d, Rectangle2d, type Geometry2d } from '../geometry'
import { Vec, type VecLike } from '../math/Vec'
import { BINDING_PROPS, arrowShapeProps, type TLBinding, type TLShape } from '../schema'
import { BindingUtil, ShapeUtil, type ShapeEditor } from './ShapeUtil'
import { COLORS, FONT_FAMILIES, FONT_SIZES, STROKES, pathFromPoints, plainText, richText } from './shared'

export type TLArrowShape = TLShape<'arrow'>
export type TLArrowBinding = TLBinding<'arrow'>

export interface ArrowTerminals {
  start: Vec
  end: Vec
}

function bindingPoint(editor: ShapeEditor, binding: TLArrowBinding): Vec | null {
  const target = editor.getShape?.(binding.toId)
  if (!target) return null
  const bounds = editor.getShapePageBounds?.(target)
  if (!bounds) return null
  const pagePoint = new Vec(bounds.x + bounds.w * binding.props.normalizedAnchor.x, bounds.y + bounds.h * binding.props.normalizedAnchor.y)
  const arrow = editor.getShape?.(binding.fromId)
  if (!arrow) return pagePoint
  const local = editor.getPointInShapeSpace?.(arrow, pagePoint)
  return local ? new Vec(local.x, local.y) : new Vec(pagePoint.x - arrow.x, pagePoint.y - arrow.y).rot(-arrow.rotation)
}

export function getArrowBindings(editor: ShapeEditor, arrow: TLArrowShape): { start?: TLArrowBinding; end?: TLArrowBinding } {
  const bindings = (editor.getBindingsFromShape?.(arrow.id, 'arrow') ?? []).filter((binding): binding is TLArrowBinding => binding.type === 'arrow')
  return {
    start: bindings.find(binding => binding.props.terminal === 'start'),
    end: bindings.find(binding => binding.props.terminal === 'end')
  }
}

export function getArrowTerminals(editor: ShapeEditor, arrow: TLArrowShape): ArrowTerminals {
  const bindings = getArrowBindings(editor, arrow)
  return {
    start: bindings.start ? bindingPoint(editor, bindings.start) ?? new Vec(arrow.props.start.x, arrow.props.start.y) : new Vec(arrow.props.start.x, arrow.props.start.y),
    end: bindings.end ? bindingPoint(editor, bindings.end) ?? new Vec(arrow.props.end.x, arrow.props.end.y) : new Vec(arrow.props.end.x, arrow.props.end.y)
  }
}

function arcFrom(start: Vec, end: Vec, bend: number): Arc2d | Edge2d {
  if (Math.abs(bend) < 0.0001 || start.equals(end)) return new Edge2d({ start, end })
  const midpoint = Vec.Med(start, end)
  const chord = Vec.Dist(start, end)
  const perpendicular = new Vec(-(end.y - start.y) / chord, (end.x - start.x) / chord)
  const handle = midpoint.clone().add(perpendicular.mul(bend))
  const denominator = 2 * (start.x * (handle.y - end.y) + handle.x * (end.y - start.y) + end.x * (start.y - handle.y))
  if (Math.abs(denominator) < 0.000001) return new Edge2d({ start, end })
  const a2 = start.x * start.x + start.y * start.y
  const b2 = handle.x * handle.x + handle.y * handle.y
  const c2 = end.x * end.x + end.y * end.y
  const center = new Vec(
    (a2 * (handle.y - end.y) + b2 * (end.y - start.y) + c2 * (start.y - handle.y)) / denominator,
    (a2 * (end.x - handle.x) + b2 * (start.x - end.x) + c2 * (handle.x - start.x)) / denominator
  )
  return new Arc2d({ center, start, end, sweepFlag: bend < 0 ? 1 : 0, largeArcFlag: Math.abs(bend) > chord / 2 ? 1 : 0 })
}

export function arrowGeometry(editor: ShapeEditor, shape: TLArrowShape): Geometry2d {
  const { start, end } = getArrowTerminals(editor, shape)
  let body: Geometry2d
  if (shape.props.kind === 'elbow') {
    const midpoint = Math.max(0, Math.min(1, shape.props.elbowMidPoint))
    const corner = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
      ? new Vec(start.x + (end.x - start.x) * midpoint, start.y)
      : new Vec(start.x, start.y + (end.y - start.y) * midpoint)
    const second = corner.x === end.x || corner.y === end.y ? corner : new Vec(corner.x, end.y)
    const points = [start, corner, second, end].filter((point, index, all) => index === 0 || !point.equals(all[index - 1]))
    body = points.length > 1 ? new Polyline2d({ points }) : new Edge2d({ start, end })
  } else {
    body = arcFrom(start, end, shape.props.bend)
  }
  const text = plainText(shape.props.richText)
  if (!text) return body
  const center = body.vertices[Math.floor(body.vertices.length * shape.props.labelPosition)] ?? Vec.Med(start, end)
  return new Group2d({ children: [body, new Rectangle2d({ x: center.x - 30, y: center.y - 12, width: 60, height: 24, isFilled: true, isLabel: true, excludeFromShapeBounds: true })] })
}

function arrowhead(point: Vec, toward: Vec, size: number, kind: TLArrowShape['props']['arrowheadEnd']): ReactNode {
  if (kind === 'none') return null
  const direction = toward.clone().sub(point)
  const length = Math.max(0.001, Math.sqrt(direction.x ** 2 + direction.y ** 2))
  direction.div(length)
  const normal = new Vec(-direction.y, direction.x)
  if (kind === 'dot') return createElement('circle', { cx: point.x, cy: point.y, r: size * 0.6, fill: 'currentColor' })
  if (kind === 'pipe' || kind === 'bar') return createElement('path', { d: pathFromPoints([point.clone().add(normal.clone().mul(size)), point.clone().sub(normal.clone().mul(size))]), fill: 'none', stroke: 'currentColor' })
  const back = point.clone().add(direction.mul(size * 2))
  const left = back.clone().add(normal.clone().mul(size))
  const right = back.clone().sub(normal.clone().mul(size))
  if (kind === 'square' || kind === 'diamond') {
    const far = back.clone().add(direction.clone().mul(size))
    return createElement('path', { d: pathFromPoints([point, left, far, right], true), fill: kind === 'diamond' ? 'white' : 'currentColor', stroke: 'currentColor' })
  }
  return createElement('path', { d: pathFromPoints([left, point, right], kind === 'triangle'), fill: kind === 'triangle' ? 'currentColor' : 'none', stroke: 'currentColor' })
}

export class ArrowShapeUtil extends ShapeUtil<TLArrowShape> {
  static override type = 'arrow' as const
  static override props = arrowShapeProps
  override options = { shouldBeExact: false, getCustomDisplayValues: () => ({}) }

  getDefaultProps(): TLArrowShape['props'] { return { kind: 'arc', elbowMidPoint: 0.5, dash: 'draw', size: 'm', fill: 'none', color: 'black', labelColor: 'black', bend: 0, start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, arrowheadStart: 'none', arrowheadEnd: 'arrow', richText: richText(), labelPosition: 0.5, font: 'draw', scale: 1 } }
  override canEdit(): boolean { return true }
  override canResize(): boolean { return false }
  override getText(shape: TLArrowShape): string { return plainText(shape.props.richText) }
  getGeometry(shape: TLArrowShape): Geometry2d { return arrowGeometry(this.editor, shape) }
  component(shape: TLArrowShape): ReactNode {
    const geometry = this.getGeometry(shape)
    const body = geometry instanceof Group2d ? geometry.children[0] : geometry
    const vertices = body.vertices
    const start = vertices[0]
    const end = vertices[vertices.length - 1]
    const previous = vertices[Math.max(0, vertices.length - 2)]
    const next = vertices[Math.min(vertices.length - 1, 1)]
    const strokeWidth = STROKES[shape.props.size] * shape.props.scale
    const dash = shape.props.dash === 'dashed' ? `${strokeWidth * 2} ${strokeWidth * 2}` : shape.props.dash === 'dotted' ? `0 ${strokeWidth * 2}` : undefined
    const text = plainText(shape.props.richText)
    const middle = vertices[Math.floor(vertices.length * shape.props.labelPosition)] ?? Vec.Med(start, end)
    return createElement('div', { style: { position: 'relative', width: '100%', height: '100%', color: COLORS[shape.props.color] } }, createElement('svg', { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } }, createElement('path', { d: body.toSimpleSvgPath(), fill: 'none', stroke: 'currentColor', strokeWidth, strokeDasharray: dash, strokeLinecap: 'round', strokeLinejoin: 'round' }), arrowhead(start, next, strokeWidth * 2, shape.props.arrowheadStart), arrowhead(end, previous, strokeWidth * 2, shape.props.arrowheadEnd)), text && createElement('div', { style: { position: 'absolute', left: middle.x, top: middle.y, transform: 'translate(-50%, -50%)', padding: '2px 5px', background: 'var(--color-canvas, white)', color: COLORS[shape.props.labelColor], fontFamily: FONT_FAMILIES[shape.props.font], fontSize: FONT_SIZES[shape.props.size], whiteSpace: 'pre-wrap' } }, text))
  }
}

export class ArrowBindingUtil extends BindingUtil<TLArrowBinding> {
  static override type = 'arrow' as const
  static override props = BINDING_PROPS.arrow
  getDefaultProps(): Partial<TLArrowBinding['props']> { return { isPrecise: false, isExact: false, normalizedAnchor: { x: 0.5, y: 0.5 }, snap: 'none' } }
}
