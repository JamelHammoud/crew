import type { CSSProperties } from 'react'
import { resolveLineHeight } from './measurement'

export type VerticalTrim = 'none' | 'cap'

export interface TrimFont {
  fontFamily: string
  fontSize: number
  fontStyle: string
  fontWeight: string
  lineHeight: number
}

export interface FaceMetrics {
  ascent: number
  descent: number
  cap: number
}

export interface TrimEdges {
  top: number
  bottom: number
  total: number
  cap: number
}

export const FALLBACK_FACE: FaceMetrics = { ascent: 0.97, descent: 0.21, cap: 0.705 }

export const PROBE_SIZE = 100

const CAPITAL = 'H'
const faces = new Map<string, FaceMetrics>()

let paper: CanvasRenderingContext2D | null | undefined

export function clearFaceMetrics(): void {
  faces.clear()
  paper = undefined
}

function ruler(): CanvasRenderingContext2D | null {
  if (paper !== undefined) return paper
  try {
    paper = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  } catch {
    paper = null
  }
  return paper
}

export function fontShorthand(font: TrimFont, size: number): string {
  return `${font.fontStyle} ${font.fontWeight} ${size}px ${font.fontFamily}`
}

export function readFaceMetrics(ink: TextMetrics, size: number): FaceMetrics | null {
  const ascent = ink.fontBoundingBoxAscent / size
  const descent = ink.fontBoundingBoxDescent / size
  const cap = ink.actualBoundingBoxAscent / size
  const read = [ascent, descent, cap].every(part => typeof part === 'number' && isFinite(part))
  return read && cap > 0 ? { ascent, descent, cap } : null
}

function probe(font: TrimFont): FaceMetrics | null {
  const context = ruler()
  if (!context) return null
  try {
    context.font = fontShorthand(font, PROBE_SIZE)
    const ink = context.measureText(CAPITAL) as TextMetrics | undefined
    return ink ? readFaceMetrics(ink, PROBE_SIZE) : null
  } catch {
    return null
  }
}

export function faceMetrics(font: TrimFont): FaceMetrics {
  const key = fontShorthand(font, PROBE_SIZE)
  const known = faces.get(key)
  if (known) return known
  const face = probe(font) ?? FALLBACK_FACE
  faces.set(key, face)
  return face
}

export function trimEdges(font: TrimFont, trim: VerticalTrim): TrimEdges | null {
  if (trim !== 'cap') return null
  const face = faceMetrics(font)
  const line = resolveLineHeight(font.fontSize, font.lineHeight)
  const ascent = face.ascent * font.fontSize
  const descent = face.descent * font.fontSize
  const cap = face.cap * font.fontSize
  const leading = (line - ascent - descent) / 2
  return { top: leading + ascent - cap, bottom: leading + descent, cap }
}

export function trimmedHeight(height: number, edges: TrimEdges): number {
  return Math.max(edges.cap, height - edges.top - edges.bottom)
}

export function trimStyle(edges: TrimEdges | null, scale: number): CSSProperties {
  return edges ? { marginTop: -edges.top * scale } : {}
}
