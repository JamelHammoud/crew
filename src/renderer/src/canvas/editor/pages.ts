import type { TLPageId, TLParentId, TLShape, TLShapeId } from '../schema'

export function sortedChildren(shapes: readonly TLShape[], parentId: TLParentId): TLShape[] {
  return shapes
    .filter(shape => shape.parentId === parentId)
    .sort((a, b) => a.index.localeCompare(b.index) || a.id.localeCompare(b.id))
}

export function sortedPageShapes(shapes: readonly TLShape[], pageId: TLPageId): TLShape[] {
  const result: TLShape[] = []
  const visit = (parentId: TLParentId) => {
    for (const shape of sortedChildren(shapes, parentId)) {
      result.push(shape)
      visit(shape.id)
    }
  }
  visit(pageId)
  return result
}

export function descendantsOf(shapes: readonly TLShape[], roots: readonly TLShapeId[]): TLShapeId[] {
  const result: TLShapeId[] = []
  const seen = new Set<TLShapeId>()
  const visit = (id: TLShapeId) => {
    if (seen.has(id)) return
    seen.add(id)
    result.push(id)
    for (const child of sortedChildren(shapes, id)) visit(child.id)
  }
  for (const id of roots) visit(id)
  return result
}

export function rootIds(shapes: readonly TLShape[], ids: readonly TLShapeId[]): TLShapeId[] {
  const selected = new Set(ids)
  return ids.filter(id => {
    let parent = shapes.find(shape => shape.id === id)?.parentId
    while (typeof parent === 'string' && parent.startsWith('shape:')) {
      if (selected.has(parent as TLShapeId)) return false
      parent = shapes.find(shape => shape.id === parent)?.parentId
    }
    return true
  })
}
