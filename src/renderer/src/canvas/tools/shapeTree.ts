import type { StateNodeEditor } from './state'

export interface TreeEditor extends StateNodeEditor {
  [key: string]: any
}

export function getShapeParent(editor: TreeEditor, shape: any): any {
  if (editor.getShapeParent) return editor.getShapeParent(shape)
  if (!shape || typeof shape.parentId !== 'string' || !shape.parentId.startsWith('shape:')) return undefined
  return editor.getShape(shape.parentId)
}

export function findShapeAncestor(
  editor: TreeEditor,
  shape: any,
  predicate: (ancestor: any) => boolean
): any {
  if (editor.findShapeAncestor) return editor.findShapeAncestor(shape, predicate)
  if (!shape) return undefined
  const ancestors = editor.getShapeAncestors?.(shape) ?? []
  for (let i = ancestors.length - 1; i >= 0; i--) {
    if (predicate(ancestors[i])) return ancestors[i]
  }
  return undefined
}

export function hasAncestor(editor: TreeEditor, shape: any, ancestorId: string): boolean {
  if (editor.hasAncestor) return editor.hasAncestor(shape, ancestorId)
  return (editor.getShapeAncestors?.(shape) ?? []).some((ancestor: any) => ancestor.id === ancestorId)
}

export function visitDescendants(
  editor: TreeEditor,
  id: string,
  visitor: (id: string) => false | undefined
): void {
  for (const childId of editor.getSortedChildIdsForParent?.(id) ?? []) {
    if (visitor(childId) === false) continue
    visitDescendants(editor, childId, visitor)
  }
}

export function hidesSelectionBoundsBg(editor: TreeEditor, shape: any): boolean {
  if (!shape) return false
  return Boolean(editor.getShapeUtil(shape).hideSelectionBoundsBg?.(shape))
}

export function selectionHasBoundsBg(editor: TreeEditor): boolean {
  if (editor.getSelectedShapeIds().length > 1) return true
  const only = editor.getOnlySelectedShape()
  return Boolean(only) && !hidesSelectionBoundsBg(editor, only)
}
