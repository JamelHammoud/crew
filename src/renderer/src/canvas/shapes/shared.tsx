import { createElement, type CSSProperties, type ReactNode } from 'react'
import { Vec } from '../math/Vec'
import type { TLShape as CrewShape } from '../schema'
import { decodePoints } from '../schema/points'
import type { ShapeEditor } from './ShapeUtil'
import { shapeColor } from './theme'

type CrewColorStyle = CrewShape<'geo'>['props']['color']
type DrawSegment = CrewShape<'draw'>['props']['segments'][number]
type RichText = CrewShape<'text'>['props']['richText']

export const STROKES = { s: 2, m: 3.5, l: 5, xl: 10 } as const
export const TEXT_FONT_SIZES = { s: 18, m: 24, l: 36, xl: 44 } as const
export const LABEL_FONT_SIZES = { s: 18, m: 22, l: 26, xl: 32 } as const
export const ARROW_FONT_SIZES = { s: 18, m: 20, l: 24, xl: 28 } as const
export const FONT_FAMILIES = {
  draw: '"Comic Sans MS", "Bradley Hand", cursive',
  sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace'
} as const

export function richText(text = ''): RichText {
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
  return record.content
    .map((child, index) => {
      const text = plainText(child)
      const next = record.content?.[index + 1] as { type?: unknown } | undefined
      return next && record.type === 'doc' ? `${text}\n` : text
    })
    .join('')
    .replace(/\n$/, '')
}

export function segmentPoints(segments: DrawSegment[], scaleX = 1, scaleY = 1): Vec[] {
  const points: Vec[] = []
  for (const segment of segments) {
    const decoded = decodePoints(segment.path, segment.dim)
    const scaled = decoded.map(point => new Vec(point.x * scaleX, point.y * scaleY, point.z))
    if (segment.type === 'free' || scaled.length < 2) {
      points.push(...scaled)
      continue
    }
    const start = scaled[0]
    const end = scaled[1]
    const distance = Vec.Dist(start, end)
    if (distance === 0) {
      points.push(start)
      continue
    }
    const direction = end.clone().sub(start).uni()
    const nudge = Math.min(1, Math.floor(distance / 4))
    const from = start.clone().add(direction.clone().mul(nudge))
    const to = end.clone().sub(direction.clone().mul(nudge))
    const count = Math.max(4, Math.floor(distance / 16))
    points.push(start)
    for (let at = 1; at < count; at++) {
      const t = at / count
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      points.push(from.clone().lrp(to, eased))
    }
    points.push(end)
  }
  return points
}

export function pathFromPoints(points: readonly Vec[], close = false): string {
  if (points.length === 0) return ''
  return `M${points.map(point => `${point.x},${point.y}`).join(' L')}${close ? ' Z' : ''}`
}

export function shapeElement(
  path: string,
  options: {
    editor?: ShapeEditor
    color?: CrewColorStyle
    stroke?: string
    fill?: string
    width?: number
    opacity?: number
    children?: ReactNode
  } = {}
): ReactNode {
  const stroke = options.stroke ?? shapeColor(options.editor, options.color ?? 'black')
  const style: CSSProperties = { overflow: 'visible', pointerEvents: 'all' }
  return createElement(
    'svg',
    { className: 'crew-shape', width: '100%', height: '100%', style },
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
