import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Vec } from '../math/Vec'
import type { TLDefaultColorStyle, TLDrawShapeSegment, TLRichText } from '../schema'
import { decodePoints } from '../schema/points'

export const COLORS: Record<TLDefaultColorStyle, string> = {
  black: '#1d1d1d',
  grey: '#6f6f6f',
  'light-violet': '#c6b5ff',
  violet: '#7c5cff',
  blue: '#4263eb',
  'light-blue': '#74c0fc',
  yellow: '#ffd43b',
  orange: '#ff922b',
  green: '#2f9e44',
  'light-green': '#8ce99a',
  'light-red': '#ffa8a8',
  red: '#e03131',
  white: '#ffffff'
}

export const STROKES = { s: 2, m: 3, l: 5, xl: 8 } as const
export const FONT_SIZES = { s: 18, m: 22, l: 28, xl: 36 } as const
export const FONT_FAMILIES = {
  draw: '"Comic Sans MS", "Bradley Hand", cursive',
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
} as const

export function richText(text = ''): TLRichText {
  return {
    type: 'doc',
    content: text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [{ type: 'paragraph' }]
  }
}

export function plainText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const record = value as { text?: unknown; content?: unknown[]; type?: unknown }
  if (typeof record.text === 'string') return record.text
  if (!Array.isArray(record.content)) return ''
  return record.content.map((child, index) => {
    const text = plainText(child)
    const next = record.content?.[index + 1] as { type?: unknown } | undefined
    return next && record.type === 'doc' ? `${text}\n` : text
  }).join('').replace(/\n$/, '')
}

export function segmentPoints(segments: TLDrawShapeSegment[], scaleX = 1, scaleY = 1): Vec[] {
  const points: Vec[] = []
  for (const segment of segments) {
    const decoded = decodePoints(segment.path, segment.dim)
    for (const point of decoded) {
      points.push(new Vec(point.x * scaleX, point.y * scaleY, point.z))
    }
  }
  return points
}

export function pathFromPoints(points: readonly Vec[], close = false): string {
  if (points.length === 0) return ''
  return `M${points.map(point => `${point.x},${point.y}`).join(' L')}${close ? ' Z' : ''}`
}

export function shapeElement(
  path: string,
  options: { color?: TLDefaultColorStyle; fill?: string; width?: number; opacity?: number; children?: ReactNode } = {}
): ReactNode {
  const stroke = COLORS[options.color ?? 'black']
  const style: CSSProperties = { overflow: 'visible', pointerEvents: 'all' }
  return createElement(
    'svg',
    { className: 'tl-shape', width: '100%', height: '100%', style },
    createElement('path', {
      d: path,
      fill: options.fill ?? 'none',
      stroke,
      strokeWidth: options.width ?? 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: options.opacity
    }),
    options.children
  )
}

export function boxPath(w: number, h: number): string {
  return `M0,0 H${w} V${h} H0 Z`
}
