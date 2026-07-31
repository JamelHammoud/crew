import type { VecLike } from '../../math/Vec'
import type { IndexKey } from '../../schema/indices'
import type { TLBaseShape, TLCursor, TLShape, TLShapeId } from '../../schema/records'
import type { TLArrowShapeProps } from '../../schema/shapeProps'

export type TLArrowShape = TLBaseShape<'arrow', TLArrowShapeProps>

export type ArrowHandle = VecLike & {
  id: string
  index: IndexKey
  type: string
}

export interface ArrowPointerInfo {
  [key: string]: unknown
}

export interface ArrowKeyboardInfo extends ArrowPointerInfo {
  key?: string
}

export interface ArrowTargetState {
  target: { id: TLShapeId }
}

export interface ArrowTargetArgs {
  editor: ArrowToolEditor
  pointInPageSpace: VecLike
  arrow: TLArrowShape | undefined
  isPrecise: boolean
  currentBinding: undefined
  oppositeBinding: undefined
}

export interface ArrowHandleDragInfo {
  handle: ArrowHandle
  isPrecise: boolean
  isCreatingShape: boolean
  initial: TLArrowShape | undefined
}

export interface ArrowShapeUtilLike {
  options: {
    hoverPreciseTimeout: number
    pointingPreciseTimeout: number
  }
  onHandleDrag?(shape: TLArrowShape, info: ArrowHandleDragInfo): ArrowShapeUpdate | undefined
}

export type ArrowTimerId = ReturnType<typeof setTimeout>

export interface ArrowToolEditor {
  inputs: {
    getCurrentPagePoint(): VecLike
    getOriginPagePoint(): VecLike
    getIsDragging(): boolean
  }
  timers: {
    setTimeout(callback: () => void, delay: number): ArrowTimerId
    clearTimeout?(id: ArrowTimerId): void
  }
  getShape(id: TLShapeId): TLArrowShape | undefined
  getShapeHandles(shape: TLArrowShape): ArrowHandle[] | undefined
  getShapeUtil(type: 'arrow'): ArrowShapeUtilLike
  getPointInShapeSpace(shape: TLArrowShape, point: VecLike): VecLike
  getResizeScaleFactor(): number
  getInstanceState(): { isGridMode: boolean; isCoarsePointer: boolean }
  getDocumentSettings(): { gridSize: number }
  getOnlySelectedShape(): TLShape | undefined
  canEditShape(shape: TLShape | undefined): boolean
  startEditingShapeWithRichText?(shape: TLShape, options: { selectAll: boolean }): void
  updateArrowTargetState(args: ArrowTargetArgs): ArrowTargetState | null
  clearArrowTargetState(): void
  bindArrowTerminal?(arrow: TLArrowShape, terminal: 'start' | 'end', pagePoint: VecLike, isPrecise: boolean): void
  markHistoryStoppingPoint(name: string): string
  createShape(shape: ArrowShapeCreate): void
  updateShapes(shapes: ArrowShapeUpdate[]): void
  select(id: TLShapeId): void
  bailToMark(markId: string): void
  setCurrentTool(id: string, info?: ArrowPointerInfo): void
  setCursor(cursor: TLCursor): void
}

export interface ArrowShapeCreate {
  id: TLShapeId
  type: 'arrow'
  x: number
  y: number
  props: Partial<TLArrowShapeProps>
}

export interface ArrowShapeUpdate {
  id: TLShapeId
  type: 'arrow'
  x?: number
  y?: number
  props?: Partial<TLArrowShapeProps>
}
