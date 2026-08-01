import { Mat, type MatLike } from '../../math/Mat'
import { canonicalizeRotation, degreesToRadians, shortAngleDist } from '../../math/utils'
import { Vec, type VecLike } from '../../math/Vec'
import type { TLShape } from '../../schema'
import { TransformState, type ShapeUpdate, type TransformEditor } from './types'

export interface RotationShapeSnapshot<Shape extends TLShape = TLShape> {
  shape: Shape
  initialPagePoint: Vec
  parentTransform: MatLike | null
}

export interface RotationSnapshot<Shape extends TLShape = TLShape> {
  initialPageCenter: Vec
  initialCursorAngle: number
  initialShapesRotation: number
  shapeSnapshots: RotationShapeSnapshot<Shape>[]
}

export function snapAngle(angle: number, segments: number): number {
  const segment = (Math.PI * 2) / segments
  return Math.round(angle / segment) * segment
}

export function getRotationDelta({
  snapshot,
  currentPagePoint,
  shiftKey = false,
  snapToNearestDegree = false,
  isCoarsePointer = false
}: {
  snapshot: RotationSnapshot
  currentPagePoint: VecLike
  shiftKey?: boolean
  snapToNearestDegree?: boolean
  isCoarsePointer?: boolean
}): number {
  const currentAngle = snapshot.initialPageCenter.angle(currentPagePoint)
  let rotation = snapshot.initialShapesRotation + currentAngle - snapshot.initialCursorAngle

  if (shiftKey) {
    rotation = snapAngle(rotation, 24)
  } else if (snapToNearestDegree) {
    const degree = Math.PI / 180
    rotation = Math.round(rotation / degree) * degree
    if (isCoarsePointer) {
      const rightAngle = snapAngle(rotation, 4)
      if (Math.abs(shortAngleDist(rotation, rightAngle)) < degreesToRadians(5)) {
        rotation = rightAngle
      }
    }
  }

  return rotation - snapshot.initialShapesRotation
}

export function rotateShape<Shape extends TLShape>(
  snapshot: RotationShapeSnapshot<Shape>,
  delta: number,
  center: VecLike
): ShapeUpdate<Shape> {
  const newPagePoint = Vec.RotWith(snapshot.initialPagePoint, center, delta)
  const newLocalPoint = snapshot.parentTransform
    ? Mat.applyToPoint(snapshot.parentTransform, newPagePoint)
    : newPagePoint

  return {
    id: snapshot.shape.id,
    type: snapshot.shape.type,
    x: newLocalPoint.x,
    y: newLocalPoint.y,
    rotation: canonicalizeRotation(snapshot.shape.rotation + delta)
  } as ShapeUpdate<Shape>
}

export function rotateShapes<Shape extends TLShape>(
  snapshot: RotationSnapshot<Shape>,
  delta: number,
  center: VecLike = snapshot.initialPageCenter
): ShapeUpdate<Shape>[] {
  return snapshot.shapeSnapshots.map(shape => rotateShape(shape, delta, center))
}

export const applyRotationToSnapshotShapes = rotateShapes

export const ROTATE_CURSOR_TYPES: Record<string, string> = {
  bottom_left_rotate: 'swne-rotate',
  bottom_right_rotate: 'senw-rotate',
  top_left_rotate: 'nwse-rotate',
  top_right_rotate: 'nesw-rotate',
  mobile_rotate: 'grabbing'
}

export interface RotatingInfo<Shape extends TLShape = TLShape> {
  target?: 'selection'
  handle?: string
  snapshot?: RotationSnapshot<Shape>
  onInteractionEnd?: string | (() => void)
}

export class Rotating<Shape extends TLShape = TLShape> extends TransformState<
  TransformEditor<Shape>,
  RotatingInfo<Shape>
> {
  static override id = 'rotating'
  static override trackPerformance = true

  info: RotatingInfo<Shape> = {}
  snapshot!: RotationSnapshot<Shape>
  markId = ''

  override onEnter(info: RotatingInfo<Shape>): void {
    this.info = info
    this.parent.setCurrentToolIdMask?.(typeof info.onInteractionEnd === 'string' ? info.onInteractionEnd : undefined)
    const snapshot = info.snapshot ?? this.createSnapshot()
    if (!snapshot) {
      this.parent.transition('idle', info)
      return
    }
    this.snapshot = snapshot
    this.markId = this.editor.markHistoryStoppingPoint?.('rotate start') ?? ''
    this.apply('start', false)
  }

  override onExit(): void {
    this.parent.setCurrentToolIdMask?.(undefined)
    this.editor.setCursor?.({ type: 'default', rotation: 0 })
  }

  onPointerMove(): void {
    this.apply('update', false)
  }

  onKeyDown(): void {
    this.apply('update', false)
  }

  onKeyUp(): void {
    this.apply('update', false)
  }

  onPointerUp(): void {
    this.complete()
  }

  onComplete(): void {
    this.complete()
  }

  onCancel(): void {
    for (const { shape } of this.snapshot.shapeSnapshots) {
      const current = this.editor.getShape(shape.id)
      if (current) this.editor.getShapeUtil?.(shape).onRotateCancel?.(shape, current)
    }
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.finish()
  }

  private createSnapshot(): RotationSnapshot<Shape> | undefined {
    const ids = this.editor.getSelectedShapeIds?.() ?? []
    const bounds = this.editor.getSelectionRotatedPageBounds?.()
    if (!bounds || ids.length === 0) return undefined
    const rotation = this.editor.getSelectionRotation?.() ?? 0
    const center = bounds.center.clone().rotWith(bounds.point, rotation)
    const shapeSnapshots = ids.flatMap(id => {
      const shape = this.editor.getShape(id)
      const pageTransform = shape && this.editor.getShapePageTransform?.(shape)
      if (!shape || !pageTransform) return []
      const parentPageTransform = shape.parentId.startsWith('shape:')
        ? this.editor.getShapeParentTransform?.(shape)
        : undefined
      return [
        {
          shape,
          initialPagePoint: Mat.Point(pageTransform),
          parentTransform: parentPageTransform ? Mat.Inverse(parentPageTransform) : null
        }
      ]
    })
    return {
      initialPageCenter: center,
      initialCursorAngle: center.angle(this.editor.inputs.getOriginPagePoint()),
      initialShapesRotation: rotation,
      shapeSnapshots
    }
  }

  private apply(stage: 'start' | 'update' | 'end', snapToNearestDegree: boolean): void {
    const delta = getRotationDelta({
      snapshot: this.snapshot,
      currentPagePoint: this.editor.inputs.getCurrentPagePoint(),
      shiftKey: this.editor.inputs.getShiftKey(),
      snapToNearestDegree,
      isCoarsePointer: this.editor.getInstanceState?.().isCoarsePointer
    })
    this.editor.updateShapes(rotateShapes(this.snapshot, delta))
    const lifecycle: ShapeUpdate<Shape>[] = []
    for (const { shape } of this.snapshot.shapeSnapshots) {
      const current = this.editor.getShape(shape.id)
      if (!current) continue
      const util = this.editor.getShapeUtil?.(shape)
      if (stage === 'start') {
        const start = util?.onRotateStart?.(shape)
        if (start) lifecycle.push(start)
      }
      const update = util?.onRotate?.(shape, current)
      if (update) lifecycle.push(update)
      if (stage === 'end') {
        const end = util?.onRotateEnd?.(shape, current)
        if (end) lifecycle.push(end)
      }
    }
    if (lifecycle.length) this.editor.updateShapes(lifecycle)
    this.editor.setCursor?.({
      type: ROTATE_CURSOR_TYPES[this.info.handle ?? ''] ?? 'rotate',
      rotation: delta + this.snapshot.initialShapesRotation
    })
  }

  private complete(): void {
    this.apply('end', true)
    this.editor.kickoutOccludedShapes?.(this.snapshot.shapeSnapshots.map(snapshot => snapshot.shape.id))
    this.finish()
  }

  private finish(): void {
    const end = this.info.onInteractionEnd
    if (typeof end === 'function') end()
    else if (typeof end === 'string') this.editor.setCurrentTool?.(end, this.info)
    else this.parent.transition('idle', this.info)
  }
}
