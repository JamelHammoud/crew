import { Geometry2dFilters, Group2d, type Geometry2d } from '../geometry'
import { intersectLineSegmentPolygon, intersectLineSegmentPolyline } from '../geometry/intersect'
import { Vec, type VecLike } from '../math/Vec'
import type { TLBinding as CrewBinding, TLShape as CrewShape, TLShapeId as CrewShapeId } from '../schema'
import type { ShapeEditor } from './ShapeUtil'
import { STROKES } from './shared'

type ArrowShape = CrewShape<'arrow'>
type ArrowBinding = CrewBinding<'arrow'>

export const MIN_ARROW_LENGTH = 10
export const BOUND_ARROW_OFFSET = 10
export const MIN_ARROW_BEND = 8
const ANCHOR_EPSILON = 1e-3

export type BoundShapeRelationship = 'safe' | 'double-bound' | 'start-contains-end' | 'end-contains-start'

export interface ArrowBindings {
  start?: ArrowBinding
  end?: ArrowBinding
}

export interface BoundShapeInfo {
  shape: CrewShape
  geometry: Geometry2d
  isExact: boolean
  isClosed: boolean
  didIntersect: boolean
}

export function isArrowStraight(shape: ArrowShape): boolean {
  if (shape.props.kind !== 'arc') return false
  return Math.abs(shape.props.bend) < MIN_ARROW_BEND * shape.props.scale
}

function clampAnchor(value: number): number {
  return Math.max(ANCHOR_EPSILON, Math.min(1 - ANCHOR_EPSILON, value))
}

export function boundShapeRelationship(
  editor: ShapeEditor,
  startId?: CrewShapeId,
  endId?: CrewShapeId
): BoundShapeRelationship {
  if (!startId || !endId) return 'safe'
  if (startId === endId) return 'double-bound'
  const startBounds = editor.getShapePageBounds?.(startId)
  const endBounds = editor.getShapePageBounds?.(endId)
  if (startBounds && endBounds) {
    if (startBounds.contains(endBounds)) return 'start-contains-end'
    if (endBounds.contains(startBounds)) return 'end-contains-start'
  }
  return 'safe'
}

export function boundShapeInfo(editor: ShapeEditor, binding: ArrowBinding | undefined): BoundShapeInfo | undefined {
  if (!binding) return undefined
  const shape = editor.getShape?.(binding.toId)
  if (!shape) return undefined
  const geometry = editor.getShapeGeometry?.(shape)
  if (!geometry) return undefined
  return { shape, geometry, isExact: binding.props.isExact, isClosed: geometry.isClosed, didIntersect: false }
}

function toArrowSpace(editor: ShapeEditor, arrow: ArrowShape, pagePoint: VecLike): Vec {
  const local = editor.getPointInShapeSpace?.(arrow, pagePoint)
  if (local) return new Vec(local.x, local.y)
  return new Vec(pagePoint.x - arrow.x, pagePoint.y - arrow.y).rot(-arrow.rotation)
}

function toPageSpace(editor: ShapeEditor, shape: CrewShape, localPoint: VecLike): Vec {
  const transform = editor.getShapePageTransform?.(shape)
  if (transform) {
    const page = transform.applyToPoint(localPoint)
    return new Vec(page.x, page.y)
  }
  return new Vec(localPoint.x, localPoint.y).rot(shape.rotation).addXY(shape.x, shape.y)
}

export function terminalInArrowSpace(
  editor: ShapeEditor,
  arrow: ArrowShape,
  binding: ArrowBinding,
  forceImprecise: boolean
): Vec {
  const target = editor.getShape?.(binding.toId)
  if (!target) return new Vec(0, 0)
  const geometry = editor.getShapeGeometry?.(target)
  if (!geometry) return new Vec(0, 0)

  const { point, w, h } = geometry.bounds
  const anchor =
    binding.props.isPrecise || forceImprecise
      ? { x: clampAnchor(binding.props.normalizedAnchor.x), y: clampAnchor(binding.props.normalizedAnchor.y) }
      : { x: 0.5, y: 0.5 }

  const local = new Vec(point.x + anchor.x * w, point.y + anchor.y * h)
  return toArrowSpace(editor, arrow, toPageSpace(editor, target, local))
}

export function terminalsInArrowSpace(
  editor: ShapeEditor,
  arrow: ArrowShape,
  bindings: ArrowBindings
): { start: Vec; end: Vec } {
  const relationship = boundShapeRelationship(editor, bindings.start?.toId, bindings.end?.toId)
  const forceStart = relationship === 'double-bound' || relationship === 'start-contains-end'
  const forceEnd = relationship === 'double-bound' || relationship === 'end-contains-start'
  return {
    start: bindings.start
      ? terminalInArrowSpace(editor, arrow, bindings.start, forceStart)
      : new Vec(arrow.props.start.x, arrow.props.start.y),
    end: bindings.end
      ? terminalInArrowSpace(editor, arrow, bindings.end, forceEnd)
      : new Vec(arrow.props.end.x, arrow.props.end.y)
  }
}

function outlines(geometry: Geometry2d): { vertices: Vec[]; isClosed: boolean }[] {
  const filters = Geometry2dFilters.EXCLUDE_NON_STANDARD
  if (geometry instanceof Group2d) {
    return geometry.children
      .filter(child => !child.isExcludedByFilter(filters))
      .map(child => ({ vertices: child.getVertices(filters), isClosed: child.isClosed }))
  }
  return [{ vertices: geometry.getVertices(filters), isClosed: geometry.isClosed }]
}

function crossings(geometry: Geometry2d, from: VecLike, to: VecLike): Vec[] {
  const found: Vec[] = []
  for (const outline of outlines(geometry)) {
    if (outline.vertices.length < 2) continue
    const hits = outline.isClosed
      ? intersectLineSegmentPolygon(from, to, outline.vertices)
      : intersectLineSegmentPolyline(from, to, outline.vertices)
    if (hits) for (const hit of hits) found.push(new Vec(hit.x, hit.y))
  }
  return found
}

function moveToEdge(
  editor: ShapeEditor,
  arrow: ArrowShape,
  point: Vec,
  opposite: Vec,
  info: BoundShapeInfo | undefined
): void {
  if (!info || info.isExact) return

  const pageFrom = toPageSpace(editor, arrow, opposite)
  const pageTo = toPageSpace(editor, arrow, point)
  const targetFrom = editor.getPointInShapeSpace?.(info.shape, pageFrom) ?? pageFrom
  const targetTo = editor.getPointInShapeSpace?.(info.shape, pageTo) ?? pageTo

  const hits = crossings(info.geometry, targetFrom, targetTo)
  let landed: VecLike | undefined
  if (hits.length) {
    hits.sort((a, b) => Vec.Dist2(a, targetFrom) - Vec.Dist2(b, targetFrom))
    landed = hits[0] ?? (info.isClosed ? undefined : targetTo)
  }

  if (landed === undefined) {
    landed = info.geometry.nearestPoint(targetTo, Geometry2dFilters.EXCLUDE_NON_STANDARD)
    if (!Vec.DistMin(landed, targetTo, 1)) return
  }

  point.setTo(toArrowSpace(editor, arrow, toPageSpace(editor, info.shape, landed)))
  info.didIntersect = true
}

function strokeOffsetFor(arrowStroke: number, shape: CrewShape): number {
  const size = (shape.props as { size?: keyof typeof STROKES }).size
  return arrowStroke / 2 + (size && size in STROKES ? STROKES[size] / 2 : 0)
}

export function straightArrowTerminals(
  editor: ShapeEditor,
  arrow: ArrowShape,
  bindings: ArrowBindings
): { start: Vec; end: Vec } {
  const handles = terminalsInArrowSpace(editor, arrow, bindings)
  const a = handles.start.clone()
  const b = handles.end.clone()
  if (Vec.Equals(a, b)) return { start: a, end: b }

  const towardEnd = Vec.Sub(b, a).uni()
  const startInfo = boundShapeInfo(editor, bindings.start)
  const endInfo = boundShapeInfo(editor, bindings.end)
  const { scale, arrowheadStart, arrowheadEnd } = arrow.props

  moveToEdge(editor, arrow, b, handles.start, endInfo)
  moveToEdge(editor, arrow, a, handles.end, startInfo)

  let offsetA = 0
  let offsetB = 0
  let minLength = MIN_ARROW_LENGTH * scale
  const arrowStroke = STROKES[arrow.props.size]
  const selfBound = Boolean(startInfo && endInfo && startInfo.shape === endInfo.shape)
  const relationship = boundShapeRelationship(editor, bindings.start?.toId, bindings.end?.toId)

  if (relationship === 'safe' && startInfo && endInfo && !selfBound && !startInfo.isExact && !endInfo.isExact) {
    if (endInfo.didIntersect && !startInfo.didIntersect) {
      if (startInfo.isClosed) a.setTo(b.clone().add(towardEnd.clone().mul(MIN_ARROW_LENGTH * scale)))
    } else if (!endInfo.didIntersect) {
      if (endInfo.isClosed) b.setTo(a.clone().sub(towardEnd.clone().mul(MIN_ARROW_LENGTH * scale)))
    }
  }

  const span = Vec.Sub(b, a)
  const along = Vec.Len(span) ? span.uni() : Vec.From(span)
  const flipped = !Vec.Equals(along, towardEnd)

  if (!selfBound) {
    if (relationship !== 'start-contains-end' && startInfo && arrowheadStart !== 'none' && !startInfo.isExact) {
      const stroke = strokeOffsetFor(arrowStroke, startInfo.shape)
      offsetA = (BOUND_ARROW_OFFSET + stroke) * scale
      minLength += stroke * scale
    }
    if (relationship !== 'end-contains-start' && endInfo && arrowheadEnd !== 'none' && !endInfo.isExact) {
      const stroke = strokeOffsetFor(arrowStroke, endInfo.shape)
      offsetB = (BOUND_ARROW_OFFSET + stroke) * scale
      minLength += stroke * scale
    }
  }

  const direction = flipped ? -1 : 1
  const nudgedA = a.clone().add(along.clone().mul(offsetA * direction))
  const nudgedB = b.clone().sub(along.clone().mul(offsetB * direction))

  if (Vec.DistMin(nudgedA, nudgedB, minLength)) {
    if (offsetA !== 0 && offsetB !== 0) {
      offsetA *= -1.5
      offsetB *= -1.5
    } else if (offsetA !== 0) {
      offsetA *= -1
    } else if (offsetB !== 0) {
      offsetB *= -1
    }
  }

  a.add(along.clone().mul(offsetA * direction))
  b.sub(along.clone().mul(offsetB * direction))

  if (flipped && startInfo && endInfo) b.setTo(Vec.Add(a, along.clone().mul(-MIN_ARROW_LENGTH * scale)))

  return { start: a, end: b }
}
