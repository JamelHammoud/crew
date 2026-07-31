import type { TLShape } from '../schema'
import type { SharedStyle, TLStyleProp } from './types'

export function styleKey(style: TLStyleProp<unknown> | string): string {
  const id = typeof style === 'string' ? style : style.id
  return id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id
}

export function sharedOpacity(shapes: readonly TLShape[], fallback: number): SharedStyle<number> {
  if (shapes.length === 0) return { type: 'shared', value: fallback }
  const first = shapes[0].opacity
  return shapes.every(shape => shape.opacity === first) ? { type: 'shared', value: first } : { type: 'mixed' }
}
