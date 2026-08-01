import type { JsonObject, TLBinding, TLBindingId, TLShape, TLShapeId } from '../schema'
import type { Store } from '../store'
import type { TLRecord } from '../schema'
import type { ShapeHandle } from '../shapes/ShapeUtil'
import type { TLShapeUpdate } from './types'

export interface BindingPartial {
  id?: TLBindingId
  type: TLBinding['type']
  fromId: TLShapeId
  toId: TLShapeId
  props?: Partial<TLBinding['props']>
  meta?: JsonObject
}

export interface BindingEditor {
  store: Store<TLRecord>
  run(fn: () => void, options?: { history?: 'ignore' | 'record' }): unknown
  getShape(id: TLShapeId): TLShape | undefined
  updateShape(partial: TLShapeUpdate): unknown
  getShapeHandles(shapeOrId: TLShape | TLShapeId): ShapeHandle[] | undefined
}

export interface BindingBehavior {
  onAfterChangeFromShape?(editor: BindingEditor, binding: TLBinding, before: TLShape, after: TLShape): void
  onAfterChangeToShape?(editor: BindingEditor, binding: TLBinding, before: TLShape, after: TLShape): void
  onBeforeIsolateFromShape?(editor: BindingEditor, binding: TLBinding, removedShape: TLShape): void
  onBeforeIsolateToShape?(editor: BindingEditor, binding: TLBinding, removedShape: TLShape): void
}
