import type { TLShape, TLShapeId } from '../../schema'
import { BaseBoxShapeTool } from '../box'

export class FrameShapeTool extends BaseBoxShapeTool {
  static override readonly id = 'frame'
  static override readonly initial = 'idle'
  readonly shapeType = 'frame' as const

  override onCreate(shape: TLShape | null): void {
    if (!shape) return
    this.editor.reparentShapes?.(getEnclosedShapeIds(this.editor, shape), shape.id)
    if (this.editor.getInstanceState().isToolLocked) this.editor.setCurrentTool('frame')
    else this.editor.setCurrentTool('select.idle')
  }
}

export function getEnclosedShapeIds(
  editor: Pick<
    FrameShapeTool['editor'],
    'getShapePageBounds' | 'getShapeAncestors' | 'getSortedChildIdsForParent' | 'getShape'
  >,
  shape: TLShape
): TLShapeId[] {
  const bounds = editor.getShapePageBounds(shape)
  if (!bounds) return []
  const enclosed: TLShapeId[] = []
  const ancestors = editor.getShapeAncestors?.(shape).map((ancestor) => ancestor.id) ?? []
  for (const siblingId of editor.getSortedChildIdsForParent?.(shape.parentId) ?? []) {
    const sibling = editor.getShape(siblingId)
    if (!sibling || sibling.id === shape.id || sibling.isLocked) continue
    const siblingBounds = editor.getShapePageBounds(sibling)
    if (!siblingBounds || !bounds.contains(siblingBounds)) continue
    if (!ancestors.includes(sibling.id) && sibling.parentId === shape.parentId) enclosed.push(sibling.id)
  }
  return enclosed
}
