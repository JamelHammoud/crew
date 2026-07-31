import { getIndicesBetween } from '../schema'
import type { TLShape, TLShapeId } from '../schema'

export type OrderOperation = 'forward' | 'front' | 'backward' | 'back'

export function reorderedShapes(siblings: TLShape[], ids: readonly TLShapeId[], operation: OrderOperation): TLShape[] {
  const selected = new Set(ids)
  const order = [...siblings]
  if (operation === 'front') {
    const moving = order.filter(shape => selected.has(shape.id))
    order.splice(0, order.length, ...order.filter(shape => !selected.has(shape.id)), ...moving)
  } else if (operation === 'back') {
    const moving = order.filter(shape => selected.has(shape.id))
    order.splice(0, order.length, ...moving, ...order.filter(shape => !selected.has(shape.id)))
  } else if (operation === 'forward') {
    for (let i = order.length - 2; i >= 0; i--) {
      if (selected.has(order[i].id) && !selected.has(order[i + 1].id)) {
        ;[order[i], order[i + 1]] = [order[i + 1], order[i]]
      }
    }
  } else {
    for (let i = 1; i < order.length; i++) {
      if (selected.has(order[i].id) && !selected.has(order[i - 1].id)) {
        ;[order[i], order[i - 1]] = [order[i - 1], order[i]]
      }
    }
  }
  const indices = getIndicesBetween(null, null, order.length)
  return order.map((shape, index) => (shape.index === indices[index] ? shape : { ...shape, index: indices[index] }))
}
