import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react'
import type { Geometry2d } from '../geometry'
import type { MatLike } from '../math'

export interface CanvasCamera {
  x: number
  y: number
  z: number
}

export interface CanvasBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface CanvasShapeRecord {
  id: string
  type: string
  props: unknown
  meta?: unknown
}

export interface CanvasRenderingShape<Shape extends CanvasShapeRecord = CanvasShapeRecord> {
  id: Shape['id']
  shape: Shape
  index: number
  backgroundIndex: number
  opacity: number
}

export interface CanvasOverlay {
  id: string
  type: string
  props: unknown
}

export interface CanvasOverlayUtil<Overlay extends CanvasOverlay = CanvasOverlay> {
  isActive(): boolean
  render(context: CanvasRenderingContext2D, overlays: Overlay[]): void
}

export interface CanvasOverlayEntry {
  util: CanvasOverlayUtil
  overlays: CanvasOverlay[]
}

export interface CanvasOverlayManager {
  getActiveOverlayEntries(): CanvasOverlayEntry[]
  getOverlayUtil<Util extends CanvasOverlayUtil = CanvasOverlayUtil>(type: string): Util
}

export interface CanvasRenderHost<Shape extends CanvasShapeRecord = CanvasShapeRecord> {
  overlays: CanvasOverlayManager
  getCamera(): CanvasCamera
  getCameraState(): 'idle' | 'moving'
  getInstanceState(): {
    devicePixelRatio: number
    screenBounds: CanvasBounds
    brush?: CanvasBounds | null
  }
  getRenderingShapes(): CanvasRenderingShape<Shape>[]
  getCulledShapes(): ReadonlySet<Shape['id']>
  getShape(id: Shape['id']): Shape | undefined
  getShapePageTransform(id: Shape['id']): MatLike | undefined
  getShapeGeometry(shape: Shape): { bounds: CanvasBounds }
  getShapeClipPath(id: Shape['id']): string | undefined
  getSelectedShapeIds?(): Shape['id'][]
  getEditingShapeId?(): Shape['id'] | null
}

export interface CanvasShapeRenderer<Shape extends CanvasShapeRecord = CanvasShapeRecord> {
  render(shape: Shape): ReactNode
  renderBackground?(shape: Shape): ReactNode
  isFilled?(shape: Shape): boolean
}

export interface CanvasProps<Shape extends CanvasShapeRecord = CanvasShapeRecord>
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  host: CanvasRenderHost<Shape>
  shapeRenderer: CanvasShapeRenderer<Shape>
  background?: ReactNode
  onTheCanvas?: ReactNode
  viewportOverlay?: ReactNode
  inFrontOfCanvas?: ReactNode
  canvasRef?: Ref<HTMLDivElement>
  shapeLayerStyle?: CSSProperties
}
