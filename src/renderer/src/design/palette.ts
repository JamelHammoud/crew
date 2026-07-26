import {
  DefaultColorStyle,
  getColorValue,
  type Editor,
  type TLDefaultColorStyle,
  type TLDefaultDashStyle,
  type TLDefaultSizeStyle
} from 'tldraw'
import type { Stroke, TypeStyle } from '../../../shared/designNode'

const WEIGHTS: Record<TLDefaultSizeStyle, number> = { s: 2, m: 3.5, l: 4.5, xl: 6.5 }
const FONT_SIZES: Record<TLDefaultSizeStyle, number> = { s: 18, m: 24, l: 36, xl: 44 }
const SIZES = Object.keys(WEIGHTS) as TLDefaultSizeStyle[]

const DASHES: Record<TLDefaultDashStyle, Stroke['style']> = {
  none: 'solid',
  solid: 'solid',
  dashed: 'dashed',
  dotted: 'dotted',
  draw: 'solid'
}

export function paletteHex(editor: Editor, name: unknown): string {
  const palette = editor.getCurrentTheme().colors[editor.getColorMode()]
  const color = (DefaultColorStyle.values as readonly string[]).includes(name as string)
    ? (name as TLDefaultColorStyle)
    : 'black'
  return getColorValue(palette, color, 'solid')
}

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.replace(/./g, part => part + part) : clean
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0
  ]
}

export function nearestColor(editor: Editor, hex: string): TLDefaultColorStyle {
  const [r, g, b] = channels(hex)
  let best: TLDefaultColorStyle = 'black'
  let closest = Infinity
  for (const name of DefaultColorStyle.values) {
    const [cr, cg, cb] = channels(paletteHex(editor, name))
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
    if (distance < closest) {
      closest = distance
      best = name
    }
  }
  return best
}

function nearest(steps: Record<TLDefaultSizeStyle, number>, value: number): TLDefaultSizeStyle {
  return SIZES.reduce((best, size) =>
    Math.abs(steps[size] - value) < Math.abs(steps[best] - value) ? size : best
  )
}

export function sizeWeight(size: unknown): number {
  return WEIGHTS[(size as TLDefaultSizeStyle) in WEIGHTS ? (size as TLDefaultSizeStyle) : 'm']
}

export function weightSize(weight: number): TLDefaultSizeStyle {
  return nearest(WEIGHTS, weight)
}

export function sizeFont(size: unknown): number {
  return FONT_SIZES[(size as TLDefaultSizeStyle) in FONT_SIZES ? (size as TLDefaultSizeStyle) : 'm']
}

export function fontSize(px: number): TLDefaultSizeStyle {
  return nearest(FONT_SIZES, px)
}

export function dashStyle(dash: unknown): Stroke['style'] {
  return DASHES[dash as TLDefaultDashStyle] ?? 'solid'
}

export function styleDash(style: Stroke['style']): TLDefaultDashStyle {
  return style
}

export function alignOf(value: unknown): TypeStyle['align'] {
  if (value === 'middle' || value === 'center') return 'center'
  if (value === 'end' || value === 'right') return 'right'
  return 'left'
}

export function labelAlign(align: TypeStyle['align']): string {
  return align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
}

export function verticalOf(value: unknown): TypeStyle['vertical'] {
  if (value === 'middle' || value === 'center') return 'middle'
  if (value === 'end' || value === 'bottom') return 'bottom'
  return 'top'
}

export function labelVertical(vertical: TypeStyle['vertical']): string {
  return vertical === 'middle' ? 'middle' : vertical === 'bottom' ? 'end' : 'start'
}

export function familyOf(font: unknown): string {
  return font === 'serif' || font === 'mono' || font === 'draw' ? (font as string) : 'sans'
}
