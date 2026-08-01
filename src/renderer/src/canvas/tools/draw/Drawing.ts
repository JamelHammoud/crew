import { Mat } from '../../math/Mat'
import { clampRadians, toFixed } from '../../math/utils'
import { Vec, type VecModel } from '../../math/Vec'
import { createShapeId, uniqueId } from '../../schema/id'
import { decodePoints, DIM_2D, DIM_3D, encodePoints } from '../../schema/points'
import type { CanvasDrawShapeSegment } from '../../schema/shapeProps'
import { DrawState } from './DrawState'
import type { FreehandKeyboardEvent, FreehandPointerEvent, FreehandShape, FreehandShapeType } from './types'

type SegmentMode = 'free' | 'straight' | 'starting_straight' | 'starting_free'

const strokeSizes = { s: 1, m: 1.75, l: 2.5, xl: 5 }

function point(value: VecModel): Vec {
  return new Vec(value.x, value.y, value.z ?? 0.5)
}

function fixed(value: VecModel): Vec {
  return new Vec(toFixed(value.x), toFixed(value.y), value.z === undefined ? 0.5 : toFixed(value.z))
}

function json(value: VecModel): VecModel {
  return { x: value.x, y: value.y, z: value.z }
}

function firstPoint(segment: CanvasDrawShapeSegment): Vec | null {
  const value = decodePoints(segment.path, segment.dim ?? DIM_3D)[0]
  return value ? point(value) : null
}

function lastPoint(segment: CanvasDrawShapeSegment): Vec | null {
  const values = decodePoints(segment.path, segment.dim ?? DIM_3D)
  const value = values[values.length - 1]
  return value ? point(value) : null
}

function pointsBetween(a: VecModel, b: VecModel, steps: number): Vec[] {
  const values: Vec[] = []
  for (let i = 0; i < steps; i++) {
    const linear = i / (steps - 1)
    const t = linear * linear
    const p = Vec.Lrp(a, b, t)
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    p.z = Math.min(1, 0.5 + Math.abs(0.5 - eased) * 0.65)
    values.push(p)
  }
  return values
}

function snapAngle(angle: number, segments: number): number {
  const pi2 = Math.PI * 2
  const size = pi2 / segments
  let snapped = (Math.floor((clampRadians(angle) + size / 2) / size) * size) % pi2
  if (snapped < Math.PI) snapped += pi2
  if (snapped > Math.PI) snapped -= pi2
  return snapped
}

export class Drawing extends DrawState {
  static readonly id = 'drawing'
  static readonly trackPerformance = true
  info = {} as FreehandPointerEvent
  initialShape?: FreehandShape
  isPen = false
  isPenOrStylus = false
  segmentDim: 2 | undefined
  segmentMode: SegmentMode = 'free'
  didJustShiftClickToExtendPreviousShapeLine = false
  pagePointWhereCurrentSegmentChanged = new Vec()
  pagePointWhereNextSegmentChanged: Vec | null = null
  lastRecordedPoint = new Vec()
  mergeNextPoint = false
  currentLineLength = 0
  zoomOnEnter = 1
  currentSegmentPoints: Vec[] = []
  markId: string | null = null

  get shapeType(): FreehandShapeType {
    return this.tool.shapeType
  }

  override onEnter(info?: FreehandPointerEvent): void {
    if (!info) return
    this.markId = null
    this.info = info
    this.lastRecordedPoint = point(this.editor.inputs.getCurrentPagePoint())
    this.zoomOnEnter = this.editor.getZoomLevel()
    this.startShape()
  }

  override onPointerMove(): void {
    const isPen = this.editor.inputs.getIsPen()
    if (this.isPen && !isPen && this.markId) {
      this.editor.bailToMark(this.markId)
      this.startShape()
      return
    }
    if (this.isPenOrStylus) {
      const current = point(this.editor.inputs.getCurrentPagePoint())
      if (Vec.Dist(current, this.lastRecordedPoint) >= 1 / this.zoomOnEnter) {
        this.lastRecordedPoint = current
        this.mergeNextPoint = false
      } else {
        this.mergeNextPoint = true
      }
    } else {
      this.mergeNextPoint = false
    }
    this.updateDrawingShape()
  }

  override onKeyDown(info: FreehandKeyboardEvent): void {
    if (info.key === 'Shift') {
      if (this.segmentMode === 'free') {
        this.segmentMode = 'starting_straight'
        this.pagePointWhereNextSegmentChanged = point(this.editor.inputs.getCurrentPagePoint())
      } else if (this.segmentMode === 'starting_free') {
        this.segmentMode = 'starting_straight'
      }
    }
    this.updateDrawingShape()
  }

  override onKeyUp(info: FreehandKeyboardEvent): void {
    if (info.key === 'Shift') {
      this.editor.snaps.clearIndicators()
      if (this.segmentMode === 'straight') {
        this.segmentMode = 'starting_free'
        this.pagePointWhereNextSegmentChanged = point(this.editor.inputs.getCurrentPagePoint())
      } else if (this.segmentMode === 'starting_straight') {
        this.pagePointWhereNextSegmentChanged = null
        this.segmentMode = 'free'
      }
    }
    this.updateDrawingShape()
  }

  override onExit(): void {
    this.editor.snaps.clearIndicators()
    this.pagePointWhereCurrentSegmentChanged = point(this.editor.inputs.getCurrentPagePoint())
  }

  canClose(): boolean {
    return this.shapeType !== 'highlight'
  }

  getIsClosed(
    segments: CanvasDrawShapeSegment[],
    size: keyof typeof strokeSizes,
    scale: number,
    strokeWidth?: number
  ): boolean {
    if (!this.canClose() || segments.length === 0) return false
    const width = strokeWidth ?? this.editor.getCurrentTheme().strokeWidth * strokeSizes[size]
    const first = firstPoint(segments[0])
    const last = lastPoint(segments[segments.length - 1])
    const threshold = this.editor.user.getIsDynamicResizeMode()
      ? (width + 2) * scale
      : 6 + 2 * Math.sqrt(width * 0.8) + 100 / (1 + Math.pow(this.zoomOnEnter / 0.18, 3))
    return Boolean(
      first &&
        last &&
        first !== last &&
        this.currentLineLength > width * 4 * scale &&
        Vec.DistMin(first, last, threshold)
    )
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onCancel(): void {
    this.cancel()
  }

  override onComplete(): void {
    this.complete()
  }

  override onInterrupt(): void {
    if (this.editor.inputs.getIsDragging()) return
    if (this.markId) this.editor.bailToMark(this.markId)
    this.cancel()
  }

  complete(): void {
    if (!this.initialShape) return
    this.editor.updateShapes([{ id: this.initialShape.id, type: this.initialShape.type, props: { isComplete: true } }])
    this.tool.transition('idle')
  }

  cancel(): void {
    this.tool.transition('idle', this.info)
  }

  private makeSegment(type: CanvasDrawShapeSegment['type'], values: VecModel[]): CanvasDrawShapeSegment {
    const path = encodePoints(values, this.segmentDim ?? DIM_3D)
    return this.segmentDim === DIM_2D ? { type, path, dim: DIM_2D } : { type, path }
  }

  private strokeWidth(shape: FreehandShape): number {
    return (
      this.editor.getShapeStrokeWidth?.(shape) ??
      this.editor.getCurrentTheme().strokeWidth * strokeSizes[shape.props.size]
    )
  }

  private startShape(): void {
    const inputs = this.editor.inputs
    const origin = point(inputs.getOriginPagePoint())
    const isPen = inputs.getIsPen()
    this.markId = this.editor.markHistoryStoppingPoint('draw start')
    const z = this.info.point.z ?? 0.5
    this.isPen = isPen
    this.isPenOrStylus = (isPen && z !== 0) || (z > 0 && z < 0.5) || (z > 0.5 && z < 1)
    this.segmentDim = this.isPenOrStylus ? undefined : DIM_2D
    const pressure = this.isPenOrStylus ? z * 1.25 : 0.5
    this.segmentMode = inputs.getShiftKey() ? 'straight' : 'free'
    this.didJustShiftClickToExtendPreviousShapeLine = false
    this.lastRecordedPoint = origin.clone()

    if (this.initialShape) {
      const shape = this.editor.getShape(this.initialShape.id)
      if (shape && this.segmentMode === 'straight') {
        this.didJustShiftClickToExtendPreviousShapeLine = true
        const previous = shape.props.segments[shape.props.segments.length - 1]
        const previousPoint = previous && lastPoint(previous)
        if (!previousPoint) throw new Error('Expected a previous point')
        const local = fixed(this.editor.getPointInShapeSpace(shape, origin))
        const segment = this.makeSegment('straight', [
          { x: previousPoint.x, y: previousPoint.y, z: +pressure.toFixed(2) },
          { x: local.x, y: local.y, z: +pressure.toFixed(2) }
        ])
        const transform = this.editor.getShapePageTransform(shape)
        if (!transform) throw new Error('Expected a shape transform')
        this.pagePointWhereCurrentSegmentChanged = Mat.applyToPoint(transform, previousPoint)
        this.pagePointWhereNextSegmentChanged = null
        const segments = [...shape.props.segments, segment]
        if (this.currentLineLength < this.strokeWidth(shape) * 4) this.currentLineLength = this.getLineLength(segments)
        const props: Record<string, unknown> = { segments }
        if (this.canClose()) {
          props.isClosed = this.getIsClosed(segments, shape.props.size, shape.props.scale)
        }
        this.editor.updateShapes([{ id: shape.id, type: this.shapeType, props }])
        return
      }
    }

    this.pagePointWhereCurrentSegmentChanged = origin.clone()
    const id = createShapeId()
    const initialPoint = new Vec(0, 0, +pressure.toFixed(2))
    this.currentSegmentPoints = [initialPoint]
    this.editor.createShape({
      id,
      type: this.shapeType,
      x: origin.x,
      y: origin.y,
      props: {
        isPen: this.isPenOrStylus,
        scale: this.editor.getResizeScaleFactor(),
        segments: [this.makeSegment(this.segmentMode, [initialPoint])]
      }
    })
    const shape = this.editor.getShape(id)
    if (!shape) {
      this.cancel()
      return
    }
    this.currentLineLength = 0
    this.initialShape = shape
  }

  private updateDrawingShape(): void {
    const initial = this.initialShape
    if (!initial) return
    const shape = this.editor.getShape(initial.id)
    if (!shape) return
    const segments = shape.props.segments
    const currentPagePoint = point(this.editor.inputs.getCurrentPagePoint())
    const local = fixed(this.editor.getPointInShapeSpace(shape, currentPagePoint))
    const pressure = this.isPenOrStylus ? +((currentPagePoint.z ?? 0.5) * 1.25).toFixed(2) : 0.5
    let newPoint: VecModel = { x: local.x, y: local.y, z: pressure }

    if (this.segmentMode === 'starting_straight') {
      const changed = this.pagePointWhereNextSegmentChanged
      if (!changed) throw new Error('Expected a point where the segment changed')
      if (Vec.Dist2(changed, currentPagePoint) > this.editor.options.dragDistanceSquared) {
        this.pagePointWhereCurrentSegmentChanged = changed.clone()
        this.pagePointWhereNextSegmentChanged = null
        this.segmentMode = 'straight'
        const previous = segments[segments.length - 1]
        const previousLast = previous && lastPoint(previous)
        if (!previousLast) throw new Error('Expected a previous last point')
        const changedLocal = fixed(this.editor.getPointInShapeSpace(shape, changed))
        let next: CanvasDrawShapeSegment
        if (previous.type === 'straight') {
          this.currentLineLength += Vec.Dist(previousLast, changedLocal)
          next = this.makeSegment('straight', [previousLast, changedLocal])
          const transform = this.editor.getShapePageTransform(shape)
          if (!transform) throw new Error('Expected a shape transform')
          this.pagePointWhereCurrentSegmentChanged = Mat.applyToPoint(transform, previousLast)
        } else {
          next = this.makeSegment('straight', [changedLocal, newPoint])
        }
        const nextSegments = [...segments, next]
        this.updateSegments(shape, nextSegments, segments)
      }
      return
    }

    if (this.segmentMode === 'starting_free') {
      const changed = this.pagePointWhereNextSegmentChanged
      if (!changed) throw new Error('Expected a point where the segment changed')
      if (Vec.Dist2(changed, currentPagePoint) > this.editor.options.dragDistanceSquared) {
        this.pagePointWhereCurrentSegmentChanged = changed.clone()
        this.pagePointWhereNextSegmentChanged = null
        this.segmentMode = 'free'
        const previous = segments[segments.length - 1]
        const previousPoint = previous && lastPoint(previous)
        if (!previousPoint) throw new Error('Expected a previous point')
        this.currentSegmentPoints = pointsBetween(previousPoint, newPoint, 6).map(fixed)
        const nextSegments = [...segments, this.makeSegment('free', this.currentSegmentPoints)]
        if (this.currentLineLength < this.strokeWidth(shape) * 4)
          this.currentLineLength = this.getLineLength(nextSegments)
        this.updateSegments(shape, nextSegments)
      }
      return
    }

    if (this.segmentMode === 'straight') {
      const nextSegments = segments.slice()
      const segment = nextSegments[nextSegments.length - 1]
      const ctrlKey = this.editor.inputs.getCtrlKey()
      let shouldSnapToAngle = false
      if (this.didJustShiftClickToExtendPreviousShapeLine) {
        if (this.editor.inputs.getIsDragging()) {
          shouldSnapToAngle = !ctrlKey
          this.didJustShiftClickToExtendPreviousShapeLine = false
        }
      } else {
        shouldSnapToAngle = !ctrlKey
      }
      newPoint = json(fixed(this.editor.getPointInShapeSpace(shape, currentPagePoint)))
      let snappedSegment: CanvasDrawShapeSegment | undefined
      if (this.editor.user.getIsSnapMode() ? !ctrlKey : ctrlKey) {
        if (nextSegments.length > 2) {
          let distance = 8 / this.zoomOnEnter
          for (let i = 0; i < segments.length - 2; i++) {
            const candidate = segments[i]
            if (candidate.type === 'free') continue
            const a = firstPoint(candidate)
            const b = lastPoint(candidate)
            if (!a || !b) continue
            const nearest = Vec.NearestPointOnLineSegment(a, b, newPoint)
            if (Vec.DistMin(nearest, newPoint, distance)) {
              newPoint = json(fixed(nearest))
              distance = Vec.Dist(nearest, newPoint)
              snappedSegment = candidate
              break
            }
          }
        }
      }
      if (snappedSegment) {
        const transform = this.editor.getShapePageTransform(shape)
        const a = firstPoint(snappedSegment)
        const b = lastPoint(snappedSegment)
        if (!transform || !a || !b) throw new Error('Expected a snapped segment')
        this.editor.snaps.setIndicators([
          {
            id: uniqueId(),
            type: 'points',
            points: [
              Mat.applyToPoint(transform, a),
              Mat.applyToPoint(transform, newPoint),
              Mat.applyToPoint(transform, b)
            ]
          }
        ])
      } else {
        this.editor.snaps.clearIndicators()
        let pagePoint = currentPagePoint
        if (shouldSnapToAngle) {
          const angle = Vec.Angle(this.pagePointWhereCurrentSegmentChanged, currentPagePoint)
          pagePoint = Vec.RotWith(
            currentPagePoint,
            this.pagePointWhereCurrentSegmentChanged,
            snapAngle(angle, 24) - angle
          )
        }
        newPoint = json(fixed(this.editor.getPointInShapeSpace(shape, pagePoint)))
      }
      const first = firstPoint(segment)
      this.currentLineLength += first ? Vec.Dist(first, newPoint) : 0
      if (!first) throw new Error('Expected a segment point')
      nextSegments[nextSegments.length - 1] = {
        ...segment,
        type: 'straight',
        path: encodePoints([first, newPoint], segment.dim ?? DIM_3D)
      }
      this.updateSegments(shape, nextSegments, segments)
      return
    }

    const cached = this.currentSegmentPoints
    if (cached.length && this.mergeNextPoint) {
      const last = cached[cached.length - 1]
      last.x = newPoint.x
      last.y = newPoint.y
      last.z = last.z ? Math.max(last.z, newPoint.z ?? 0.5) : (newPoint.z ?? 0.5)
    } else {
      this.currentLineLength += cached.length ? Vec.Dist(cached[cached.length - 1], newPoint) : 0
      cached.push(point(newPoint))
    }
    const nextSegments = segments.slice()
    const segment = nextSegments[nextSegments.length - 1]
    nextSegments[nextSegments.length - 1] = {
      ...segment,
      path: encodePoints(cached, segment.dim ?? DIM_3D)
    }
    if (this.currentLineLength < this.strokeWidth(shape) * 4) this.currentLineLength = this.getLineLength(nextSegments)
    this.updateSegments(shape, nextSegments)
    if (cached.length > this.editor.getShapeUtil(this.shapeType).options.maxPointsPerShape) {
      this.editor.updateShapes([{ id: shape.id, type: this.shapeType, props: { isComplete: true } }])
      const id = createShapeId()
      if (!this.editor.canCreateShapes([id])) {
        this.cancel()
        return
      }
      const splitPoint = point(this.editor.inputs.getCurrentPagePoint())
      const initialPoint = new Vec(0, 0, this.isPenOrStylus ? +((local.z ?? 0.5) * 1.25).toFixed() : 0.5)
      this.currentSegmentPoints = [initialPoint]
      this.editor.createShape({
        id,
        type: this.shapeType,
        x: toFixed(splitPoint.x),
        y: toFixed(splitPoint.y),
        props: {
          isPen: this.isPenOrStylus,
          scale: shape.props.scale,
          segments: [this.makeSegment('free', [initialPoint])]
        }
      })
      const split = this.editor.getShape(id)
      if (!split) {
        this.cancel()
        return
      }
      this.initialShape = structuredClone(split)
      this.mergeNextPoint = false
      this.lastRecordedPoint = splitPoint
      this.currentLineLength = 0
    }
  }

  private updateSegments(shape: FreehandShape, segments: CanvasDrawShapeSegment[], closureSegments = segments): void {
    const props: Record<string, unknown> = { segments }
    if (this.canClose()) {
      props.isClosed = this.getIsClosed(closureSegments, shape.props.size, shape.props.scale)
    }
    this.editor.updateShapes([{ id: shape.id, type: this.shapeType, props }])
  }

  private getLineLength(segments: CanvasDrawShapeSegment[]): number {
    let length = 0
    for (const segment of segments) {
      const values = decodePoints(segment.path, segment.dim ?? DIM_3D)
      for (let i = 0; i < values.length - 1; i++) length += Vec.Dist2(values[i], values[i + 1])
    }
    return Math.sqrt(length)
  }
}
