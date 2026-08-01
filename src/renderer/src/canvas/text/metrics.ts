import { resolveLineHeight } from './measurement'

export interface FontMetrics {
  ascent: number
  descent: number
  capHeight: number
}

export interface TextTrim {
  top: number
  bottom: number
  total: number
  cap: number
}

export const PROBE_SIZE = 100

export const CAP_LETTER = 'H'

export const FALLBACK_METRICS: FontMetrics = { ascent: 0.97, descent: 0.21, capHeight: 0.705 }

export function readFontMetrics(full: TextMetrics, cap: TextMetrics, size: number): FontMetrics | null {
  const ascent = full.fontBoundingBoxAscent
  const descent = full.fontBoundingBoxDescent
  const capHeight = cap.actualBoundingBoxAscent
  if (!(size > 0) || !(ascent > 0) || !(descent >= 0) || !(capHeight > 0)) return null
  return { ascent: ascent / size, descent: descent / size, capHeight: capHeight / size }
}

export function trimOf(metrics: FontMetrics, fontSize: number, lineHeight: number): TextTrim {
  const line = resolveLineHeight(fontSize, lineHeight)
  const ascent = metrics.ascent * fontSize
  const descent = metrics.descent * fontSize
  const cap = metrics.capHeight * fontSize
  const leading = (line - (ascent + descent)) / 2
  return { top: leading + ascent - cap, bottom: leading + descent, total: line - cap, cap }
}

export function fontShorthand(family: string, weight: number | string, italic: boolean, size: number): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

const measured = new Map<string, FontMetrics>()

let surface: CanvasRenderingContext2D | null | undefined

function context(): CanvasRenderingContext2D | null {
  if (surface !== undefined) return surface
  try {
    surface = document.createElement('canvas').getContext('2d')
  } catch {
    surface = null
  }
  return surface
}

function probe(font: string): FontMetrics | null {
  const paint = context()
  if (!paint) return null
  try {
    paint.font = font
    if (paint.font === '') return null
    return readFontMetrics(paint.measureText('Hxy'), paint.measureText(CAP_LETTER), PROBE_SIZE)
  } catch {
    return null
  }
}

export function fontMetrics(family: string, weight: number | string, italic: boolean): FontMetrics {
  const font = fontShorthand(family, weight, italic, PROBE_SIZE)
  const held = measured.get(font)
  if (held) return held
  const read = probe(font) ?? FALLBACK_METRICS
  measured.set(font, read)
  return read
}

export function clearFontMetrics(): void {
  measured.clear()
}
