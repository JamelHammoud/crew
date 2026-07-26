import type { TLShapeId } from 'tldraw'
import type { Corner, Effect, Layout, Paint, Stroke, TypeStyle } from '../../../shared/designNode'

export interface PaintList {
  items: Paint[]
  set: (at: number, paint: Paint) => void
  add?: () => void
  remove?: (at: number) => void
  opacity: boolean
  hide: boolean
}

export interface StrokeList {
  items: Stroke[]
  set: (at: number, patch: Partial<Stroke>) => void
  add?: () => void
  remove?: (at: number) => void
  position: boolean
  hide: boolean
}

export interface EffectList {
  items: Effect[]
  set: (at: number, effect: Effect) => void
  add: () => void
  remove: (at: number) => void
}

export interface LayoutControl {
  value: Layout
  set: (patch: Partial<Layout>) => void
}

export interface RadiusControl {
  value: Corner
  set: (value: Corner) => void
}

export interface TextFields {
  size: boolean
  weight: boolean
  family: 'none' | 'system' | 'all'
  align: boolean
  vertical: boolean
  lineHeight: boolean
  spacing: boolean
  settings: boolean
  color: boolean
}

export interface TextControl {
  value: TypeStyle
  set: (patch: Partial<TypeStyle>) => void
  fields: TextFields
}

export interface Toggle<T> {
  value: T
  set: (value: T) => void
}

export interface NodeView {
  id: TLShapeId
  fills: PaintList | null
  strokes: StrokeList | null
  effects: EffectList | null
  layout: LayoutControl | null
  radius: RadiusControl | null
  text: TextControl | null
  blend: Toggle<string> | null
  clip: Toggle<boolean> | null
}

export const NO_TEXT_FIELDS: TextFields = {
  size: false,
  weight: false,
  family: false,
  align: false,
  vertical: false,
  lineHeight: false,
  spacing: false,
  settings: false,
  color: false
}

export function emptyView(id: TLShapeId): NodeView {
  return {
    id,
    fills: null,
    strokes: null,
    effects: null,
    layout: null,
    radius: null,
    text: null,
    blend: null,
    clip: null
  }
}
