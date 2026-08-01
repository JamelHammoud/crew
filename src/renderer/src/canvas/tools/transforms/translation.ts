import { Mat, type MatLike } from '../../math/Mat'
import { Vec, type VecLike } from '../../math/Vec'
import type { TLShape } from '../../schema'
import {
  TransformState,
  type ShapeUpdate,
  type TransformEditor,
  type TransformSnapNode,
  type TransformSnapPoint
} from './types'

export interface TranslationSnapshot<Shape extends TLShape = TLShape> {
  shape: Shape
  pagePoint: Vec
  parentTransform: MatLike | null
}

export interface TranslateOptions {
  shiftKey?: boolean
  gridSize?: number
  averagePagePoint?: VecLike
  nudge?: VecLike
}

export function getTranslationDelta(
  originPagePoint: VecLike,
  currentPagePoint: VecLike,
  options: TranslateOptions = {}
): Vec {
  const delta = Vec.Sub(currentPagePoint, originPagePoint)

  if (options.shiftKey) {
    if (Math.abs(delta.x) < Math.abs(delta.y)) delta.x = 0
    else delta.y = 0
  }

  if (options.nudge) delta.add(options.nudge)

  if (options.gridSize && options.averagePagePoint) {
    const snapped = Vec.Add(options.averagePagePoint, delta).snapToGrid(options.gridSize)
    return snapped.sub(options.averagePagePoint)
  }

  return delta
}

export function translateShape<Shape extends TLShape>(
  snapshot: TranslationSnapshot<Shape>,
  delta: VecLike
): ShapeUpdate<Shape> {
  const pagePoint = Vec.Add(snapshot.pagePoint, delta)
  const localPoint = snapshot.parentTransform ? Mat.applyToPoint(snapshot.parentTransform, pagePoint) : pagePoint

  return {
    id: snapshot.shape.id,
    type: snapshot.shape.type,
    x: localPoint.x,
    y: localPoint.y
  } as ShapeUpdate<Shape>
}

export function translateShapes<Shape extends TLShape>(
  snapshots: TranslationSnapshot<Shape>[],
  delta: VecLike
): ShapeUpdate<Shape>[] {
  return snapshots.map(snapshot => translateShape(snapshot, delta))
}

export function moveShapesToPoint<Shape extends TLShape>({
  snapshots,
  originPagePoint,
  currentPagePoint,
  options
}: {
  snapshots: TranslationSnapshot<Shape>[]
  originPagePoint: VecLike
  currentPagePoint: VecLike
  options?: TranslateOptions
}): ShapeUpdate<Shape>[] {
  return translateShapes(snapshots, getTranslationDelta(originPagePoint, currentPagePoint, options))
}

export interface TranslatingInfo<Shape extends TLShape = TLShape> {
  target?: 'shape'
  snapshots?: TranslationSnapshot<Shape>[]
  initialPageBounds?: import('../../math/Box').Box
  initialSnapPoints?: readonly TransformSnapPoint[]
  snappableShapes?: readonly TransformSnapNode[]
  zoom?: number
  isCreating?: boolean
  creatingMarkId?: string
  onCreate?(shape: Shape | null): void
  onInteractionEnd?: string | (() => void)
}

export interface TranslatingDragTargets {
  startDraggingShapes(shapes: readonly TLShape[], point: Vec, onReparent?: () => void): void
  dropShapes(shapes: readonly TLShape[]): void
  clear(): void
}

export class Translating<Shape extends TLShape = TLShape> extends TransformState<
  TransformEditor<Shape>,
  TranslatingInfo<Shape>
> {
  static override id = 'translating'
  static override trackPerformance = true

  info: TranslatingInfo<Shape> = {}
  selectionSnapshots: TranslationSnapshot<Shape>[] = []
  snapshots: TranslationSnapshot<Shape>[] = []
  markId = ''
  isCloning = false
  dragTargets?: TranslatingDragTargets

  override onEnter(info: TranslatingInfo<Shape>): void {
    this.info = info
    this.parent.setCurrentToolIdMask?.(typeof info.onInteractionEnd === 'string' ? info.onInteractionEnd : undefined)
    this.isCloning = false
    this.selectionSnapshots = info.snapshots ?? this.createSnapshots()
    if (this.selectionSnapshots.length === 0) {
      this.parent.transition('idle')
      return
    }
    this.markId = info.creatingMarkId ?? this.editor.markHistoryStoppingPoint?.('translating') ?? ''
    this.editor.setCursor?.({ type: 'move', rotation: 0 })

    if (!info.isCreating && this.editor.inputs.getAltKey?.()) {
      this.startCloning()
      if (this.isCloning) return
    }

    this.snapshots = this.selectionSnapshots
    this.handleStart()
    this.update()
  }

  override onExit(): void {
    this.parent.setCurrentToolIdMask?.(undefined)
    this.editor.snaps?.clearIndicators?.()
    this.editor.setCursor?.({ type: 'default', rotation: 0 })
    this.dragTargets?.clear()
  }

  onPointerMove(): void {
    this.update()
  }

  onKeyDown(): void {
    if (this.editor.inputs.getAltKey?.() && !this.isCloning && !this.info.isCreating) {
      this.startCloning()
      if (this.isCloning) return
    }
    this.update()
  }

  onKeyUp(): void {
    if (!this.editor.inputs.getAltKey?.() && this.isCloning) {
      this.stopCloning()
      return
    }
    this.update()
  }

  onPointerUp(): void {
    this.complete()
  }

  onComplete(): void {
    this.complete()
  }

  onCancel(): void {
    for (const { shape } of this.snapshots) {
      const current = this.editor.getShape(shape.id)
      if (current) this.editor.getShapeUtil?.(shape).onTranslateCancel?.(shape, current)
    }
    this.editor.snaps?.clearIndicators?.()
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.finish(false)
  }

  private startCloning(): void {
    const ids = this.editor.getSelectedShapeIds?.() ?? []
    if (!ids.length) return
    if (this.editor.canCreateShapes && !this.editor.canCreateShapes(ids)) return
    this.isCloning = true
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.markId = this.editor.markHistoryStoppingPoint?.('translate cloning') ?? ''
    this.editor.duplicateShapes?.(this.editor.getSelectedShapeIds?.() ?? [])
    this.snapshots = this.createSnapshots()
    this.handleStart()
    this.update()
  }

  private stopCloning(): void {
    this.isCloning = false
    this.snapshots = this.selectionSnapshots
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.markId = this.editor.markHistoryStoppingPoint?.('translate') ?? ''
    this.update()
  }

  private handleStart(): void {
    this.applyLifecycle('start')
    const shapes = this.snapshots
      .map(snapshot => this.editor.getShape(snapshot.shape.id))
      .filter(Boolean) as TLShape[]
    this.dragTargets?.startDraggingShapes(shapes, Vec.From(this.editor.inputs.getOriginPagePoint()), () =>
      this.refreshParentTransforms()
    )
    this.editor.setHoveredShape?.(null)
  }

  private refreshParentTransforms(): void {
    for (const snapshot of this.snapshots) {
      const shape = this.editor.getShape(snapshot.shape.id)
      if (!shape) continue
      const parentPageTransform = shape.parentId.startsWith('shape:')
        ? this.editor.getShapePageTransform?.(shape.parentId as Shape['id'])
        : undefined
      snapshot.parentTransform = parentPageTransform ? Mat.Inverse(parentPageTransform) : null
    }
  }

  private createSnapshots(): TranslationSnapshot<Shape>[] {
    return (this.editor.getSelectedShapeIds?.() ?? []).flatMap(id => {
      const shape = this.editor.getShape(id)
      const pageTransform = shape && this.editor.getShapePageTransform?.(shape)
      if (!shape || !pageTransform) return []
      const parentPageTransform = shape.parentId.startsWith('shape:')
        ? this.editor.getShapeParentTransform?.(shape)
        : undefined
      return [
        {
          shape,
          pagePoint: Mat.Point(pageTransform),
          parentTransform: parentPageTransform ? Mat.Inverse(parentPageTransform) : null
        }
      ]
    })
  }

  private update(): void {
    const shapes = this.snapshots
      .map(snapshot => this.editor.getShape(snapshot.shape.id))
      .filter(Boolean) as TLShape[]
    this.dragTargets?.startDraggingShapes(shapes, Vec.From(this.editor.inputs.getOriginPagePoint()), () =>
      this.refreshParentTransforms()
    )

    const averagePagePoint = Vec.Average(this.snapshots.map(snapshot => snapshot.pagePoint))
    const originPagePoint = this.editor.inputs.getOriginPagePoint()
    const currentPagePoint = this.editor.inputs.getCurrentPagePoint()
    const rawDelta = Vec.Sub(currentPagePoint, originPagePoint)
    const lockedAxis = this.editor.inputs.getShiftKey()
      ? Math.abs(rawDelta.x) < Math.abs(rawDelta.y)
        ? 'x'
        : 'y'
      : null
    const delta = getTranslationDelta(originPagePoint, currentPagePoint, {
      shiftKey: this.editor.inputs.getShiftKey()
    })
    const snapMode = this.editor.getIsSnapMode?.() ?? true
    const accelKey = this.editor.inputs.getAccelKey?.() ?? false
    const slowEnough = (this.editor.inputs.getPointerVelocity?.()?.len() ?? 0) < 0.5
    const snap =
      (snapMode ? !accelKey : accelKey) && slowEnough && this.info.initialPageBounds
        ? this.editor.snaps?.snapTranslateBounds?.({
            initialSelectionPageBounds: this.info.initialPageBounds,
            initialSelectionSnapPoints: this.info.initialSnapPoints,
            dragDelta: delta,
            snappableShapes: this.info.snappableShapes ?? this.editor.getSnappableShapes?.() ?? [],
            lockedAxis,
            zoom: this.info.zoom ?? this.editor.getZoomLevel?.() ?? 1
          })
        : undefined
    if (snap) delta.add(snap.nudge)
    this.editor.snaps?.setIndicators?.(snap?.indicators ?? [])
    const gridSize = this.editor.getInstanceState?.().isGridMode
      ? this.editor.getDocumentSettings?.().gridSize
      : undefined
    if (gridSize && !accelKey && !snap?.indicators.length) {
      delta.setTo(Vec.Add(averagePagePoint, delta).snapToGrid(gridSize).sub(averagePagePoint))
    }
    const updates = translateShapes(this.snapshots, delta)
    this.editor.updateShapes(updates)
    this.applyLifecycle('update')
  }

  private applyLifecycle(stage: 'start' | 'update' | 'end'): void {
    const updates: ShapeUpdate<Shape>[] = []
    for (const { shape } of this.snapshots) {
      const util = this.editor.getShapeUtil?.(shape)
      const current = this.editor.getShape(shape.id)
      const update =
        stage === 'start'
          ? util?.onTranslateStart?.(shape)
          : stage === 'update' && current
            ? util?.onTranslate?.(shape, current)
            : stage === 'end' && current
              ? util?.onTranslateEnd?.(shape, current)
              : undefined
      if (update) updates.push(update)
    }
    if (updates.length) this.editor.updateShapes(updates)
  }

  private complete(): void {
    this.update()
    this.applyLifecycle('end')
    if (this.info.isCreating) {
      const shape = this.snapshots[0] ? (this.editor.getShape(this.snapshots[0].shape.id) ?? null) : null
      this.info.onCreate?.(shape)
    }
    this.finish(true)
  }

  private finish(completed: boolean): void {
    const end = this.info.onInteractionEnd
    if (typeof end === 'function') {
      end()
      return
    }
    if (typeof end === 'string') {
      this.editor.setCurrentTool?.(end)
      return
    }
    if (completed && this.info.isCreating) return
    this.parent.transition('idle', this.info)
  }
}
