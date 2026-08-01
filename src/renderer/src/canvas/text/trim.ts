import type { CSSProperties } from 'react'
import { resolveLineHeight } from './measurement'

export type VerticalTrim = 'standard' | 'cap'

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
}

const PROBE = 100
const CAPITAL = 'H'
const NOTHING: TrimEdges = { top: 0, bottom: 0 }
const faces = new Map<string, FaceMetrics>()

let paper: CanvasRenderingContext2D | null = null

export function cleanTrim(value: unknown): VerticalTrim {
  return value === 'cap' ? 'cap' : 'standard'
}

export function forgetFaceMetrics(): void {
  faces.clear()
  paper = null
}

function ruler(): CanvasRenderingContext2D | null {
  if (paper) return paper
  if (typeof document === 'undefined') return null
  paper = document.createElement('canvas').getContext('2d')
  return paper
}

function faceKey(font: TrimFont): string {
  return `${font.fontStyle} ${font.fontWeight} ${font.fontFamily}`
}

function readFace(font: TrimFont): FaceMetrics | null {
  const context = ruler()
  if (!context) return null
  context.font = `${font.fontStyle} ${font.fontWeight} ${PROBE}px ${font.fontFamily}`
  const ink = context.measureText(CAPITAL) as TextMetrics | undefined
  if (!ink) return null
  const face = {
    ascent: ink.fontBoundingBoxAscent / PROBE,
    descent: ink.fontBoundingBoxDescent / PROBE,
    cap: ink.actualBoundingBoxAscent / PROBE
  }
  const read = [face.ascent, face.descent, face.cap].every(part => typeof part === 'number' && isFinite(part))
  return read && face.cap > 0 ? face : null
}

export function faceMetrics(font: TrimFont): FaceMetrics | null {
  const known = faces.get(faceKey(font))
  if (known) return known
  const face = readFace(font)
  if (face) faces.set(faceKey(font), face)
  return face
}

export function trimEdges(font: TrimFont, trim: VerticalTrim): TrimEdges {
  if (trim !== 'cap') return NOTHING
  const face = faceMetrics(font)
  if (!face) return NOTHING
  const line = resolveLineHeight(font.fontSize, font.lineHeight)
  const ascent = face.ascent * font.fontSize
  const descent = face.descent * font.fontSize
  const leading = (line - ascent - descent) / 2
  return { top: leading + ascent - face.cap * font.fontSize, bottom: leading + descent }
}

export function trimHeight(height: number, edges: TrimEdges): number {
  return Math.max(1, height - edges.top - edges.bottom)
}

export function trimStyle(edges: TrimEdges, scale: number): CSSProperties {
  return edges.top === 0 ? {} : { marginTop: -edges.top * scale }
}
