import type { ReactElement, ReactNode } from 'react'
import type { Geometry2d } from '../geometry'
import type { Box, SelectionHandle } from '../math/Box'
import { Vec, type VecLike } from '../math/Vec'
import type { TLAsset, TLBinding, TLBindingType, TLShape, TLShapeId } from '../schema'
import type { PropsConfig } from '../schema/shapeProps'

export interface ShapeEditor {
  getAsset?(id: string): TLAsset | undefined
  getBindingsFromShape?(id: TLShapeId, type?: TLBindingType): TLBinding[]
  getShape?(id: TLShapeId): TLShape | undefined
  getShapeGeometry?(shapeOrId: TLShape | TLShapeId): Geometry2d
  getSortedChildIdsForParent?(id: TLShapeId): TLShapeId[]
  getShapeLocalTransform?(shape: TLShape): { applyToPoint(point: VecLike): VecLike }
  getPointInShapeSpace?(shape: TLShape, point: VecLike): VecLike
  getShapePageBounds?(shapeOrId: TLShape | TLShapeId): Box | undefined
  updateShape?(shape: Partial<TLShape> & Pick<TLShape, 'id' | 'type'>): void
  updateShapes?(shapes: Array<Partial<TLShape> & Pick<TLShape, 'id' | 'type'>>): void
  deleteBinding?(id: string): void
}

export type TLResizeMode = 'resize_bounds' | 'scale_shape'

export interface TLResizeInfo<Shape extends TLShape> {
  newPoint: Vec
  handle: SelectionHandle
  mode: TLResizeMode
  scaleX: number
  scaleY: number
  initialBounds: Box
  initialShape: Shape
}

export interface TLShapePartial<Shape extends TLShape = TLShape> {
  id?: TLShapeId
  type: Shape['type']
  x?: number
  y?: number
  rotation?: number
  opacity?: number
  props?: Partial<Shape['props']>
  meta?: Record<string, unknown>
}

export interface TLShapeUtilConstructor<Shape extends TLShape = TLShape> {
  new (editor: ShapeEditor): ShapeUtil<Shape>
  type: Shape['type']
  props?: PropsConfig<Shape['props']>
  handledAssetTypes?: readonly string[]
}

export abstract class ShapeUtil<Shape extends TLShape = TLShape> {
  static type: string
  static props?: PropsConfig<TLShape['props']>
  static handledAssetTypes?: readonly string[]

  static configure<T extends TLShapeUtilConstructor>(this: T, options: Record<string, unknown>): T {
    const Parent = this as unknown as new (...args: any[]) => ShapeUtil
    class ConfiguredShapeUtil extends Parent {
      constructor(...args: any[]) {
        super(...args)
        this.options = { ...this.options, ...options }
      }
    }
    return ConfiguredShapeUtil as unknown as T
  }

  options: Record<string, unknown> = {}

  constructor(public editor: ShapeEditor) {}

  abstract getDefaultProps(): Shape['props']
  abstract getGeometry(shape: Shape): Geometry2d
  abstract component(shape: Shape): ReactNode

  getIndicatorPath(shape: Shape): Path2D | undefined {
    if (typeof Path2D === 'undefined') return undefined
    return new Path2D(this.getGeometry(shape).toSimpleSvgPath())
  }

  canSnap(_shape: Shape): boolean { return true }
  canTabTo(_shape: Shape): boolean { return true }
  canScroll(_shape: Shape): boolean { return false }
  canBind(_shape: Shape): boolean { return true }
  canEdit(_shape: Shape): boolean { return false }
  canResize(_shape: Shape): boolean { return true }
  canResizeChildren(_shape: Shape): boolean { return true }
  canEditInReadonly(_shape: Shape): boolean { return false }
  canEditWhileLocked(_shape: Shape): boolean { return false }
  canCrop(_shape: Shape): boolean { return false }
  canBeLaidOut(_shape: Shape): boolean { return true }
  canCull(_shape: Shape): boolean { return true }
  providesBackgroundForChildren(_shape: Shape): boolean { return false }
  hideResizeHandles(_shape: Shape): boolean { return false }
  hideRotateHandle(_shape: Shape): boolean { return false }
  hideSelectionBoundsBg(_shape: Shape): boolean { return false }
  hideSelectionBoundsFg(_shape: Shape): boolean { return false }
  isAspectRatioLocked(_shape: Shape): boolean { return false }
  isFrameLike(_shape: Shape): boolean { return false }
  isExportBoundsContainer(_shape: Shape): boolean { return false }
  canReceiveNewChildrenOfType(_shape: Shape, _type: TLShape['type']): boolean { return false }
  canRemoveChildrenOfType(_shape: Shape, _type: TLShape['type']): boolean { return true }
  getClipPath?(_shape: Shape): Vec[] | undefined
  getText?(_shape: Shape): string
  getAriaDescriptor?(_shape: Shape): string
  onResize?(shape: Shape, info: TLResizeInfo<Shape>): Shape
  toSvg?(shape: Shape): ReactElement | null | Promise<ReactElement | null>
}

export abstract class BaseBoxShapeUtil<Shape extends TLShape & { props: { w: number; h: number } }> extends ShapeUtil<Shape> {
  override onResize(shape: Shape, info: TLResizeInfo<Shape>): Shape {
    return resizeBox(shape, info)
  }
}

export function resizeBox<Shape extends TLShape & { props: { w: number; h: number } }>(
  shape: Shape,
  info: TLResizeInfo<Shape>,
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
  getShape?(id: TLShapeId): TLShape | undefined
  updateShape?(shape: Partial<TLShape> & Pick<TLShape, 'id' | 'type'>): void
}

export abstract class BindingUtil<Binding extends TLBinding = TLBinding> {
  static type: string
  static props?: PropsConfig<TLBinding['props']>

  constructor(public editor: BindingEditor) {}

  abstract getDefaultProps(): Partial<Binding['props']>
  onAfterCreate?(_binding: Binding): void
  onAfterChange?(_before: Binding, _after: Binding): void
  onBeforeDelete?(_binding: Binding): void
}
