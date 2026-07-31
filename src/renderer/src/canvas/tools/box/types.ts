import type { Box, VecLike } from '../../math'
import type { TLShape, TLShapeId, TLShapeType } from '../../schema'

export interface BoxPointerInfo {
  [key: string]: unknown
}

export interface BoxTransform {
  rotation(): number
  point?(): VecLike
}

export interface BoxToolEditor {
  inputs: {
    getOriginPagePoint(): VecLike
    getCurrentPagePoint?(): VecLike
    getIsDragging(): boolean
    getIsPointing?(): boolean
  }
  options?: {
    adjacentShapeMargin?: number
    coarseDragDistanceSquared?: number
    dragDistanceSquared?: number
  }
  createShapes(shapes: BoxShapeCreate[]): void
  updateShape(shape: BoxShapeUpdate): void
  updateShapes?(shapes: BoxShapeUpdate[]): void
  getShape(id: TLShapeId): TLShape | undefined
  getShapePageBounds(shape: TLShape): Box | undefined
  getShapeParentTransform(shape: TLShape): BoxTransform | null | undefined
  getShapePageTransform?(id: TLShapeId): BoxTransform | null | undefined
  getShapeGeometry?(shape: TLShape): { bounds: Box }
  getShapeAncestors?(shape: TLShape): TLShape[]
  getSortedChildIdsForParent?(parentId: TLShape['parentId']): TLShapeId[]
  getCurrentPageShapes?(): TLShape[]
  getSelectedShapeIds?(): TLShapeId[]
  isPointInShape?(shape: TLShape, point: VecLike): boolean
  canEditShape?(shape: TLShape | undefined): boolean
  getOnlySelectedShape?(): TLShape | undefined
  markHistoryStoppingPoint(name: string): string
  bailToMark?(markId: string): void
  select(id: TLShapeId): void
  setSelectedShapes(ids: TLShapeId[]): void
  setEditingShape?(shape: TLShape): void
  setHintingShapes?(ids: TLShapeId[]): void
  updateHoveredShapeId?(): void
  cancelUpdateHoveredShapeId?(): void
  reparentShapes?(ids: TLShapeId[], parentId: TLShapeId): void
  setCurrentTool(id: string, info?: BoxPointerInfo): void
  setCursor(cursor: { type: string; rotation: number }): void
  getResizeScaleFactor(): number
  getZoomLevel?(): number
  getInstanceState(): {
    isGridMode: boolean
    isToolLocked: boolean
    isCoarsePointer: boolean
  }
  getDocumentSettings(): { gridSize: number }
}

export interface BoxShapeCreate {
  id: TLShapeId
  type: TLShapeType
  x: number
  y: number
  props?: Record<string, unknown>
}

export interface BoxShapeUpdate {
  id: TLShapeId
  type: TLShapeType
  x?: number
  y?: number
  props?: Record<string, unknown>
}
