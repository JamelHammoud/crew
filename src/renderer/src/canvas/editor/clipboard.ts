import { createBindingId, createShapeId, type TLAsset, type TLBinding, type TLShape, type TLShapeId } from '../schema'
import type { TLContent } from './types'

export interface ClipboardClone {
  shapes: TLShape[]
  bindings: TLBinding[]
  assets: TLAsset[]
  rootShapeIds: TLShapeId[]
}

export function cloneContent(content: TLContent, preserveIds = false): ClipboardClone {
  const idMap = new Map<TLShapeId, TLShapeId>()
  for (const shape of content.shapes) idMap.set(shape.id, preserveIds ? shape.id : createShapeId())
  const shapes = content.shapes.map(shape => {
    const parentId =
      typeof shape.parentId === 'string' && shape.parentId.startsWith('shape:')
        ? (idMap.get(shape.parentId as TLShapeId) ?? shape.parentId)
        : shape.parentId
    return structuredClone({ ...shape, id: idMap.get(shape.id)!, parentId })
  })
  const bindings = (content.bindings ?? [])
    .filter(binding => idMap.has(binding.fromId) && idMap.has(binding.toId))
    .map(binding =>
      structuredClone({
        ...binding,
        id: preserveIds ? binding.id : createBindingId(),
        fromId: idMap.get(binding.fromId)!,
        toId: idMap.get(binding.toId)!
      })
    )
  return {
    shapes,
    bindings,
    assets: structuredClone(content.assets ?? []),
    rootShapeIds: content.rootShapeIds.map(id => idMap.get(id)!).filter(Boolean)
  }
}
