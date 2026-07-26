import type { Editor } from 'tldraw'

export function keepWholePixels(editor: Editor): () => void {
  return editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next, source) => {
    if (source !== 'user') return next
    if (next.x === prev.x && next.y === prev.y) return next
    const x = Math.round(next.x)
    const y = Math.round(next.y)
    return x === next.x && y === next.y ? next : { ...next, x, y }
  })
}
