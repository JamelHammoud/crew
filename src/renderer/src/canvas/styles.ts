import {
  DEFAULT_COLORS,
  DEFAULT_DASHES,
  DEFAULT_FONTS,
  SPLINES,
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultFontStyle,
  type TLLineShapeSplineStyle
} from './schema'

export interface StyleProp<Value> {
  id: string
  defaultValue: Value
  values: readonly Value[]
}

function style<Value>(id: string, defaultValue: Value, values: readonly Value[]): StyleProp<Value> {
  return { id, defaultValue, values }
}

export const DefaultColorStyle = style<TLDefaultColorStyle>('tldraw:color', 'black', DEFAULT_COLORS)
export const DefaultDashStyle = style<TLDefaultDashStyle>('tldraw:dash', 'draw', DEFAULT_DASHES)
export const DefaultFontStyle = style<TLDefaultFontStyle>('tldraw:font', 'draw', DEFAULT_FONTS)
export const LineShapeSplineStyle = style<TLLineShapeSplineStyle>('tldraw:spline', 'line', SPLINES)

export function getColorValue(
  palette: Record<string, unknown>,
  color: TLDefaultColorStyle,
  variant: 'solid' | 'semi' | 'pattern' | 'highlightSrgb'
): string {
  const entry = palette[color]
  if (typeof entry === 'string') return entry
  if (entry && typeof entry === 'object') {
    const value = (entry as Record<string, unknown>)[variant]
    if (typeof value === 'string') return value
    const solid = (entry as Record<string, unknown>).solid
    if (typeof solid === 'string') return solid
  }
  return color === 'white' ? '#ffffff' : '#1f1f1f'
}
