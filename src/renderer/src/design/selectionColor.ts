import type { Editor } from '../canvas'

export function selectionStroke(editor: Editor): string {
  return editor.getCurrentTheme().colors[editor.getColorMode()].selectionStroke
}
