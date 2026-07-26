import {
  cleanCorner,
  cleanEffect,
  cleanLayout,
  cleanNodeShape,
  cleanPaint,
  cleanStroke,
  cleanType,
  nodeDefaults,
  type DesignNodeProps
} from '../shared/designNode'
import type { DesignNodeInput } from '../shared/design'

function list<T>(value: unknown, clean: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const out: T[] = []
  for (const item of value) {
    const cleaned = clean(item)
    if (cleaned) out.push(cleaned)
  }
  return out
}

export function nodePropsFrom(input: DesignNodeInput, base: DesignNodeProps = nodeDefaults()): DesignNodeProps {
  const next: DesignNodeProps = {
    ...base,
    radius: [...base.radius],
    fills: [...base.fills],
    strokes: [...base.strokes],
    effects: [...base.effects],
    layout: { ...base.layout },
    type: { ...base.type }
  }
  if (typeof input.w === 'number' && input.w > 0) next.w = input.w
  if (typeof input.h === 'number' && input.h > 0) next.h = input.h
  if (typeof input.name === 'string') next.name = input.name
  if (typeof input.text === 'string') next.text = input.text
  if (typeof input.blend === 'string') next.blend = input.blend
  if (typeof input.clip === 'boolean') next.clip = input.clip
  if (typeof input.mask === 'boolean') next.mask = input.mask
  const radius = cleanCorner(input.radius)
  if (radius) next.radius = radius
  const fills = list(input.fills, cleanPaint)
  if (fills) next.fills = fills
  const strokes = list(input.strokes, cleanStroke)
  if (strokes) next.strokes = strokes
  const effects = list(input.effects, cleanEffect)
  if (effects) next.effects = effects
  const layout = cleanLayout(input.layout)
  if (layout) next.layout = layout
  const type = cleanType(input.type)
  if (type) next.type = type
  return next
}

export function nodeErrors(input: DesignNodeInput): string | null {
  if (input.fills !== undefined && !Array.isArray(input.fills)) return 'fills must be an array of paints'
  if (input.strokes !== undefined && !Array.isArray(input.strokes)) return 'strokes must be an array'
  if (input.effects !== undefined && !Array.isArray(input.effects)) return 'effects must be an array'
  if (Array.isArray(input.radius) && input.radius.length !== 4) return 'radius must be a number or four numbers'
  return null
}
