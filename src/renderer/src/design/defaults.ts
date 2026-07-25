import {
  DefaultDashStyle,
  DefaultFontStyle,
  DefaultHorizontalAlignStyle,
  DefaultTextAlignStyle,
  LineShapeSplineStyle,
  type Editor
} from 'tldraw'

export function applyDesignDefaults(editor: Editor): void {
  editor.run(
    () => {
      editor.setStyleForNextShapes(DefaultFontStyle, 'sans')
      editor.setStyleForNextShapes(DefaultDashStyle, 'solid')
      editor.setStyleForNextShapes(LineShapeSplineStyle, 'line')
      editor.setStyleForNextShapes(DefaultTextAlignStyle, 'start')
      editor.setStyleForNextShapes(DefaultHorizontalAlignStyle, 'start')
    },
    { history: 'ignore' }
  )
}
