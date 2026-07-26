import type { Editor, TLShape } from 'tldraw'

export interface Size {
  w: number
  h: number
}

export function sizeOf(shape: { props: unknown }): Size | null {
  const props = shape.props as { w?: unknown; h?: unknown }
  if (typeof props.w !== 'number' || typeof props.h !== 'number') return null
  return { w: props.w, h: props.h }
}

function whole<T extends TLShape>(shape: T): T {
  const x = Math.round(shape.x)
  const y = Math.round(shape.y)
  const size = sizeOf(shape)
  if (!size) return x === shape.x && y === shape.y ? shape : { ...shape, x, y }
  const w = Math.max(1, Math.round(shape.x + size.w) - x)
  const h = Math.max(1, Math.round(shape.y + size.h) - y)
  if (x === shape.x && y === shape.y && w === size.w && h === size.h) return shape
  return { ...shape, x, y, props: { ...shape.props, w, h } }
}

function geometryChanged(prev: TLShape, next: TLShape): boolean {
  if (next.x !== prev.x || next.y !== prev.y) return true
  const before = sizeOf(prev)
  const after = sizeOf(next)
  return before !== null && after !== null && (before.w !== after.w || before.h !== after.h)
}

export function keepWholePixels(editor: Editor): () => void {
  const stopCreate = editor.sideEffects.registerBeforeCreateHandler('shape', (shape, source) =>
    source === 'user' ? whole(shape) : shape
  )
  const stopChange = editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next, source) =>
    source === 'user' && geometryChanged(prev, next) ? whole(next) : next
  )
  return () => {
    stopCreate()
    stopChange()
  }
}
