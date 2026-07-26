import type { Editor } from 'tldraw'

function whole<T extends { x: number; y: number }>(shape: T): T {
  const x = Math.round(shape.x)
  const y = Math.round(shape.y)
  return x === shape.x && y === shape.y ? shape : { ...shape, x, y }
}

export function keepWholePixels(editor: Editor): () => void {
  const stopCreate = editor.sideEffects.registerBeforeCreateHandler('shape', (shape, source) =>
    source === 'user' ? whole(shape) : shape
  )
  const stopChange = editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next, source) => {
    if (source !== 'user' || (next.x === prev.x && next.y === prev.y)) return next
    return whole(next)
  })
  return () => {
    stopCreate()
    stopChange()
  }
}
