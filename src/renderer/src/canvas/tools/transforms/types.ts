import type { MatLike } from '../../math/Mat'
import type { Vec, VecLike } from '../../math/Vec'
import type { TLCursor, TLShape } from '../../schema'

export type ShapeUpdate<Shape extends TLShape = TLShape> = Partial<Shape> &
  Pick<Shape, 'id' | 'type'>

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
  getPointerVelocity?(): Vec
}

export interface TransformEditor<Shape extends TLShape = TLShape> {
  inputs: TransformInputs
  getShape(id: Shape['id']): Shape | undefined
  updateShapes(shapes: ShapeUpdate<Shape>[]): unknown
  getSelectedShapeIds?(): Shape['id'][]
  getShapePageTransform?(shape: Shape | Shape['id']): MatLike | undefined
  getShapeParentTransform?(shape: Shape | Shape['id']): MatLike | undefined
  getSelectionRotation?(): number
  getSelectionRotatedPageBounds?(): import('../../math/Box').Box | undefined
  getIsReadonly?(): boolean
  getInstanceState?(): { isGridMode?: boolean; isCoarsePointer?: boolean; isToolLocked?: boolean }
  getDocumentSettings?(): { gridSize: number }
  setCursor?(cursor: TLCursor): unknown
  markHistoryStoppingPoint?(name: string): string
  bailToMark?(id: string): unknown
  setCurrentTool?(id: string, info?: unknown): unknown
  getShapeUtil?(shape: Shape): TransformShapeUtil<Shape>
}

export interface TransformShapeUtil<Shape extends TLShape = TLShape> {
  onTranslateStart?(shape: Shape): ShapeUpdate<Shape> | void
  onTranslate?(initial: Shape, current: Shape): ShapeUpdate<Shape> | void
  onTranslateEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | void
  onTranslateCancel?(initial: Shape, current: Shape): void
  onResizeStart?(shape: Shape): ShapeUpdate<Shape> | void
  onResizeEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | void
  onResizeCancel?(initial: Shape, current: Shape): void
  onRotateStart?(shape: Shape): ShapeUpdate<Shape> | void
  onRotate?(initial: Shape, current: Shape): ShapeUpdate<Shape> | void
  onRotateEnd?(initial: Shape, current: Shape): ShapeUpdate<Shape> | void
  onRotateCancel?(initial: Shape, current: Shape): void
  onHandleDragStart?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | void
  onHandleDrag?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | void
  onHandleDragEnd?(shape: Shape, info: HandleDragInfo<Shape>): ShapeUpdate<Shape> | void
  onHandleDragCancel?(shape: Shape, info: HandleDragInfo<Shape>): void
}

export interface TransformHandle extends VecLike {
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

export abstract class TransformState<
  Editor extends TransformEditor = TransformEditor,
  Info = unknown
> {
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
