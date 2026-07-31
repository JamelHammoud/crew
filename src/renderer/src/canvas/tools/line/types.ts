import type { MatLike } from '../../math/Mat'
import type { VecLike } from '../../math/Vec'
import type { TLBaseShape, TLCursor, TLShapeId } from '../../schema/records'
import type { IndexKey } from '../../schema/indices'
import type { TLLineShapeProps } from '../../schema/shapeProps'

export type TLLineShape = TLBaseShape<'line', TLLineShapeProps>

export type LineHandle = VecLike & {
  id: string
  index: IndexKey
  type: string
}

export interface LinePointerInfo {
  [key: string]: unknown
}

export interface LineToolEditor {
  inputs: {
    getCurrentPagePoint(): VecLike
    getIsDragging(): boolean
    getShiftKey(): boolean
  }
  snaps: {
    clearIndicators(): void
  }
  getShape(id: TLShapeId): TLLineShape | undefined
  getShapeHandles(shape: TLLineShape): LineHandle[] | undefined
  getShapeParentTransform(shape: TLLineShape): MatLike | null | undefined
  getZoomLevel(): number
  getResizeScaleFactor(): number
  getInstanceState(): { isGridMode: boolean; isCoarsePointer: boolean }
  getDocumentSettings(): { gridSize: number }
  markHistoryStoppingPoint(name: string): string
  createShapes(shapes: LineShapeCreate[]): void
  updateShapes(shapes: LineShapeUpdate[]): void
  select(id: TLShapeId): void
  bailToMark(markId: string): void
  setCurrentTool(id: string, info?: LinePointerInfo): void
  setCursor(cursor: TLCursor): void
}

export interface LineShapeCreate {
  id: TLShapeId
  type: 'line'
  x: number
  y: number
  props: Partial<TLLineShapeProps>
}

export interface LineShapeUpdate {
  id: TLShapeId
  type: 'line'
  props: Partial<TLLineShapeProps>
}
