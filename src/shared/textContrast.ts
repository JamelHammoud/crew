import type { Paint } from './designNode'

export interface Ink {
  r: number
  g: number
  b: number
  a: number
}

export type TextInk = 'white' | 'black'

export type ReadInk = (value: string) => Ink | null

export const WHITE_INK: Ink = { r: 255, g: 255, b: 255, a: 1 }

export const DARK_INK: Ink = { r: 29, g: 29, b: 29, a: 1 }

export const FAINT = 0.02

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(([^)]+)\)$/i

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export function fromHex(value: string): Ink | null {
  const text = value.trim()
  if (!HEX.test(text)) return null
  const body = text.slice(1)
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
  const match = RGB.exec(value.trim())
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

export function readInk(value: string): Ink | null {
  const text = value.trim()
  if (!text) return null
  return fromHex(text) ?? fromRgb(text)
}

export function hexOf(ink: Ink): string {
  const part = (value: number) =>
    Math.round(clamp(value, 0, 255))
      .toString(16)
      .padStart(2, '0')
  return `#${part(ink.r)}${part(ink.g)}${part(ink.b)}`
}

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

export function contrastRatio(one: Ink, two: Ink): number {
  const first = luminanceOf(one)
  const second = luminanceOf(two)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export function inkOn(background: Ink, light: Ink = WHITE_INK, dark: Ink = DARK_INK): TextInk {
  return contrastRatio(background, light) > contrastRatio(background, dark) ? 'white' : 'black'
}

export function paintInk(paint: Paint, read: ReadInk): Ink | null {
  const opacity = clamp(paint.opacity, 0, 1)
  if (paint.type === 'solid') {
    const ink = read(paint.color)
    return ink ? { ...ink, a: ink.a * opacity } : null
  }
  const stops = paint.stops.map(stop => read(stop.color)).filter((ink): ink is Ink => ink !== null)
  if (stops.length === 0) return null
  const mean = (pick: (ink: Ink) => number) => stops.reduce((sum, ink) => sum + pick(ink), 0) / stops.length
  return { r: mean(ink => ink.r), g: mean(ink => ink.g), b: mean(ink => ink.b), a: mean(ink => ink.a) * opacity }
}

export function stack(layers: Ink[]): Ink | null {
  if (layers.length === 0) return null
  let ink = layers[layers.length - 1]
  for (let at = layers.length - 2; at >= 0; at--) ink = over(layers[at], ink)
  return ink
}

export function opaqueRun(inks: Array<Ink | null>): Ink[] {
  const layers: Ink[] = []
  for (const ink of inks) {
    if (!ink || ink.a <= FAINT) continue
    layers.push(ink)
    if (ink.a >= 1) break
  }
  return layers
}

export function fillsInk(fills: Paint[], read: ReadInk): Ink | null {
  return stack(opaqueRun(fills.filter(fill => fill.visible).map(fill => paintInk(fill, read))))
}
