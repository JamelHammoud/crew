import {
  clamp,
  fillsInk,
  hexOf,
  inkOn,
  opaqueRun,
  readInk,
  stack,
  type Ink,
  type ReadInk,
  type TextInk
} from '../../../shared/textContrast'
import { DEFAULT_COLORS, type TLDefaultColorStyle, type TLShape } from '../canvas/schema'
import { getColorValue } from '../canvas/styles'
import { frameBackground } from './frameFill'

export type { Ink, TextInk }
export { hexOf, luminanceOf, over } from '../../../shared/textContrast'

export type Palette = Record<string, unknown>

export interface ContrastEditor {
  getShapesAtPoint?(point: { x: number; y: number }, options?: { hitInside?: boolean; margin?: number }): TLShape[]
  getCurrentTheme?(): unknown
  getColorMode?(): string
}

const SURFACE: Ink = { r: 13, g: 13, b: 13, a: 1 }

export const BOARD_SURFACE = hexOf(SURFACE)

function fromName(value: string, palette: Palette): Ink | null {
  const name = value.trim().toLowerCase()
  if (!(DEFAULT_COLORS as readonly string[]).includes(name)) return null
  return readInk(getColorValue(palette, name as TLDefaultColorStyle, 'solid'))
}

export function readColor(value: string, palette: Palette = {}): Ink | null {
  const text = value.trim()
  if (!text) return null
  return readInk(text) ?? fromName(text, palette)
}

function reader(palette: Palette): ReadInk {
  return value => readColor(value, palette)
}

export function inkFor(background: string, palette: Palette = {}): TextInk {
  return inkOn(readColor(background, palette) ?? SURFACE)
}

export function isDarkColor(value: string, palette: Palette = {}): boolean {
  return inkFor(value, palette) === 'white'
}

function paletteValue(palette: Palette, name: unknown, variant: string): string {
  const color = (DEFAULT_COLORS as readonly string[]).includes(name as string)
    ? (name as TLDefaultColorStyle)
    : 'black'
  const entry = palette[color]
  if (entry && typeof entry === 'object') {
    const value = (entry as Palette)[variant]
    if (typeof value === 'string') return value
  }
  return getColorValue(palette, color, 'solid')
}

function surfaceOf(shape: TLShape, palette: Palette): Ink | null {
  if (shape.type === 'frame') return readColor(frameBackground(shape.meta), palette)
  if (shape.type === 'design-node') return fillsInk((shape as TLShape<'design-node'>).props.fills, reader(palette))
  const props = shape.props as { color?: unknown; fill?: unknown }
  if (shape.type === 'note') return readColor(paletteValue(palette, props.color, 'noteFill'), palette)
  if (shape.type !== 'geo' || props.fill === 'none') return null
  return readColor(paletteValue(palette, props.color, props.fill === 'semi' ? 'semi' : 'solid'), palette)
}

function shapeInk(shape: TLShape, palette: Palette): Ink | null {
  const ink = surfaceOf(shape, palette)
  if (!ink) return null
  return { ...ink, a: ink.a * clamp(shape.opacity, 0, 1) }
}

function paletteOf(editor: ContrastEditor): Palette {
  const theme = editor.getCurrentTheme?.() as { colors?: Palette } | undefined
  const palette = theme?.colors?.[editor.getColorMode?.() === 'dark' ? 'dark' : 'light']
  return palette && typeof palette === 'object' ? (palette as Palette) : {}
}

function cssSurface(): string | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null
  const host = document.querySelector('.design') ?? document.documentElement
  if (!host) return null
  const value = getComputedStyle(host).getPropertyValue('--design-canvas').trim()
  return readInk(value) ? value : null
}

export function boardSurface(): string {
  return cssSurface() ?? BOARD_SURFACE
}

export function backgroundBehind(editor: ContrastEditor, point: { x: number; y: number }): string {
  const palette = paletteOf(editor)
  const shapes = editor.getShapesAtPoint?.(point, { hitInside: true, margin: 0 }) ?? []
  const layers = opaqueRun(shapes.map(shape => shapeInk(shape, palette)))
  const base = readColor(boardSurface(), palette) ?? SURFACE
  return hexOf(stack([...layers, base]) ?? base)
}

export function textInkAt(editor: ContrastEditor, point: { x: number; y: number }): TextInk {
  return inkFor(backgroundBehind(editor, point))
}
