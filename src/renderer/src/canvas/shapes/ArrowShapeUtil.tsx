import { createElement, type ReactNode } from 'react'
import { Arc2d, Edge2d, Group2d, Polyline2d, Rectangle2d, intersectCircleCircle, type Geometry2d } from '../geometry'
import { Vec } from '../math/Vec'
import { HALF_PI, PI, clamp } from '../math/utils'
import { PathBuilder } from './PathBuilder'
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

export type Arrowhead = ArrowShape['props']['arrowheadEnd']

const CLOSED_ARROWHEADS: Arrowhead[] = ['triangle', 'square', 'diamond', 'dot', 'inverted']

export function isClosedArrowhead(kind: Arrowhead): boolean {
  return CLOSED_ARROWHEADS.includes(kind)
}

function arrowheadInt(body: Geometry2d, point: Vec, opposite: Vec, strokeWidth: number, atEnd: boolean): Vec {
  let int: Vec
  if (body instanceof Arc2d) {
    const length = clamp(Math.abs(body.length) / 5, strokeWidth, strokeWidth * 3)
    const intersections = intersectCircleCircle(point, length, body.arcCenter, body.radius)
    const picked = atEnd
      ? body.sweepFlag
        ? intersections[0]
        : intersections[1]
      : body.sweepFlag
        ? intersections[1]
        : intersections[0]
    int = picked ? Vec.From(picked) : point
  } else {
    const compare = body instanceof Polyline2d ? Vec.ManhattanDist(opposite, point) / 2 : Vec.Dist(opposite, point) / 5
    const length = clamp(compare, strokeWidth, strokeWidth * 3)
    int = Vec.Nudge(point, opposite, length)
  }
  return Vec.IsNaN(int) ? point : int
}

export function arrowheadPath(point: Vec, int: Vec, kind: Arrowhead): string | undefined {
  if (kind === 'none') return undefined
  const left = Vec.RotWith(int, point, PI / 6)
  const right = Vec.RotWith(int, point, -PI / 6)
  switch (kind) {
    case 'arrow':
      return `M ${left.x} ${left.y} L ${point.x} ${point.y} L ${right.x} ${right.y}`
    case 'triangle':
      return `M ${left.x} ${left.y} L ${right.x} ${right.y} L ${point.x} ${point.y} Z`
    case 'inverted': {
      const d = Vec.Sub(int, point).div(2)
      const pl = Vec.Add(point, Vec.Rot(d, HALF_PI))
      const pr = Vec.Sub(point, Vec.Rot(d, HALF_PI))
      return `M ${pl.x} ${pl.y} L ${int.x} ${int.y} L ${pr.x} ${pr.y} Z`
    }
    case 'dot': {
      const a = Vec.Lrp(point, int, 0.45)
      const r = Vec.Dist(a, point)
      return `M ${a.x - r},${a.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 -${r * 2},0`
    }
    case 'diamond': {
      const pb = Vec.Lrp(point, int, 0.75)
      const pl = Vec.RotWith(pb, point, PI / 4)
      const pr = Vec.RotWith(pb, point, -PI / 4)
      const pq = Vec.Lrp(pl, pr, 0.5)
      pq.add(Vec.Sub(pq, point))
      return `M ${pq.x} ${pq.y} L ${pr.x} ${pr.y} ${point.x} ${point.y} L ${pl.x} ${pl.y} Z`
    }
    case 'square': {
      const pb = Vec.Lrp(point, int, 0.85)
      const d = Vec.Sub(pb, point).div(2)
      const pl1 = Vec.Add(point, Vec.Rot(d, HALF_PI))
      const pr1 = Vec.Sub(point, Vec.Rot(d, HALF_PI))
      const pl2 = Vec.Add(pb, Vec.Rot(d, HALF_PI))
      const pr2 = Vec.Sub(pb, Vec.Rot(d, HALF_PI))
      return `M ${pl1.x} ${pl1.y} L ${pl2.x} ${pl2.y} L ${pr2.x} ${pr2.y} L ${pr1.x} ${pr1.y} Z`
    }
    case 'bar': {
      const d = Vec.Sub(int, point).div(2)
      const pl = Vec.Add(point, Vec.Rot(d, HALF_PI))
      const pr = Vec.Sub(point, Vec.Rot(d, HALF_PI))
      return `M ${pl.x} ${pl.y} L ${pr.x} ${pr.y}`
    }
    default:
      return undefined
  }
}

export function arrowBodyPath(body: Geometry2d, start: Vec, end: Vec): PathBuilder {
  const ends = { offset: 0, roundness: 0 }
  if (body instanceof Arc2d) {
    return new PathBuilder()
      .moveTo(start.x, start.y, ends)
      .circularArcTo(body.radius, !!body.largeArcFlag, !!body.sweepFlag, end.x, end.y, ends)
  }
  if (body instanceof Polyline2d) {
    const points = body.vertices
    const path = new PathBuilder().moveTo(points[0].x, points[0].y, { offset: 0 })
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y, i === points.length - 1 ? { offset: 0 } : undefined)
    }
    return path
  }
  return new PathBuilder().moveTo(start.x, start.y, ends).lineTo(end.x, end.y, ends)
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
  override onHandleDragStart(shape: ArrowShape, info: ShapeHandleDragInfo<ArrowShape>): undefined {
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
  override onHandleDragEnd(shape: ArrowShape, info: ShapeHandleDragInfo<ArrowShape>): undefined {
    if (info.handle.id !== 'start' && info.handle.id !== 'end') return
    const transform = this.editor.getShapePageTransform?.(shape)
    if (!transform) return
    this.editor.bindArrowTerminal?.(shape, info.handle.id, transform.applyToPoint(info.handle), info.isPrecise)
  }
  component(shape: ArrowShape): ReactNode {
    const geometry = this.getGeometry(shape)
    const body = geometry instanceof Group2d ? geometry.children[0] : geometry
    const vertices = body.vertices
    const terminals = getArrowTerminals(this.editor, shape)
    const start = terminals.start
    const end = terminals.end
    const strokeWidth = STROKES[shape.props.size] * shape.props.scale
    const text = plainText(shape.props.richText)
    const middle = vertices[Math.floor(vertices.length * shape.props.labelPosition)] ?? Vec.Med(start, end)
    const startHead = arrowheadPath(
      start,
      arrowheadInt(body, start, end, strokeWidth, false),
      shape.props.arrowheadStart
    )
    const endHead = arrowheadPath(end, arrowheadInt(body, end, start, strokeWidth, true), shape.props.arrowheadEnd)
    const fillColor =
      shape.props.fill === 'none'
        ? undefined
        : shape.props.fill === 'semi'
          ? canvasSurface(this.editor)
          : shapeColor(
              this.editor,
              shape.props.color,
              shape.props.fill === 'solid' ? 'semi' : shape.props.fill === 'lined-fill' ? 'linedFill' : shape.props.fill
            )
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
        createElement(
          'g',
          {
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth,
            strokeLinejoin: 'round',
            strokeLinecap: 'round'
          },
          arrowBodyPath(body, start, end).toSvg({
            style: shape.props.dash,
            strokeWidth,
            randomSeed: shape.id
          }),
          fillColor && startHead && isClosedArrowhead(shape.props.arrowheadStart)
            ? createElement('path', { key: 'start-fill', fill: fillColor, stroke: 'none', d: startHead })
            : null,
          fillColor && endHead && isClosedArrowhead(shape.props.arrowheadEnd)
            ? createElement('path', { key: 'end-fill', fill: fillColor, stroke: 'none', d: endHead })
            : null,
          startHead ? createElement('path', { key: 'start-head', d: startHead }) : null,
          endHead ? createElement('path', { key: 'end-head', d: endHead }) : null
        )
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
