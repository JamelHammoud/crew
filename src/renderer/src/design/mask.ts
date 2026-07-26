import type { Editor, TLShape, TLShapeId } from 'tldraw'

type MaskNode = TLShape & { props: { mask: boolean; clip: boolean } }

function isNode(shape: TLShape | undefined): shape is MaskNode {
  return shape?.type === 'design-node'
}

function masking(shape: TLShape | undefined): shape is MaskNode {
  return isNode(shape) && shape.props.mask === true
}

function bottomFirst(editor: Editor, shapes: TLShape[]): TLShape[] {
  const order = editor.getSortedChildIdsForParent(shapes[0].parentId)
  return [...shapes].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
}

function sameParent(shapes: TLShape[]): boolean {
  return shapes.every(shape => shape.parentId === shapes[0].parentId)
}

// Figma masks with the bottom shape of the selection, so that is the one that
// takes the others in as children and clips them to its own outline.
export function maskCandidate(editor: Editor): MaskNode | null {
  const shapes = editor.getSelectedShapes()
  if (shapes.length < 2 || !sameParent(shapes)) return null
  const bottom = bottomFirst(editor, shapes)[0]
  if (!isNode(bottom) || bottom.props.mask) return null
  return holdsChildren(nodeShapeOf((bottom.props as { shape: unknown }).shape)) || true ? bottom : null
}

export function maskOf(editor: Editor): MaskNode | null {
  for (const shape of editor.getSelectedShapes()) {
    if (masking(shape)) return shape
    const parent = editor.getShape(shape.parentId as TLShapeId)
    if (masking(parent)) return parent
  }
  return null
}

export function useAsMask(editor: Editor): void {
  const mask = maskCandidate(editor)
  if (!mask) return
  const covered = editor.getSelectedShapes().filter(shape => shape.id !== mask.id)
  editor.run(() => {
    editor.markHistoryStoppingPoint('use as mask')
    editor.updateShape({ id: mask.id, type: 'design-node', props: { mask: true, clip: true } })
    editor.reparentShapes(covered.map(shape => shape.id), mask.id)
    editor.setSelectedShapes([mask.id])
  })
}

export function removeMask(editor: Editor): void {
  const mask = maskOf(editor)
  if (!mask) return
  const children = editor.getSortedChildIdsForParent(mask.id)
  editor.run(() => {
    editor.markHistoryStoppingPoint('remove mask')
    if (children.length > 0) editor.reparentShapes(children, mask.parentId)
    editor.updateShape({ id: mask.id, type: 'design-node', props: { mask: false, clip: false } })
    editor.setSelectedShapes([mask.id, ...children])
  })
}
