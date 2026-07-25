import { DefaultDashStyle, DefaultFontStyle, LineShapeSplineStyle, type Editor } from 'tldraw'
import { DESIGN_STYLE_DEFAULTS } from '../../../shared/design'

export function applyDesignDefaults(editor: Editor): void {
  editor.setStyleForNextShapes(DefaultFontStyle, DESIGN_STYLE_DEFAULTS.font)
  editor.setStyleForNextShapes(DefaultDashStyle, DESIGN_STYLE_DEFAULTS.dash)
  editor.setStyleForNextShapes(LineShapeSplineStyle, DESIGN_STYLE_DEFAULTS.spline)
}
