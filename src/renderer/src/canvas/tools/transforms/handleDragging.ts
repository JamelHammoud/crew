import { Mat } from '../../math/Mat'
import { Vec, type VecLike } from '../../math/Vec'
import type { TLShape } from '../../schema'
import { snapAngle } from './rotation'
import {
  TransformState,
  type HandleDragInfo,
  type ShapeUpdate,
  type TransformEditor,
  type TransformHandle
} from './types'

export interface DragHandleOptions {
  initialHandle: TransformHandle
  initialAdjacentHandle?: TransformHandle | null
  originPagePoint: VecLike
  currentPagePoint: VecLike
  pageRotation: number
  shiftKey?: boolean
}

export function dragHandle(options: DragHandleOptions): TransformHandle {
  const {
    initialHandle,
    initialAdjacentHandle,
    originPagePoint,
    currentPagePoint,
    pageRotation,
    shiftKey = false
  } = options

  let point = Vec.Sub(currentPagePoint, originPagePoint).rot(-pageRotation).add(initialHandle)

  if (shiftKey && initialAdjacentHandle && initialHandle.id !== 'middle') {
    const angle = Vec.Angle(initialAdjacentHandle, point)
    point = Vec.RotWith(point, initialAdjacentHandle, snapAngle(angle, 24) - angle)
  }

  return { ...initialHandle, x: point.x, y: point.y }
}

export const dragHandleToPoint = dragHandle

export function findAdjacentHandle(
  handles: readonly TransformHandle[],
  handle: TransformHandle
): TransformHandle | null {
  const sorted = [...handles].sort((a, b) => (a.index ?? '').localeCompare(b.index ?? ''))
  if (handle.snapReferenceHandleId) {
    const named = sorted.find(other => other.id === handle.snapReferenceHandleId)
    if (named) return named
  }
  const isVertex = (other: TransformHandle): boolean =>
    other.type === 'vertex' && other.id !== 'middle' && other.id !== handle.id
  const index = sorted.findIndex(other => other.id === handle.id)
  for (let i = index + 1; i < sorted.length; i++) {
    if (isVertex(sorted[i])) return sorted[i]
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (isVertex(sorted[i])) return sorted[i]
  }
  return null
}

export interface DraggingHandleInfo<Shape extends TLShape = TLShape> {
  target?: 'handle'
  shape: Shape
  handle: TransformHandle
  adjacentHandle?: TransformHandle | null
  pageRotation?: number
  onInteractionEnd?: string | (() => void)
  isCreating?: boolean
  creatingMarkId?: string
}

export class DraggingHandle<Shape extends TLShape = TLShape> extends TransformState<
  TransformEditor<Shape>,
  DraggingHandleInfo<Shape>
> {
  static override id = 'dragging_handle'
  static override trackPerformance = true

  info!: DraggingHandleInfo<Shape>
  initialHandle!: TransformHandle
  currentHandle!: TransformHandle
  adjacentHandle: TransformHandle | null = null
  initialPagePoint = new Vec()
  pageRotation = 0
  markId = ''
  isPrecise = false

  override onEnter(info: DraggingHandleInfo<Shape>): void {
    this.info = info
    this.parent.setCurrentToolIdMask?.(typeof info.onInteractionEnd === 'string' ? info.onInteractionEnd : undefined)
    this.initialHandle = { ...info.handle }
    this.currentHandle = { ...info.handle }
    this.adjacentHandle = info.adjacentHandle
      ? { ...info.adjacentHandle }
      : findAdjacentHandle(this.editor.getShapeHandles?.(info.shape) ?? [], info.handle)
    this.initialPagePoint = this.editor.inputs.getOriginPagePoint().clone()
    this.pageRotation =
      info.pageRotation ??
      (this.editor.getShapePageTransform
        ? Mat.Rotation(this.editor.getShapePageTransform(info.shape) ?? Mat.Identity())
        : 0)
    this.markId = info.creatingMarkId ?? this.editor.markHistoryStoppingPoint?.('dragging handle') ?? ''
    this.editor.setCursor?.({ type: info.isCreating ? 'cross' : 'grabbing', rotation: 0 })
    const start = this.editor.getShapeUtil?.(info.shape).onHandleDragStart?.(info.shape, this.dragInfo())
    if (start) this.editor.updateShapes([start])
    this.update()
    this.editor.select?.(info.shape.id)
  }

  override onExit(): void {
    this.parent.setCurrentToolIdMask?.(undefined)
    this.editor.snaps?.clearIndicators?.()
    this.editor.setCursor?.({ type: 'default', rotation: 0 })
  }

  onPointerMove(): void {
    this.update()
  }

  onKeyDown(): void {
    this.update()
  }

  onKeyUp(): void {
    this.update()
  }

  onPointerUp(): void {
    this.complete()
  }

  onComplete(): void {
    this.update()
    this.complete()
  }

  onCancel(): void {
    const shape = this.editor.getShape(this.info.shape.id)
    if (shape) this.editor.getShapeUtil?.(shape).onHandleDragCancel?.(shape, this.dragInfo())
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.finish(false)
  }

  private dragInfo(handle = this.initialHandle): HandleDragInfo<Shape> {
    return {
      handle,
      isPrecise: this.isPrecise || !!this.editor.inputs.getAltKey?.(),
      isCreatingShape: !!this.info.isCreating,
      initial: this.info.shape
    }
  }

  private update(): void {
    const shape = this.editor.getShape(this.info.shape.id)
    if (!shape) return
    const handle = dragHandle({
      initialHandle: this.initialHandle,
      initialAdjacentHandle: this.adjacentHandle,
      originPagePoint: this.initialPagePoint,
      currentPagePoint: this.editor.inputs.getCurrentPagePoint(),
      pageRotation: this.pageRotation,
      shiftKey: this.editor.inputs.getShiftKey()
    })
    this.currentHandle = handle
    const changes = this.editor.getShapeUtil?.(shape).onHandleDrag?.(shape, this.dragInfo(handle))
    if (changes) {
      this.editor.updateShapes([{ ...changes, id: shape.id, type: shape.type } as ShapeUpdate<Shape>])
    }
  }

  private complete(): void {
    this.editor.snaps?.clearIndicators?.()
    this.editor.kickoutOccludedShapes?.([this.info.shape.id])
    const shape = this.editor.getShape(this.info.shape.id)
    if (shape) {
      const changes = this.editor.getShapeUtil?.(shape).onHandleDragEnd?.(shape, this.dragInfo(this.currentHandle))
      if (changes) this.editor.updateShapes([changes])
    }
    this.finish(false)
  }

  private finish(cancelled: boolean): void {
    const end = this.info.onInteractionEnd
    if (typeof end === 'function') {
      end()
      return
    }
    if (typeof end === 'string' && (cancelled || this.editor.getInstanceState?.().isToolLocked)) {
      this.editor.setCurrentTool?.(end, { shapeId: this.info.shape.id })
      return
    }
    this.parent.transition('idle')
  }
}
