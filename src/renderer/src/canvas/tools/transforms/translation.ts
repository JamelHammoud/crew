import { Mat, type MatLike } from '../../math/Mat'
import { Vec, type VecLike } from '../../math/Vec'
import type { TLShape } from '../../schema'
import { TransformState, type ShapeUpdate, type TransformEditor } from './types'

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
  isCreating?: boolean
  creatingMarkId?: string
  onCreate?(shape: Shape | null): void
  onInteractionEnd?: string | (() => void)
}

export class Translating<Shape extends TLShape = TLShape> extends TransformState<
  TransformEditor<Shape>,
  TranslatingInfo<Shape>
> {
  static override id = 'translating'
  static override trackPerformance = true

  info: TranslatingInfo<Shape> = {}
  snapshots: TranslationSnapshot<Shape>[] = []
  markId = ''

  override onEnter(info: TranslatingInfo<Shape>): void {
    this.info = info
    this.parent.setCurrentToolIdMask?.(typeof info.onInteractionEnd === 'string' ? info.onInteractionEnd : undefined)
    this.snapshots = info.snapshots ?? this.createSnapshots()
    if (this.snapshots.length === 0) {
      this.parent.transition('idle')
      return
    }
    this.markId = info.creatingMarkId ?? this.editor.markHistoryStoppingPoint?.('translating') ?? ''
    this.editor.setCursor?.({ type: 'move', rotation: 0 })
    this.applyLifecycle('start')
    this.update()
  }

  override onExit(): void {
    this.parent.setCurrentToolIdMask?.(undefined)
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
    this.complete()
  }

  onCancel(): void {
    for (const { shape } of this.snapshots) {
      const current = this.editor.getShape(shape.id)
      if (current) this.editor.getShapeUtil?.(shape).onTranslateCancel?.(shape, current)
    }
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.finish(false)
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
    const averagePagePoint = Vec.Average(this.snapshots.map(snapshot => snapshot.pagePoint))
    const gridSize = this.editor.getInstanceState?.().isGridMode
      ? this.editor.getDocumentSettings?.().gridSize
      : undefined
    const updates = moveShapesToPoint({
      snapshots: this.snapshots,
      originPagePoint: this.editor.inputs.getOriginPagePoint(),
      currentPagePoint: this.editor.inputs.getCurrentPagePoint(),
      options: {
        shiftKey: this.editor.inputs.getShiftKey(),
        gridSize,
        averagePagePoint
      }
    })
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
