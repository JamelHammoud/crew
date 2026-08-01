import type { TLBinding, TLRecord, TLShape, TLShapeId } from '../schema'
import type { Store } from '../store'
import type { BindingManager } from './bindings'

interface SideEffectEditor {
  store: Store<TLRecord>
  bindings: BindingManager
  getShape(id: TLShapeId): TLShape | undefined
  getSortedChildIdsForParent(parentId: TLShape['parentId']): TLShapeId[]
  getSelectedShapeIds(): TLShapeId[]
  setSelectedShapes(shapes: readonly TLShapeId[]): unknown
  setErasingShapes(ids: TLShapeId[]): unknown
  setHintingShapes(ids: TLShapeId[]): unknown
  setEditingShape(shape: TLShapeId | null): unknown
  getEditingShapeId(): TLShapeId | null
  updateInstanceState(update: { hoveredShapeId?: TLShapeId | null }): unknown
  getInstanceState(): { hoveredShapeId: TLShapeId | null; erasingShapeIds: TLShapeId[]; hintingShapeIds: TLShapeId[] }
  isShapeOfType(shape: TLShape, type: string): boolean
  deleteShapes(shapes: readonly TLShapeId[]): unknown
}

export function registerDefaultSideEffects(editor: SideEffectEditor): () => void {
  const { sideEffects } = editor.store
  const stops = [
    sideEffects.registerAfterCreateHandler('binding', binding =>
      editor.bindings.handleBindingCreated(binding as TLBinding)
    ),
    sideEffects.registerAfterChangeHandler('binding', (before, after) =>
      editor.bindings.handleBindingChanged(before as TLBinding, after as TLBinding)
    ),
    sideEffects.registerAfterChangeHandler('shape', (before, after) => {
      const shapeBefore = before as TLShape
      const shapeAfter = after as TLShape
      editor.bindings.handleShapeChanged(shapeBefore, shapeAfter)
      if (shapeBefore.parentId !== shapeAfter.parentId) checkForEmptyGroup(editor, shapeBefore.parentId)
    }),
    sideEffects.registerBeforeDeleteHandler('shape', record => {
      const shape = record as TLShape
      editor.bindings.handleShapeDeleted(shape)
    }),
    sideEffects.registerAfterDeleteHandler('shape', record => {
      const shape = record as TLShape
      cleanUpPageState(editor, shape.id)
      checkForEmptyGroup(editor, shape.parentId)
    })
  ]
  return () => {
    for (const stop of stops) stop()
  }
}

function cleanUpPageState(editor: SideEffectEditor, id: TLShapeId): void {
  const instance = editor.getInstanceState()
  if (instance.hoveredShapeId === id) editor.updateInstanceState({ hoveredShapeId: null })
  if (instance.erasingShapeIds.includes(id)) {
    editor.setErasingShapes(instance.erasingShapeIds.filter(erasing => erasing !== id))
  }
  if (instance.hintingShapeIds.includes(id)) {
    editor.setHintingShapes(instance.hintingShapeIds.filter(hinting => hinting !== id))
  }
  if (editor.getEditingShapeId() === id) editor.setEditingShape(null)
  const selected = editor.getSelectedShapeIds()
  if (selected.includes(id)) editor.setSelectedShapes(selected.filter(selectedId => selectedId !== id))
}

function checkForEmptyGroup(editor: SideEffectEditor, parentId: TLShape['parentId']): void {
  if (!parentId.startsWith('shape:')) return
  const parent = editor.getShape(parentId as TLShapeId)
  if (!parent || !editor.isShapeOfType(parent, 'group')) return
  const children = editor.getSortedChildIdsForParent(parent.id)
  if (children.length > 1) return
  if (children.length === 0) {
    editor.deleteShapes([parent.id])
    return
  }
  editor.store.put([{ ...editor.getShape(children[0])!, parentId: parent.parentId, index: parent.index }])
  editor.deleteShapes([parent.id])
}
