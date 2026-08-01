import type { TransformEditor } from './types'

export function updateEdgeScrolling(editor: TransformEditor, elapsed: number): void {
  if (!editor.inputs.getIsDragging?.() || editor.inputs.getIsPanning?.()) return
  editor.edgeScrollManager?.updateEdgeScrolling(elapsed)
}
