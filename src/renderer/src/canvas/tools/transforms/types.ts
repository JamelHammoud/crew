import type { MatLike } from '../../math/Mat'
import type { BoxLike, SelectionHandle } from '../../math/Box'
import type { Vec, VecLike } from '../../math/Vec'
import type { TLCursor, TLShape } from '../../schema'
import type { ResizeInfo } from './resizeBox'

export type ShapeUpdate<Shape extends TLShape = TLShape> = Partial<Shape> & Pick<Shape, 'id' | 'type'>

export interface TransformParent {
  transition(id: string, info?: unknown): unknown
  setCurrentToolIdMask?(id: string | undefined): void
  getCurrent?(): { handleEvent?(info: unknown): void } | undefined
}

export interface TransformInputs {
  getCurrentPagePoint(): Vec
  getOriginPagePoint(): Vec
  getShiftKey(): boolean
  getAltKey?(): boolean
  getCtrlKey?(): boolean
  getAccelKey?(): boolean
  getIsDragging?(): boolean
  getIsPanning?(): boolean
  getPointerVelocity?(): Vec
}

export interface TransformSnapPoint {
  id: string
  x: number
  y: number
  z?: number
}

export interface TransformSnapNode {
  id: string
  pageBounds: BoxLike
  points?: readonly VecLike[]
}

export interface TransformSnapResult {
  nudge: VecLike
  indicators: unknown[]
}

export interface TransformSnaps {
  snapTranslateBounds?(options: {
    initialSelectionPageBounds: BoxLike
    initialSelectionSnapPoints?: readonly TransformSnapPoint[]
    dragDelta: VecLike
    snappableShapes: readonly TransformSnapNode[]
    lockedAxis?: 'x' | 'y' | null
    zoom?: number
  }): TransformSnapResult
  snapResizeBounds?(options: {
    initialSelectionPageBounds: BoxLike
    dragDelta: VecLike
    handle: SelectionHandle
    isAspectRatioLocked?: boolean
    isResizingFromCenter?: boolean
    snappableShapes: readonly TransformSnapNode[]
    zoom?: number
  }): TransformSnapResult
  setIndicators?(indicators: unknown[]): void
  clearIndicators?(): void
}

export interface TransformEditor<Shape extends TLShape = TLShape> {
  inputs: TransformInputs
  getShape(id: Shape['id']): Shape | undefined
  updateShapes(shapes: ShapeUpdate<Shape>[]): unknown
  getSelectedShapeIds?(): Shape['id'][]
  getSortedChildIdsForParent?(id: Shape['id']): Shape['id'][]
  getShapePageTransform?(shape: Shape | Shape['id']): MatLike | undefined
  getShapeParentTransform?(shape: Shape | Shape['id']): MatLike | undefined
  getShapeGeometry?(shape: Shape | Shape['id']): { bounds: import('../../math/Box').Box }
  getSelectionRotation?(): number
  getSelectionRotatedPageBounds?(): import('../../math/Box').Box | undefined
  getSelectionPageBounds?(): import('../../math/Box').Box | undefined
  getShapePageBounds?(shape: Shape | Shape['id']): import('../../math/Box').Box | undefined
  getShapeHandles?(shape: Shape | Shape['id']): TransformHandle[] | undefined
  getIsReadonly?(): boolean
  getInstanceState?(): {
    isGridMode?: boolean
    isCoarsePointer?: boolean
    isToolLocked?: boolean
    cursor?: TLCursor
  }
  updateInstanceState?(change: { duplicateProps?: TransformDuplicateProps | null }): unknown
  getDocumentSettings?(): { gridSize: number }
  edgeScrollManager?: { updateEdgeScrolling(elapsed: number): void }
  getIsSnapMode?(): boolean
  getSnappableShapes?(): readonly TransformSnapNode[]
  getZoomLevel?(): number
  snaps?: TransformSnaps
  setCursor?(cursor: TLCursor): unknown
  setHintingShapes?(ids: readonly Shape['id'][]): unknown
  setHoveredShape?(id: Shape['id'] | null): unknown
  select?(...ids: Shape['id'][]): unknown
  canCreateShapes?(ids: readonly Shape['id'][]): boolean
  duplicateShapes?(ids: readonly Shape['id'][]): unknown
  kickoutOccludedShapes?(ids: readonly Shape['id'][]): unknown
  isShapeOfType?(shape: Shape, type: string): boolean
  isShapeFrameLike?(shape: Shape | Shape['id']): boolean
  markHistoryStoppingPoint?(name: string): string
  bailToMark?(id: string): unknown
  setCurrentTool?(id: string, info?: unknown): unknown
  getShapeUtil?(shape: Shape): TransformShapeUtil<Shape>
}

export interface TransformShapeUtil<Shape extends TLShape = TLShape> {
  isAspectRatioLocked?(shape: Shape): boolean
  canResize?(shape: Shape): boolean
  canResizeChildren?(shape: Shape): boolean
  onTranslateStart?(shape: Shape): ShapeUpdate<Shape> | undefined
  onTranslate?(initial: Shape, current: Shape): ShapeUpdate<Shape> | undefined
  onTranslateEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | undefined
  onTranslateCancel?(initial: Shape, current: Shape): void
  onResizeStart?(shape: Shape): ShapeUpdate<Shape> | undefined
  onResize?(shape: Shape, info: ResizeInfo<Shape>): Shape | undefined
  onResizeEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | undefined
  onResizeCancel?(initial: Shape, current: Shape): void
  onRotateStart?(shape: Shape): ShapeUpdate<Shape> | undefined
  onRotate?(initial: Shape, current: Shape): ShapeUpdate<Shape> | undefined
  onRotateEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | undefined
  onRotateCancel?(initial: Shape, current: Shape): void
  onHandleDragStart?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | undefined
  onHandleDrag?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | undefined
  onHandleDragEnd?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | undefined
  onHandleDragCancel?(shape: Shape, info: HandleDragInfo<Shape>): void
}

export interface TransformHandle {
  x: number
  y: number
  z?: number
  id: string
  type: string
  index?: string
  canSnap?: boolean
  snapType?: string
  snapReferenceHandleId?: string
  [key: string]: unknown
}

export interface HandleDragInfo<Shape extends TLShape = TLShape> {
  handle: TransformHandle
  isPrecise: boolean
  isCreatingShape: boolean
  initial: Shape
}

export abstract class TransformState<Editor extends TransformEditor = TransformEditor, Info = unknown> {
  static id = ''
  static isLockable = true
  static useCoalescedEvents = false
  static trackPerformance = false

  private active = false

  constructor(
    public editor: Editor,
    public parent: TransformParent = { transition: () => undefined }
  ) {}

  get id(): string {
    return (this.constructor as typeof TransformState).id
  }

  getIsActive(): boolean {
    return this.active
  }

  enter(info: Info, from = 'initial'): this {
    this.active = true
    this.onEnter(info, from)
    return this
  }

  exit(info?: unknown, to = 'idle'): this {
    this.active = false
    this.onExit(info, to)
    return this
  }

  onEnter(_info: Info, _from?: string): void {}
  onExit(_info?: unknown, _to?: string): void {}
}
