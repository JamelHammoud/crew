import { DefaultDashStyle, DefaultFontStyle, LineShapeSplineStyle, type Editor } from 'tldraw'

export function applyDesignDefaults(editor: Editor): void {
  editor.setStyleForNextShapes(DefaultFontStyle, 'sans')
  editor.setStyleForNextShapes(DefaultDashStyle, 'solid')
  editor.setStyleForNextShapes(LineShapeSplineStyle, 'line')
}
