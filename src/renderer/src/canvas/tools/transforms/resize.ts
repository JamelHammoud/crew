import { Box, type SelectionHandle } from '../../math/Box'
import { Mat, type MatLike } from '../../math/Mat'
import { HALF_PI, approximately } from '../../math/utils'
import { Vec, type VecLike } from '../../math/Vec'
import type { TLShape } from '../../schema'
import { resizeBox, type ResizeInfo, type ResizeMode } from './resizeBox'
import { TransformState, type ShapeUpdate, type TransformEditor, type TransformSnapNode } from './types'

export interface ResizeSnapshot<Shape extends TLShape = TLShape> {
  shape: Shape
  bounds: Box
  pageTransform: MatLike
  parentTransform: MatLike | null
  isAspectRatioLocked?: boolean
}

export interface ResizeCalculation {
  scale: Vec
  scaleOrigin: Vec
}

export interface CalculateResizeOptions {
  selectionBounds: Box
  selectionRotation: number
  handle: SelectionHandle
  originPagePoint: VecLike
  currentPagePoint: VecLike
  fromCenter?: boolean
  isAspectRatioLocked?: boolean
}

const OPPOSITE_HANDLE: Record<SelectionHandle, SelectionHandle> = {
  top: 'bottom',
  top_right: 'bottom_left',
  right: 'left',
  bottom_right: 'top_left',
  bottom: 'top',
  bottom_left: 'top_right',
  left: 'right',
  top_left: 'bottom_right'
}

const ORDERED_SELECTION_HANDLES: SelectionHandle[] = [
  'top',
  'top_right',
  'right',
  'bottom_right',
  'bottom',
  'bottom_left',
  'left',
  'top_left'
]

export function rotateSelectionHandle(handle: SelectionHandle, rotation: number): SelectionHandle {
  const steps = Math.round((rotation % (Math.PI * 2)) / (Math.PI / 4))
  const index = ORDERED_SELECTION_HANDLES.indexOf(handle)
  if (index === -1) return handle
  const next = (index + steps) % ORDERED_SELECTION_HANDLES.length
  return ORDERED_SELECTION_HANDLES[(next + ORDERED_SELECTION_HANDLES.length) % ORDERED_SELECTION_HANDLES.length]
}

export function areAnglesCompatible(a: number, b: number): boolean {
  return a === b || approximately((a % HALF_PI) - (b % HALF_PI), 0)
}

export function calculateResize(options: CalculateResizeOptions): ResizeCalculation {
  const {
    selectionBounds,
    selectionRotation,
    handle,
    originPagePoint,
    currentPagePoint,
    fromCenter = false,
    isAspectRatioLocked = false
  } = options

  const scaleOrigin = Vec.RotWith(
    fromCenter ? selectionBounds.center : selectionBounds.getHandlePoint(OPPOSITE_HANDLE[handle]),
    selectionBounds.point,
    selectionRotation
  )
  const currentDistance = Vec.Sub(currentPagePoint, scaleOrigin).rot(-selectionRotation)
  const initialDistance = Vec.Sub(originPagePoint, scaleOrigin).rot(-selectionRotation)
  const scale = Vec.DivV(currentDistance, initialDistance)

  if (!Number.isFinite(scale.x)) scale.x = 1
  if (!Number.isFinite(scale.y)) scale.y = 1

  const lockX = handle === 'top' || handle === 'bottom'
  const lockY = handle === 'left' || handle === 'right'

  if (isAspectRatioLocked) {
    if (lockY) {
      scale.y = Math.abs(scale.x)
    } else if (lockX) {
      scale.x = Math.abs(scale.y)
    } else if (Math.abs(scale.x) > Math.abs(scale.y)) {
      scale.y = Math.abs(scale.x) * (scale.y < 0 ? -1 : 1)
    } else {
      scale.x = Math.abs(scale.y) * (scale.x < 0 ? -1 : 1)
    }
  } else {
    if (lockX) scale.x = 1
    if (lockY) scale.y = 1
  }

  return { scale, scaleOrigin }
}

export function scalePagePoint(point: VecLike, scaleOrigin: VecLike, scale: VecLike, scaleAxisRotation: number): Vec {
  const relative = Vec.RotWith(point, scaleOrigin, -scaleAxisRotation).sub(scaleOrigin)
  return Vec.MulV(relative, scale).add(scaleOrigin).rotWith(scaleOrigin, scaleAxisRotation)
}

export interface ResizeShapeOptions<Shape extends TLShape> {
  scaleOrigin: VecLike
  scaleAxisRotation: number
  handle?: SelectionHandle
  mode?: ResizeMode
  isAspectRatioLocked?: boolean
  onResize?(shape: Shape, info: ResizeInfo<Shape>): Shape | undefined
}

function supportsBoxResize(shape: TLShape): shape is TLShape & { props: TLShape['props'] & { w: number; h: number } } {
  return 'w' in shape.props && 'h' in shape.props
}

export function resizeShape<Shape extends TLShape>(
  snapshot: ResizeSnapshot<Shape>,
  scale: VecLike,
  options: ResizeShapeOptions<Shape>
): ShapeUpdate<Shape> {
  const { shape, bounds, pageTransform, parentTransform } = snapshot
  const isAspectRatioLocked = snapshot.isAspectRatioLocked || (options.isAspectRatioLocked ?? false)
  const pageRotation = Mat.Rotation(pageTransform)
  const requestedScale = Vec.From(scale)
  const adjustedScale = Vec.From(scale)

  if (isAspectRatioLocked) {
    if (Math.abs(adjustedScale.x) > Math.abs(adjustedScale.y)) {
      adjustedScale.y = Math.sign(adjustedScale.y) * Math.abs(adjustedScale.x)
    } else {
      adjustedScale.x = Math.sign(adjustedScale.x) * Math.abs(adjustedScale.y)
    }
  }

  const aligned = approximately(Math.abs((pageRotation - options.scaleAxisRotation) % HALF_PI), 0)
  if (!aligned) {
    const uniform = Math.min(Math.abs(adjustedScale.x), Math.abs(adjustedScale.y))
    adjustedScale.x = Math.sign(adjustedScale.x) * uniform
    adjustedScale.y = Math.sign(adjustedScale.y) * uniform
  }

  const pagePoint = Mat.applyToPoint(pageTransform, new Vec())
  const newPagePoint = scalePagePoint(pagePoint, options.scaleOrigin, adjustedScale, options.scaleAxisRotation)
  const newLocalPoint = parentTransform ? Mat.applyToPoint(parentTransform, newPagePoint) : newPagePoint

  const axesAligned = approximately((pageRotation - options.scaleAxisRotation) % Math.PI, 0)
  const shapeScale = axesAligned ? adjustedScale : new Vec(adjustedScale.y, adjustedScale.x)

  const info: ResizeInfo<Shape> = {
    newPoint: newLocalPoint,
    handle: options.handle ?? 'bottom_right',
    mode: options.mode ?? 'scale_shape',
    scaleX: shapeScale.x,
    scaleY: shapeScale.y,
    initialBounds: bounds,
    initialShape: shape
  }

  const resized =
    options.onResize?.(shape, info) ??
    (supportsBoxResize(shape) ? resizeBox(shape, info as ResizeInfo<typeof shape>) : undefined)

  if (resized && aligned) return resized as ShapeUpdate<Shape>

  if (resized && !aligned) {
    const initialPageCenter = Mat.applyToPoint(pageTransform, bounds.center)
    const nextPageCenter = scalePagePoint(
      initialPageCenter,
      options.scaleOrigin,
      requestedScale,
      options.scaleAxisRotation
    )
    const nextLocalCenter = parentTransform ? Mat.applyToPoint(parentTransform, nextPageCenter) : nextPageCenter
    const parentRotation = pageRotation - shape.rotation
    const isMirrored = Math.sign(requestedScale.x) * Math.sign(requestedScale.y) < 0
    const rotation = isMirrored ? -shape.rotation - 2 * parentRotation : shape.rotation
    const resizedBoundsCenter = Vec.MulV(bounds.center, Vec.Abs(adjustedScale))
    const localOrigin = Vec.Sub(nextLocalCenter, Vec.Rot(resizedBoundsCenter, rotation))

    return {
      ...resized,
      x: localOrigin.x,
      y: localOrigin.y,
      rotation
    } as ShapeUpdate<Shape>
  }

  const initialPageCenter = Mat.applyToPoint(pageTransform, bounds.center)
  const nextPageCenter = scalePagePoint(
    initialPageCenter,
    options.scaleOrigin,
    adjustedScale,
    options.scaleAxisRotation
  )
  const initialLocalCenter = parentTransform ? Mat.applyToPoint(parentTransform, initialPageCenter) : initialPageCenter
  const nextLocalCenter = parentTransform ? Mat.applyToPoint(parentTransform, nextPageCenter) : nextPageCenter
  const delta = Vec.Sub(nextLocalCenter, initialLocalCenter)

  return {
    id: shape.id,
    type: shape.type,
    x: shape.x + delta.x,
    y: shape.y + delta.y
  } as ShapeUpdate<Shape>
}

export function resizeShapes<Shape extends TLShape>(
  snapshots: ResizeSnapshot<Shape>[],
  scale: VecLike,
  options: ResizeShapeOptions<Shape>
): ShapeUpdate<Shape>[] {
  return snapshots.map(snapshot => resizeShape(snapshot, scale, options))
}

export interface ResizingInfo<Shape extends TLShape = TLShape> {
  target?: 'selection'
  handle: SelectionHandle
  snapshots?: ResizeSnapshot<Shape>[]
  selectionBounds?: Box
  selectionRotation?: number
  snappableShapes?: readonly TransformSnapNode[]
  zoom?: number
  isCreating?: boolean
  creatingMarkId?: string
  creationCursorOffset?: VecLike
  onCreate?(shape: Shape | null): void
  onInteractionEnd?: string | (() => void)
}

export class Resizing<Shape extends TLShape = TLShape> extends TransformState<
  TransformEditor<Shape>,
  ResizingInfo<Shape>
> {
  static override id = 'resizing'
  static override trackPerformance = true

  info!: ResizingInfo<Shape>
  snapshots: ResizeSnapshot<Shape>[] = []
  selectionBounds = new Box()
  selectionRotation = 0
  markId = ''
  private cursorHandleOffset = new Vec()
  private creationCursorOffset: VecLike = { x: 0, y: 0 }
  private canShapesDeform = true

  override onEnter(info: ResizingInfo<Shape>): void {
    this.info = info
    this.parent.setCurrentToolIdMask?.(typeof info.onInteractionEnd === 'string' ? info.onInteractionEnd : undefined)
    this.creationCursorOffset = info.creationCursorOffset ?? { x: 0, y: 0 }
    this.snapshots = info.snapshots ?? this.createSnapshots()
    if (this.snapshots.length === 0) {
      this.parent.transition('idle')
      return
    }
    this.selectionBounds = info.selectionBounds ?? this.editor.getSelectionRotatedPageBounds?.() ?? new Box()
    this.selectionRotation = info.selectionRotation ?? this.editor.getSelectionRotation?.() ?? 0
    this.canShapesDeform = !this.snapshots.some(
      snapshot =>
        snapshot.isAspectRatioLocked ||
        !areAnglesCompatible(Mat.Rotation(snapshot.pageTransform), this.selectionRotation)
    )
    const handlePoint = Vec.RotWith(
      this.selectionBounds.getHandlePoint(info.handle),
      this.selectionBounds.point,
      this.selectionRotation
    )
    this.cursorHandleOffset = Vec.Sub(this.editor.inputs.getOriginPagePoint(), handlePoint)
    this.markId = info.creatingMarkId ?? this.editor.markHistoryStoppingPoint?.('starting resizing') ?? ''
    if (info.isCreating) this.editor.setCursor?.({ type: 'cross', rotation: 0 })
    this.applyLifecycle('start')
    this.update()
  }

  override onExit(): void {
    this.parent.setCurrentToolIdMask?.(undefined)
    this.editor.snaps?.clearIndicators?.()
    this.editor.setCursor?.({ type: 'default', rotation: 0 })
    if (this.info?.isCreating) this.editor.setHintingShapes?.([])
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
      if (current) this.editor.getShapeUtil?.(shape).onResizeCancel?.(shape, current)
    }
    this.editor.snaps?.clearIndicators?.()
    if (this.markId) this.editor.bailToMark?.(this.markId)
    this.finish(true)
  }

  private createSnapshots(): ResizeSnapshot<Shape>[] {
    const leaves = (id: Shape['id']): Shape['id'][] => {
      const shape = this.editor.getShape(id)
      if (!shape || shape.type !== 'group') return shape ? [id] : []
      return (this.editor.getSortedChildIdsForParent?.(id) ?? []).flatMap(leaves)
    }
    return (this.editor.getSelectedShapeIds?.() ?? []).flatMap(leaves).flatMap(id => {
      const shape = this.editor.getShape(id)
      const pageTransform = shape && this.editor.getShapePageTransform?.(shape)
      const geometry = shape && this.editor.getShapeGeometry?.(shape)
      if (!shape || !pageTransform || !geometry) return []
      const parentPageTransform = shape.parentId.startsWith('shape:')
        ? this.editor.getShapeParentTransform?.(shape)
        : undefined
      return [
        {
          shape,
          bounds: geometry.bounds,
          pageTransform,
          parentTransform: parentPageTransform ? Mat.Inverse(parentPageTransform) : null,
          isAspectRatioLocked: this.editor.getShapeUtil?.(shape).isAspectRatioLocked?.(shape) ?? false
        }
      ]
    })
  }

  private update(): void {
    const altKey = this.editor.inputs.getAltKey?.() ?? false
    const shiftKey = this.editor.inputs.getShiftKey()
    let locked = shiftKey || !this.canShapesDeform

    if (this.snapshots.length === 1 && this.editor.isShapeOfType?.(this.snapshots[0].shape, 'text')) {
      locked = !(this.info.handle === 'left' || this.info.handle === 'right')
    }

    const accelKey = this.editor.inputs.getAccelKey?.() ?? false
    const currentPagePoint = this.editor.inputs
      .getCurrentPagePoint()
      .clone()
      .sub(this.cursorHandleOffset)
      .sub(this.creationCursorOffset)
    const originPagePoint = this.editor.inputs.getOriginPagePoint().clone().sub(this.cursorHandleOffset)

    const gridSize = this.editor.getInstanceState?.().isGridMode
      ? this.editor.getDocumentSettings?.().gridSize
      : undefined
    if (gridSize && !accelKey) currentPagePoint.snapToGrid(gridSize)

    const snapMode = this.editor.getIsSnapMode?.() ?? true
    const snap =
      (snapMode ? !accelKey : accelKey) && this.selectionRotation % HALF_PI === 0
        ? this.editor.snaps?.snapResizeBounds?.({
            initialSelectionPageBounds: this.info.selectionBounds ?? this.selectionBounds,
            dragDelta: Vec.Sub(currentPagePoint, originPagePoint),
            handle: rotateSelectionHandle(this.info.handle, this.selectionRotation),
            isAspectRatioLocked: locked,
            isResizingFromCenter: altKey,
            snappableShapes: this.info.snappableShapes ?? this.editor.getSnappableShapes?.() ?? [],
            zoom: this.info.zoom ?? this.editor.getZoomLevel?.() ?? 1
          })
        : undefined
    if (snap) currentPagePoint.add(snap.nudge)
    this.editor.snaps?.setIndicators?.(snap?.indicators ?? [])

    const calculation = calculateResize({
      selectionBounds: this.selectionBounds,
      selectionRotation: this.selectionRotation,
      handle: this.info.handle,
      originPagePoint,
      currentPagePoint,
      fromCenter: altKey,
      isAspectRatioLocked: locked
    })

    if (!this.info.isCreating) this.updateCursor(calculation.scale.x < 0, calculation.scale.y < 0)

    this.editor.updateShapes(
      resizeShapes(this.snapshots, calculation.scale, {
        scaleOrigin: calculation.scaleOrigin,
        scaleAxisRotation: this.selectionRotation,
        handle: this.info.handle,
        mode: this.snapshots.length === 1 ? 'resize_bounds' : 'scale_shape',
        isAspectRatioLocked: locked,
        onResize: (shape, resizeInfo) =>
          this.editor.getShapeUtil?.(shape).onResize?.(shape, resizeInfo) ??
          (supportsBoxResize(shape) ? resizeBox(shape, resizeInfo as ResizeInfo<typeof shape>) : undefined)
      })
    )
  }

  private updateCursor(isFlippedX: boolean, isFlippedY: boolean): void {
    const previous = this.editor.getInstanceState?.().cursor
    let type = previous?.type
    if (this.info.handle === 'top_left' || this.info.handle === 'bottom_right') {
      type = isFlippedX === isFlippedY ? 'nwse-resize' : 'nesw-resize'
    } else if (this.info.handle === 'top_right' || this.info.handle === 'bottom_left') {
      type = isFlippedX === isFlippedY ? 'nesw-resize' : 'nwse-resize'
    }
    if (!type) return
    if (type === previous?.type && this.selectionRotation === previous?.rotation) return
    this.editor.setCursor?.({ type, rotation: this.selectionRotation })
  }

  private complete(): void {
    this.editor.kickoutOccludedShapes?.(this.snapshots.map(snapshot => snapshot.shape.id))
    this.applyLifecycle('end')
    if (this.info.isCreating && this.info.onCreate) {
      const shape = this.snapshots[0] ? (this.editor.getShape(this.snapshots[0].shape.id) ?? null) : null
      this.info.onCreate(shape)
      return
    }
    this.finish()
  }

  private applyLifecycle(stage: 'start' | 'end'): void {
    const updates: ShapeUpdate<Shape>[] = []
    for (const { shape } of this.snapshots) {
      const util = this.editor.getShapeUtil?.(shape)
      const current = this.editor.getShape(shape.id)
      const update =
        stage === 'start' ? util?.onResizeStart?.(shape) : current ? util?.onResizeEnd?.(shape, current) : undefined
      if (update) updates.push(update)
    }
    if (updates.length) this.editor.updateShapes(updates)
  }

  private finish(cancelled = false): void {
    const end = this.info.onInteractionEnd
    if (typeof end === 'function') {
      end()
      return
    }
    if (typeof end === 'string' && (cancelled || this.editor.getInstanceState?.().isToolLocked)) {
      this.editor.setCurrentTool?.(end, {})
      return
    }
    this.parent.transition('idle')
  }
}
