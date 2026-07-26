import type { Editor } from 'tldraw'

export function selectionStroke(editor: Editor): string {
  return editor.getCurrentTheme().colors[editor.getColorMode()].selectionStroke
}
