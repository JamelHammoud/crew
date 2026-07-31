import type { MatLike } from '../../math/Mat'
import type { VecModel } from '../../math/Vec'
import type { CanvasDrawShapeSegment } from '../../schema/shapeProps'

export type FreehandShapeType = 'draw' | 'highlight'
export type FreehandSize = 's' | 'm' | 'l' | 'xl'

export interface FreehandShape {
  id: string
  type: FreehandShapeType
  x: number
  y: number
  props: {
    size: FreehandSize
    scale: number
    segments: CanvasDrawShapeSegment[]
    isComplete?: boolean
    isClosed?: boolean
    isPen: boolean
    [key: string]: unknown
  }
}

export interface FreehandPointerEvent {
  point: VecModel
  accelKey?: boolean
  shiftKey?: boolean
  [key: string]: unknown
}

export interface FreehandKeyboardEvent {
  key: string
}

export interface FreehandEditor {
  inputs: {
    getCurrentPagePoint(): VecModel
    getOriginPagePoint(): VecModel
    getIsPen(): boolean
    getShiftKey(): boolean
    getCtrlKey(): boolean
    getIsDragging(): boolean
  }
  options: { dragDistanceSquared: number }
  snaps: {
    clearIndicators(): void
    setIndicators(indicators: Array<{ id: string; type: 'points'; points: VecModel[] }>): void
  }
  user: {
    getIsDynamicResizeMode(): boolean
    getIsSnapMode(): boolean
  }
  setCursor(cursor: { type: 'cross'; rotation: number }): void
  setCurrentTool(id: string, info?: Record<string, unknown>): void
  getZoomLevel(): number
  getResizeScaleFactor(): number
  getCurrentTheme(): { strokeWidth: number }
  getShapeUtil(type: FreehandShapeType): { options: { maxPointsPerShape: number } }
  getShape(id: string): FreehandShape | undefined
  getPointInShapeSpace(shape: FreehandShape, point: VecModel): VecModel
  getShapePageTransform(shape: FreehandShape | string): MatLike | undefined
  getShapeStrokeWidth?(shape: FreehandShape): number
  markHistoryStoppingPoint(label: string): string
  bailToMark(id: string): void
  createShape(shape: {
    id: string
    type: FreehandShapeType
    x: number
    y: number
    props: Record<string, unknown>
  }): void
  updateShapes(
    shapes: Array<{
      id: string
      type: FreehandShapeType
      props: Record<string, unknown>
    }>
  ): void
  canCreateShapes(ids: string[]): boolean
}
