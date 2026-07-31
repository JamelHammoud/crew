import { createElement, type ReactNode } from 'react'
import { Arc2d, Edge2d, Group2d, Polyline2d, Rectangle2d, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { BINDING_PROPS, arrowShapeProps, type TLBinding as CrewBinding, type TLShape as CrewShape } from '../schema'
import { richTextToHtml, type RichTextDocument } from '../text/richText'
import {
  BindingUtil,
  ShapeUtil,
  type CrewShapePartial,
  type ShapeEditor,
  type ShapeHandle,
  type ShapeHandleDragInfo
} from './ShapeUtil'
import { ARROW_FONT_SIZES, FONT_FAMILIES, STROKES, plainText, richText } from './shared'
import { canvasSurface, shapeColor } from './theme'

export type ArrowShape = CrewShape<'arrow'>
export type ArrowBinding = CrewBinding<'arrow'>

export interface ArrowTerminals {
  start: Vec
  end: Vec
}

function bindingPoint(
  editor: ShapeEditor,
  binding: ArrowBinding,
  opposite: Vec,
  hasArrowhead: boolean,
  scale: number,
  strokeWidth: number
): Vec | null {
  const target = editor.getShape?.(binding.toId)
  if (!target) return null
  const bounds = editor.getShapePageBounds?.(target)
  if (!bounds) return null
  const arrow = editor.getShape?.(binding.fromId)
  const anchor = new Vec(
    bounds.x + bounds.w * binding.props.normalizedAnchor.x,
    bounds.y + bounds.h * binding.props.normalizedAnchor.y
  )
  let pagePoint = anchor
  if (!binding.props.isExact) {
    const oppositePage = arrow ? opposite.clone().rot(arrow.rotation).addXY(arrow.x, arrow.y) : opposite
    const direction = oppositePage.clone().sub(anchor)
    const distances = [
      direction.x < 0
        ? (bounds.x - anchor.x) / direction.x
        : direction.x > 0
          ? (bounds.x + bounds.w - anchor.x) / direction.x
          : Infinity,
      direction.y < 0
        ? (bounds.y - anchor.y) / direction.y
        : direction.y > 0
          ? (bounds.y + bounds.h - anchor.y) / direction.y
          : Infinity
    ].filter(value => value >= 0 && Number.isFinite(value))
    if (distances.length) pagePoint = anchor.clone().add(direction.clone().mul(Math.min(...distances)))
    if (hasArrowhead) {
      const away = oppositePage.clone().sub(pagePoint)
      if (Vec.Len(away)) pagePoint.add(away.uni().mul((10 + strokeWidth / 2) * scale))
    }
  }
  if (!arrow) return pagePoint
  const local = editor.getPointInShapeSpace?.(arrow, pagePoint)
  return local ? new Vec(local.x, local.y) : new Vec(pagePoint.x - arrow.x, pagePoint.y - arrow.y).rot(-arrow.rotation)
}

export function getArrowBindings(editor: ShapeEditor, arrow: ArrowShape): { start?: ArrowBinding; end?: ArrowBinding } {
  const bindings = (editor.getBindingsFromShape?.(arrow.id, 'arrow') ?? []).filter(
    (binding): binding is ArrowBinding => binding.type === 'arrow'
  )
  return {
    start: bindings.find(binding => binding.props.terminal === 'start'),
    end: bindings.find(binding => binding.props.terminal === 'end')
  }
}

export function getArrowTerminals(editor: ShapeEditor, arrow: ArrowShape): ArrowTerminals {
  const bindings = getArrowBindings(editor, arrow)
  const storedStart = new Vec(arrow.props.start.x, arrow.props.start.y)
  const storedEnd = new Vec(arrow.props.end.x, arrow.props.end.y)
  const strokeWidth = STROKES[arrow.props.size]
  return {
    start: bindings.start
      ? (bindingPoint(
          editor,
          bindings.start,
          storedEnd,
          arrow.props.arrowheadStart !== 'none',
          arrow.props.scale,
          strokeWidth
        ) ?? storedStart)
      : storedStart,
    end: bindings.end
      ? (bindingPoint(
          editor,
          bindings.end,
          storedStart,
          arrow.props.arrowheadEnd !== 'none',
          arrow.props.scale,
          strokeWidth
        ) ?? storedEnd)
      : storedEnd
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
  return new Arc2d({
    center,
    start,
    end,
    sweepFlag: bend < 0 ? 1 : 0,
    largeArcFlag: Math.abs(bend) > chord / 2 ? 1 : 0
  })
}

export function arrowGeometry(editor: ShapeEditor, shape: ArrowShape): Geometry2d {
  const { start, end } = getArrowTerminals(editor, shape)
  let body: Geometry2d
  if (shape.props.kind === 'elbow') {
    const midpoint = Math.max(0, Math.min(1, shape.props.elbowMidPoint))
    const corner =
      Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
        ? new Vec(start.x + (end.x - start.x) * midpoint, start.y)
        : new Vec(start.x, start.y + (end.y - start.y) * midpoint)
    const second = corner.x === end.x || corner.y === end.y ? corner : new Vec(corner.x, end.y)
    const points = [start, corner, second, end].filter(
      (point, index, all) => index === 0 || !point.equals(all[index - 1])
    )
    body = points.length > 1 ? new Polyline2d({ points }) : new Edge2d({ start, end })
  } else {
    body = arcFrom(start, end, shape.props.bend)
  }
  const text = plainText(shape.props.richText)
  if (!text) return body
  const center = body.vertices[Math.floor(body.vertices.length * shape.props.labelPosition)] ?? Vec.Med(start, end)
  return new Group2d({
    children: [
      body,
      new Rectangle2d({
        x: center.x - 30,
        y: center.y - 12,
        width: 60,
        height: 24,
        isFilled: true,
        isLabel: true,
        excludeFromShapeBounds: true
      })
    ]
  })
}

function arrowheadPath(
  point: Vec,
  toward: Vec,
  strokeWidth: number,
  kind: ArrowShape['props']['arrowheadEnd']
): string | undefined {
  if (kind === 'none' || kind === 'pipe') return undefined
  const distance = Math.max(strokeWidth, Math.min(strokeWidth * 3, Vec.Dist(point, toward) / 5))
  const inside = Vec.Nudge(point, toward, distance)
  const left = Vec.RotWith(inside, point, Math.PI / 6)
  const right = Vec.RotWith(inside, point, -Math.PI / 6)
  if (kind === 'arrow') return `M ${left.x} ${left.y} L ${point.x} ${point.y} L ${right.x} ${right.y}`
  if (kind === 'triangle') return `M ${left.x} ${left.y} L ${right.x} ${right.y} L ${point.x} ${point.y} Z`
  if (kind === 'inverted') {
    const delta = Vec.Sub(inside, point).div(2)
    const side = Vec.Rot(delta, Math.PI / 2)
    return `M ${point.x + side.x} ${point.y + side.y} L ${inside.x} ${inside.y} L ${point.x - side.x} ${point.y - side.y} Z`
  }
  if (kind === 'dot') {
    const center = Vec.Lrp(point, inside, 0.45)
    const radius = Vec.Dist(center, point)
    return `M ${center.x - radius},${center.y} a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`
  }
  if (kind === 'diamond') {
    const back = Vec.Lrp(point, inside, 0.75)
    const diamondLeft = Vec.RotWith(back, point, Math.PI / 4)
    const diamondRight = Vec.RotWith(back, point, -Math.PI / 4)
    const far = Vec.Lrp(diamondLeft, diamondRight, 0.5).add(Vec.Sub(Vec.Lrp(diamondLeft, diamondRight, 0.5), point))
    return `M ${far.x} ${far.y} L ${diamondRight.x} ${diamondRight.y} ${point.x} ${point.y} L ${diamondLeft.x} ${diamondLeft.y} Z`
  }
  if (kind === 'square') {
    const back = Vec.Lrp(point, inside, 0.85)
    const side = Vec.Rot(Vec.Sub(back, point).div(2), Math.PI / 2)
    return `M ${point.x + side.x} ${point.y + side.y} L ${back.x + side.x} ${back.y + side.y} L ${back.x - side.x} ${back.y - side.y} L ${point.x - side.x} ${point.y - side.y} Z`
  }
  const delta = Vec.Rot(Vec.Sub(inside, point).div(2), Math.PI / 2)
  return `M ${point.x + delta.x} ${point.y + delta.y} L ${point.x - delta.x} ${point.y - delta.y}`
}

export class ArrowShapeUtil extends ShapeUtil<ArrowShape> {
  static override type = 'arrow' as const
  static override props = arrowShapeProps
  override options = {
    hoverPreciseTimeout: 600,
    pointingPreciseTimeout: 320,
    showTextOutline: true,
    getCustomDisplayValues: () => ({})
  }

  getDefaultProps(): ArrowShape['props'] {
    return {
      kind: 'arc',
      elbowMidPoint: 0.5,
      dash: 'draw',
      size: 'm',
      fill: 'none',
      color: 'black',
      labelColor: 'black',
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 },
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      richText: richText(),
      labelPosition: 0.5,
      font: 'draw',
      scale: 1
    }
  }
  override canEdit(): boolean {
    return true
  }
  override canResize(): boolean {
    return false
  }
  override getText(shape: ArrowShape): string {
    return plainText(shape.props.richText)
  }
  getGeometry(shape: ArrowShape): Geometry2d {
    return arrowGeometry(this.editor, shape)
  }
  override getHandles(shape: ArrowShape): ShapeHandle[] {
    const { start, end } = getArrowTerminals(this.editor, shape)
    const middle =
      shape.props.kind === 'elbow'
        ? Vec.Lrp(start, end, shape.props.elbowMidPoint)
        : Vec.Med(start, end).add(Vec.Sub(end, start).uni().per().mul(-shape.props.bend))
    return [
      { id: 'start', type: 'vertex', index: 'a1', x: start.x, y: start.y, canSnap: true },
      { id: 'middle', type: 'virtual', index: 'a2', x: middle.x, y: middle.y },
      { id: 'end', type: 'vertex', index: 'a3', x: end.x, y: end.y, canSnap: true }
    ]
  }
  override onHandleDragStart(shape: ArrowShape, info: ShapeHandleDragInfo<ArrowShape>): void {
    if (info.handle.id !== 'start' && info.handle.id !== 'end') return
    const binding = getArrowBindings(this.editor, shape)[info.handle.id]
    if (binding) this.editor.deleteBinding?.(binding.id)
  }
  override onHandleDrag(
    shape: ArrowShape,
    info: ShapeHandleDragInfo<ArrowShape>
  ): CrewShapePartial<ArrowShape> | undefined {
    if (info.handle.id === 'start')
      return { type: 'arrow', id: shape.id, props: { start: { x: info.handle.x, y: info.handle.y } } }
    if (info.handle.id === 'end')
      return { type: 'arrow', id: shape.id, props: { end: { x: info.handle.x, y: info.handle.y } } }
    if (info.handle.id !== 'middle') return
    const start = new Vec(shape.props.start.x, shape.props.start.y)
    const end = new Vec(shape.props.end.x, shape.props.end.y)
    if (shape.props.kind === 'elbow') {
      const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y)
      const midpoint = horizontal
        ? (info.handle.x - start.x) / Math.max(0.0001, end.x - start.x)
        : (info.handle.y - start.y) / Math.max(0.0001, end.y - start.y)
      return { type: 'arrow', id: shape.id, props: { elbowMidPoint: Math.max(0, Math.min(1, midpoint)) } }
    }
    const midpoint = Vec.Med(start, end)
    const perpendicular = Vec.Sub(end, start).uni().per()
    const bend = -Vec.Sub(new Vec(info.handle.x, info.handle.y), midpoint).dpr(perpendicular)
    return { type: 'arrow', id: shape.id, props: { bend } }
  }
  override onHandleDragEnd(shape: ArrowShape, info: ShapeHandleDragInfo<ArrowShape>): void {
    if (info.handle.id !== 'start' && info.handle.id !== 'end') return
    const transform = this.editor.getShapePageTransform?.(shape)
    if (!transform) return
    this.editor.bindArrowTerminal?.(shape, info.handle.id, transform.applyToPoint(info.handle), info.isPrecise)
  }
  component(shape: ArrowShape): ReactNode {
    const geometry = this.getGeometry(shape)
    const body = geometry instanceof Group2d ? geometry.children[0] : geometry
    const vertices = body.vertices
    const start = vertices[0]
    const end = vertices[vertices.length - 1]
    const previous = vertices[Math.max(0, vertices.length - 2)]
    const next = vertices[Math.min(vertices.length - 1, 1)]
    const strokeWidth = STROKES[shape.props.size] * shape.props.scale
    const dash =
      shape.props.dash === 'dashed'
        ? `${strokeWidth * 2} ${strokeWidth * 2}`
        : shape.props.dash === 'dotted'
          ? `0 ${strokeWidth * 2}`
          : undefined
    const text = plainText(shape.props.richText)
    const middle = vertices[Math.floor(vertices.length * shape.props.labelPosition)] ?? Vec.Med(start, end)
    const startHead = arrowheadPath(start, next, strokeWidth, shape.props.arrowheadStart)
    const endHead = arrowheadPath(end, previous, strokeWidth, shape.props.arrowheadEnd)
    const fillHead = (kind: ArrowShape['props']['arrowheadEnd']) =>
      kind === 'triangle' || kind === 'square' || kind === 'dot'
        ? 'currentColor'
        : kind === 'diamond' || kind === 'inverted'
          ? canvasSurface(this.editor)
          : 'none'
    const editing = this.editor.getEditingShapeId?.() === shape.id
    return createElement(
      'div',
      {
        style: {
          position: 'relative',
          width: '100%',
          height: '100%',
          color: shapeColor(this.editor, shape.props.color)
        }
      },
      createElement(
        'svg',
        { width: '100%', height: '100%', style: { overflow: 'visible', pointerEvents: 'all' } },
        createElement('path', {
          d: body.toSimpleSvgPath(),
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeDasharray: dash,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        }),
        startHead &&
          createElement('path', {
            d: startHead,
            fill: fillHead(shape.props.arrowheadStart),
            stroke: 'currentColor',
            strokeWidth,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          }),
        endHead &&
          createElement('path', {
            d: endHead,
            fill: fillHead(shape.props.arrowheadEnd),
            stroke: 'currentColor',
            strokeWidth,
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          })
      ),
      text &&
        createElement('div', {
          className: 'crew-rich-text',
          style: {
            position: 'absolute',
            left: middle.x,
            top: middle.y,
            transform: 'translate(-50%, -50%)',
            padding: '2px 5px',
            background: canvasSurface(this.editor),
            color: shapeColor(this.editor, shape.props.labelColor),
            fontFamily: FONT_FAMILIES[shape.props.font],
            fontSize: ARROW_FONT_SIZES[shape.props.size],
            lineHeight: 1.35,
            whiteSpace: 'pre-wrap',
            visibility: editing ? 'hidden' : undefined
          },
          dangerouslySetInnerHTML: { __html: richTextToHtml(shape.props.richText as RichTextDocument) }
        })
    )
  }
}

export class ArrowBindingUtil extends BindingUtil<ArrowBinding> {
  static override type = 'arrow' as const
  static override props = BINDING_PROPS.arrow
  getDefaultProps(): Partial<ArrowBinding['props']> {
    return { isPrecise: false, isExact: false, normalizedAnchor: { x: 0.5, y: 0.5 }, snap: 'none' }
  }
}
