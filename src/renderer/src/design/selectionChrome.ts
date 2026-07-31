import type { Editor, SelectionForegroundOverlayUtil } from '../canvas'

export function selectionChromeVisible(editor: Editor): boolean {
  if (editor.getEditingShapeId()) return false
  return (editor.overlays.getOverlayUtil('selection_foreground') as SelectionForegroundOverlayUtil).isActive()
}
