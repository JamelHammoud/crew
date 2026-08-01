import type { Paint } from '../../../shared/designNode'
import { DEFAULT_COLORS, type TLDefaultColorStyle, type TLShape } from '../canvas/schema'
import { getColorValue } from '../canvas/styles'
import { frameBackground } from './frameFill'

export interface Ink {
  r: number
  g: number
  b: number
  a: number
}

export type TextInk = 'white' | 'black'

export type Palette = Record<string, unknown>

export interface ContrastEditor {
  getShapesAtPoint?(point: { x: number; y: number }, options?: { hitInside?: boolean; margin?: number }): TLShape[]
  getCurrentTheme?(): unknown
  getColorMode?(): string
}

const SURFACE: Ink = { r: 13, g: 13, b: 13, a: 1 }

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(([^)]+)\)$/i

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function fromHex(value: string): Ink | null {
  if (!HEX.test(value)) return null
  const body = value.slice(1)
  const full = body.length === 3 ? body.replace(/./g, part => part + part) : body
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
  }
}

function channel(piece: string, scale: number): number {
  const text = piece.trim()
  const value = Number.parseFloat(text)
  if (!Number.isFinite(value)) return NaN
  return text.endsWith('%') ? (value / 100) * scale : value
}

function fromRgb(value: string): Ink | null {
  const match = RGB.exec(value)
  if (!match) return null
  const parts = match[1].split(/[\s,/]+/).filter(piece => piece.length > 0)
  if (parts.length < 3) return null
  const r = channel(parts[0], 255)
  const g = channel(parts[1], 255)
  const b = channel(parts[2], 255)
  const a = parts.length > 3 ? channel(parts[3], 1) : 1
  if (![r, g, b, a].every(Number.isFinite)) return null
  return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: clamp(a, 0, 1) }
}

function fromName(value: string, palette: Palette): Ink | null {
  const name = value.toLowerCase()
  if (!(DEFAULT_COLORS as readonly string[]).includes(name)) return null
  return fromHex(getColorValue(palette, name as TLDefaultColorStyle, 'solid'))
}

export function readColor(value: string, palette: Palette = {}): Ink | null {
  const text = value.trim()
  if (!text) return null
  return fromHex(text) ?? fromRgb(text) ?? fromName(text, palette)
}

export function hexOf(ink: Ink): string {
  const part = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0')
  return `#${part(ink.r)}${part(ink.g)}${part(ink.b)}`
}

export const BOARD_SURFACE = hexOf(SURFACE)

export function over(top: Ink, bottom: Ink): Ink {
  const a = top.a + bottom.a * (1 - top.a)
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (one: number, two: number) => (one * top.a + two * bottom.a * (1 - top.a)) / a
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
}

function linear(value: number): number {
  const part = clamp(value, 0, 255) / 255
  return part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4
}

export function luminanceOf(ink: Ink): number {
  return 0.2126 * linear(ink.r) + 0.7152 * linear(ink.g) + 0.0722 * linear(ink.b)
}

function contrast(one: number, two: number): number {
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)
}

export function isDarkColor(value: string, palette: Palette = {}): boolean {
  const light = luminanceOf(readColor(value, palette) ?? SURFACE)
  return contrast(light, 1) > contrast(light, 0)
}

export function inkFor(background: string, palette: Palette = {}): TextInk {
  return isDarkColor(background, palette) ? 'white' : 'black'
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

function paintInk(paint: Paint, palette: Palette): Ink | null {
  if (paint.type === 'solid') {
    const ink = readColor(paint.color, palette)
    return ink ? { ...ink, a: clamp(paint.opacity, 0, 1) } : null
  }
  const stops = paint.stops
    .map(stop => readColor(stop.color, palette))
    .filter((ink): ink is Ink => ink !== null)
  if (stops.length === 0) return null
  const mean = (pick: (ink: Ink) => number) => stops.reduce((sum, ink) => sum + pick(ink), 0) / stops.length
  return { r: mean(ink => ink.r), g: mean(ink => ink.g), b: mean(ink => ink.b), a: mean(ink => ink.a) }
}

function stack(layers: Ink[]): Ink | null {
  if (layers.length === 0) return null
  let ink = layers[layers.length - 1]
  for (let at = layers.length - 2; at >= 0; at--) ink = over(layers[at], ink)
  return ink
}

function opaqueRun(inks: Array<Ink | null>): Ink[] {
  const layers: Ink[] = []
  for (const ink of inks) {
    if (!ink || ink.a <= 0) continue
    layers.push(ink)
    if (ink.a >= 1) break
  }
  return layers
}

function nodeInk(fills: Paint[], palette: Palette): Ink | null {
  return stack(opaqueRun(fills.filter(fill => fill.visible).map(fill => paintInk(fill, palette))))
}

function surfaceOf(shape: TLShape, palette: Palette): Ink | null {
  if (shape.type === 'frame') return readColor(frameBackground(shape.meta), palette)
  if (shape.type === 'design-node') return nodeInk((shape as TLShape<'design-node'>).props.fills, palette)
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
  return readColor(value) ? value : null
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
