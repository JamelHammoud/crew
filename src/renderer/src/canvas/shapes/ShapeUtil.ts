import type { ReactElement, ReactNode } from 'react'
import type { Geometry2d } from '../geometry'
import type { Box, SelectionHandle } from '../math/Box'
import { Vec, type VecLike } from '../math/Vec'
import type {
  TLAsset as CrewAsset,
  TLBinding as CrewBinding,
  TLBindingType as CrewBindingType,
  TLShape as CrewShape,
  TLShapeId as CrewShapeId
} from '../schema'
import type { PropsConfig } from '../schema/shapeProps'

export interface ShapeTextMeasure {
  measureHtml(html: string, options?: Record<string, unknown>): { w: number; h: number }
  measureText?(text: string, options?: Record<string, unknown>): { w: number; h: number }
}

export interface ShapeEditor {
  textMeasure?: ShapeTextMeasure
  getZoomLevel?(): number
  getInstanceState?(): { isCoarsePointer?: boolean }
  getColorMode?(): 'light' | 'dark'
  getCurrentThemeId?(): string
  getCurrentTheme?(): { colors?: Partial<Record<'light' | 'dark', Record<string, unknown>>> }
  getEditingShapeId?(): CrewShapeId | null
  getErasingShapeIds?(): CrewShapeId[]
  getCurrentPageState?(): { focusedGroupId: CrewShapeId | null; hintingShapeIds: CrewShapeId[] }
  getAsset?(id: string): CrewAsset | undefined
  resolveAssetUrl?(source: string): string
  getBindingsFromShape?(id: CrewShapeId, type?: CrewBindingType): CrewBinding[]
  getShape?(id: CrewShapeId): CrewShape | undefined
  getShapeGeometry?(shapeOrId: CrewShape | CrewShapeId): Geometry2d
  getSortedChildIdsForParent?(id: CrewShapeId): CrewShapeId[]
  getShapeLocalTransform?(shape: CrewShape): { applyToPoint(point: VecLike): VecLike }
  getPointInShapeSpace?(shape: CrewShape, point: VecLike): VecLike
  getShapePageBounds?(shapeOrId: CrewShape | CrewShapeId): Box | undefined
  getShapePageTransform?(shapeOrId: CrewShape | CrewShapeId): { applyToPoint(point: VecLike): VecLike }
  bindArrowTerminal?(
    arrow: CrewShape<'arrow'>,
    terminal: 'start' | 'end',
    pagePoint: VecLike,
    isPrecise: boolean
  ): unknown
  deleteBinding?(id: string): void
}

export type ShapeResizeMode = 'resize_bounds' | 'scale_shape'

export interface ShapeResizeInfo<Shape extends CrewShape> {
  newPoint: Vec
  handle: SelectionHandle
  mode: ShapeResizeMode
  scaleX: number
  scaleY: number
  initialBounds: Box
  initialShape: Shape
}

export interface CrewShapePartial<Shape extends CrewShape = CrewShape> {
  id?: CrewShapeId
  type: Shape['type']
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  props?: Partial<Shape['props']>
  meta?: Record<string, unknown>
}

export interface ShapeHandle {
  x: number
  y: number
  z?: number
  id: string
  type: string
  index?: string
  canSnap?: boolean
}

export interface ShapeHandleDragInfo<Shape extends CrewShape> {
  handle: ShapeHandle
  isPrecise: boolean
  isCreatingShape: boolean
  initial?: Shape
}

export interface ShapeUtilConstructor<Shape extends CrewShape = CrewShape> {
  new (editor: ShapeEditor): ShapeUtil<Shape>
  type: Shape['type']
  props?: PropsConfig<Shape['props']>
  handledAssetTypes?: readonly string[]
}

function configureShapeUtil<Constructor extends ShapeUtilConstructor>(
  this: Constructor,
  options: Record<string, unknown>
): Constructor {
  const Parent: any = this
  class ConfiguredShapeUtil extends Parent {
    constructor(...args: any[]) {
      super(...args)
      this.options = { ...this.options, ...options }
    }
  }
  return ConfiguredShapeUtil as unknown as Constructor
}

export abstract class ShapeUtil<Shape extends CrewShape = CrewShape> {
  static type: string
  static props?: PropsConfig<CrewShape['props']>
  static handledAssetTypes?: readonly string[]
  static configure = configureShapeUtil

  options: Record<string, unknown> = {}

  constructor(public editor: ShapeEditor) {}

  abstract getDefaultProps(): Shape['props']
  abstract getGeometry(shape: Shape): Geometry2d
  abstract component(shape: Shape): ReactNode

  getIndicatorPath(shape: Shape): Path2D | undefined {
    if (typeof Path2D === 'undefined') return undefined
    return new Path2D(this.getGeometry(shape).toSimpleSvgPath())
  }

  canSnap(_shape: Shape): boolean {
    return true
  }
  canTabTo(_shape: Shape): boolean {
    return true
  }
  canScroll(_shape: Shape): boolean {
    return false
  }
  canBind(_shape: Shape): boolean {
    return true
  }
  canEdit(_shape: Shape): boolean {
    return false
  }
  canResize(_shape: Shape): boolean {
    return true
  }
  canResizeChildren(_shape: Shape): boolean {
    return true
  }
  canEditInReadonly(_shape: Shape): boolean {
    return false
  }
  canEditWhileLocked(_shape: Shape): boolean {
    return false
  }
  canCrop(_shape: Shape): boolean {
    return false
  }
  canBeLaidOut(_shape: Shape): boolean {
    return true
  }
  canCull(_shape: Shape): boolean {
    return true
  }
  providesBackgroundForChildren(_shape: Shape): boolean {
    return false
  }
  hideResizeHandles(_shape: Shape): boolean {
    return false
  }
  hideRotateHandle(_shape: Shape): boolean {
    return false
  }
  hideSelectionBoundsBg(_shape: Shape): boolean {
    return false
  }
  hideSelectionBoundsFg(_shape: Shape): boolean {
    return false
  }
  isAspectRatioLocked(_shape: Shape): boolean {
    return false
  }
  isFrameLike(_shape: Shape): boolean {
    return false
  }
  isExportBoundsContainer(_shape: Shape): boolean {
    return false
  }
  canReceiveNewChildrenOfType(_shape: Shape, _type: CrewShape['type']): boolean {
    return false
  }
  canRemoveChildrenOfType(_shape: Shape, _type: CrewShape['type']): boolean {
    return true
  }
  getClipPath?(_shape: Shape): Vec[] | undefined
  getText?(_shape: Shape): string
  getReferencedUserIds?(_shape: Shape): string[]
  getAriaDescriptor?(_shape: Shape): string
  getHandles?(_shape: Shape): ShapeHandle[]
  onBeforeCreate?(_next: Shape): Shape | undefined
  onBeforeUpdate?(_previous: Shape, _next: Shape): Shape | undefined
  onResizeStart?(_shape: Shape): CrewShapePartial<Shape> | undefined
  onResize?(shape: Shape, info: ShapeResizeInfo<Shape>): Shape
  onResizeEnd?(_initial: Shape, _current: Shape): CrewShapePartial<Shape> | undefined
  onResizeCancel?(_initial: Shape, _current: Shape): void
  onTranslateStart?(_shape: Shape): CrewShapePartial<Shape> | undefined
  onTranslate?(_initial: Shape, _current: Shape): CrewShapePartial<Shape> | undefined
  onTranslateEnd?(_initial: Shape, _current: Shape): CrewShapePartial<Shape> | undefined
  onTranslateCancel?(_initial: Shape, _current: Shape): void
  onRotateStart?(_shape: Shape): CrewShapePartial<Shape> | undefined
  onRotate?(_initial: Shape, _current: Shape): CrewShapePartial<Shape> | undefined
  onRotateEnd?(_initial: Shape, _current: Shape): CrewShapePartial<Shape> | undefined
  onRotateCancel?(_initial: Shape, _current: Shape): void
  onHandleDragStart?(_shape: Shape, _info: ShapeHandleDragInfo<Shape>): CrewShapePartial<Shape> | undefined
  onHandleDrag?(_shape: Shape, _info: ShapeHandleDragInfo<Shape>): CrewShapePartial<Shape> | undefined
  onHandleDragEnd?(_shape: Shape, _info: ShapeHandleDragInfo<Shape>): CrewShapePartial<Shape> | undefined
  onHandleDragCancel?(_shape: Shape, _info: ShapeHandleDragInfo<Shape>): void
  toSvg?(shape: Shape): ReactElement | null | Promise<ReactElement | null>
}

export abstract class BaseBoxShapeUtil<
  Shape extends CrewShape & { props: { w: number; h: number } }
> extends ShapeUtil<Shape> {
  override onResize(shape: Shape, info: ShapeResizeInfo<Shape>): Shape {
    return resizeBox(shape, info)
  }
}

export function resizeBox<Shape extends CrewShape & { props: { w: number; h: number } }>(
  shape: Shape,
  info: ShapeResizeInfo<Shape>,
  limits: { minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number } = {}
): Shape {
  const minWidth = limits.minWidth ?? 1
  const minHeight = limits.minHeight ?? 1
  const maxWidth = limits.maxWidth ?? Infinity
  const maxHeight = limits.maxHeight ?? Infinity
  let w = shape.props.w * info.scaleX
  let h = shape.props.h * info.scaleY
  const offset = new Vec()
  if (w < 0) {
    offset.x = w
    w = -w
  }
  if (h < 0) {
    offset.y = h
    h = -h
  }
  w = Math.min(maxWidth, Math.max(minWidth, w))
  h = Math.min(maxHeight, Math.max(minHeight, h))
  const point = offset.rot(shape.rotation).add(info.newPoint)
  return { ...shape, x: point.x, y: point.y, props: { ...shape.props, w, h } }
}

export interface BindingEditor {
  getShape?(id: CrewShapeId): CrewShape | undefined
  updateShape?(shape: Partial<CrewShape> & Pick<CrewShape, 'id' | 'type'>): void
}

export abstract class BindingUtil<Binding extends CrewBinding = CrewBinding> {
  static type: string
  static props?: PropsConfig<CrewBinding['props']>

  constructor(public editor: BindingEditor) {}

  abstract getDefaultProps(): Partial<Binding['props']>
  onAfterCreate?(_binding: Binding): void
  onAfterChange?(_before: Binding, _after: Binding): void
  onBeforeDelete?(_binding: Binding): void
}
