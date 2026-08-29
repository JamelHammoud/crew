import type { BoxModel, TLAsset, TLBinding, TLPageId, TLParentId, TLRecord, TLShape, TLShapeId } from '../schema'
import type { CrewShapePartial, ShapeUtil, ShapeUtilConstructor } from '../shapes/ShapeUtil'
import type { Store } from '../store'

export interface VecLike {
  x: number
  y: number
  z?: number
}

export interface TLCameraPoint extends VecLike {
  z: number
}

export interface TLCameraMoveOptions {
  animation?: { duration?: number; easing?: (value: number) => number }
  immediate?: boolean
  force?: boolean
}

export type TLColorMode = 'light' | 'dark'

export interface TLThemeColor {
  solid: string
  fill?: string
  linedFill?: string
  frameHeadingStroke?: string
  frameHeadingFill?: string
  frameStroke?: string
  frameFill?: string
  frameText?: string
  noteFill?: string
  noteText?: string
  semi?: string
  pattern?: string
  highlightSrgb?: string
  highlightP3?: string
}

export interface TLThemePalette {
  selectionStroke: string
  [key: string]: TLThemeColor | string
}

export interface TLTheme {
  id?: string
  colors: Record<TLColorMode, TLThemePalette>
  fontSize?: number
  lineHeight?: number
  strokeWidth?: number
  [key: string]: unknown
}

export type TLThemes = Record<string, TLTheme>

export interface TLUserPreferences {
  colorScheme: TLColorMode | 'system'
  isSnapMode: boolean
  isDarkMode?: boolean
  [key: string]: unknown
}

export interface TLStyleProp<T> {
  id: string
  defaultValue?: T
}

export type SharedStyle<T> = { readonly type: 'mixed' } | { readonly type: 'shared'; readonly value: T }

export interface TLContent {
  shapes: TLShape[]
  bindings?: TLBinding[]
  rootShapeIds: TLShapeId[]
  assets: TLAsset[]
  schema?: unknown
}

export interface TLShapeUpdate extends Partial<Omit<TLShape, 'id' | 'type' | 'typeName' | 'props' | 'meta'>> {
  id: TLShapeId
  type: TLShape['type']
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface TLEditorOptions {
  store: Store<TLRecord>
  shapeUtils?: readonly ShapeUtilConstructor[]
  bindingUtils?: readonly unknown[]
  overlayUtils?: readonly unknown[]
  tools?: readonly unknown[]
  initialState?: string
  currentPageId?: TLPageId
  getContainer?: () => HTMLElement
  colorScheme?: TLColorMode | 'system'
  themes?: Partial<TLThemes>
  initialTheme?: string
  textMeasure?: TLTextMeasure
  user?: {
    getUserPreferences?: () => Partial<TLUserPreferences>
    setUserPreferences?: (next: TLUserPreferences) => void
  }
  options?: {
    resolveAssetUrl?: (source: string) => string
    camera?: {
      zoomMin?: number
      zoomMax?: number
      zoomSteps?: number[] | null
      panSpeed?: number
      zoomSpeed?: number
      isLocked?: boolean
    }
    [key: string]: unknown
  }
}

export interface TLResizeShapeOptions {
  initialBounds?: import('../math').Box
  scaleOrigin?: VecLike
  scaleAxisRotation?: number
  initialShape?: TLShape
  dragHandle?: string
  isAspectRatioLocked?: boolean
  mode?: 'resize_bounds' | 'scale_shape'
}

export interface TLPutContentOptions {
  point?: VecLike
  select?: boolean
  preserveIds?: boolean
}

export interface TLTextMeasureOptions {
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  lineHeight?: number
  letterSpacing?: number
  otherStyles?: Record<string, string>
  maxWidth?: number | null
  width?: number | null
  padding?: string
  [key: string]: unknown
}

export interface TLTextMeasure {
  measureHtml(html: string, options?: TLTextMeasureOptions): { w: number; h: number }
  measureText(text: string, options?: TLTextMeasureOptions): { w: number; h: number }
  dispose?(): void
}

export interface ShapeEditorApi {
  getShape(id: TLShapeId): TLShape | undefined
  getShapeUtil(shapeOrType: TLShape | TLShape['type']): ShapeUtil
  getShapePageBounds(shapeOrId: TLShape | TLShapeId): import('../math').Box | undefined
  getShapePageTransform(shapeOrId: TLShape | TLShapeId): import('../math').Mat
  getShapeParentTransform(shapeOrId: TLShape | TLShapeId): import('../math').Mat
  getSortedChildIdsForParent(parentId: TLParentId): TLShapeId[]
  updateShape(partial: TLShapeUpdate): unknown
  updateShapes(partials: TLShapeUpdate[]): unknown
}

export type ShapePartial = CrewShapePartial<TLShape>

export type ViewportBounds = BoxModel
