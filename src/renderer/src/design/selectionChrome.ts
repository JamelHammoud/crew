import type { Editor, SelectionForegroundOverlayUtil } from 'tldraw'

export function selectionChromeVisible(editor: Editor): boolean {
  if (editor.getEditingShapeId()) return false
  return editor.overlays
    .getOverlayUtil<SelectionForegroundOverlayUtil>('selection_foreground')
    .isActive()
}
