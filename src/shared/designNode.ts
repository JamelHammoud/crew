export type Paint =
  | { type: 'solid'; color: string; opacity: number; visible: boolean }
  | { type: 'linear'; angle: number; stops: PaintStop[]; opacity: number; visible: boolean }
  | { type: 'radial'; stops: PaintStop[]; opacity: number; visible: boolean }

export interface PaintStop {
  color: string
  at: number
}

export interface Stroke {
  color: string
  weight: number
  align: 'inside' | 'center' | 'outside'
  style: 'solid' | 'dashed' | 'dotted'
  visible: boolean
}

export type Effect =
  | { type: 'shadow'; x: number; y: number; blur: number; spread: number; color: string; visible: boolean }
  | { type: 'inner-shadow'; x: number; y: number; blur: number; spread: number; color: string; visible: boolean }
  | { type: 'layer-blur'; blur: number; visible: boolean }
  | { type: 'background-blur'; blur: number; visible: boolean }

export type Sizing = 'fixed' | 'hug' | 'fill'

export interface Layout {
  direction: 'none' | 'row' | 'column'
  gap: number
  padding: [number, number, number, number]
  align: 'start' | 'center' | 'end'
  justify: 'start' | 'center' | 'end' | 'between'
  wrap: boolean
  sizeW: Sizing
  sizeH: Sizing
}

export interface TypeStyle {
  family: string
  size: number
  weight: number
  lineHeight: number
  spacing: number
  align: 'left' | 'center' | 'right'
  vertical: 'top' | 'middle' | 'bottom'
  color: string
  transform: 'none' | 'upper' | 'lower'
  decoration: 'none' | 'underline' | 'strike'
  italic: boolean
}

export type Corner = [number, number, number, number]

export type NodeShape = 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon' | 'star'

export const NODE_SHAPES: NodeShape[] = ['rect', 'ellipse', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star']

export interface DesignNodeProps {
  w: number
  h: number
  name: string
  shape: NodeShape
  radius: Corner
  fills: Paint[]
  strokes: Stroke[]
  effects: Effect[]
  layout: Layout
  text: string
  type: TypeStyle
  clip: boolean
  mask: boolean
  blend: string
  component: string
  instanceOf: string
}

export const NO_LAYOUT: Layout = {
  direction: 'none',
  gap: 0,
  padding: [0, 0, 0, 0],
  align: 'start',
  justify: 'start',
  wrap: false,
  sizeW: 'fixed',
  sizeH: 'fixed'
}

export const BASE_TYPE: TypeStyle = {
  family: 'sans',
  size: 14,
  weight: 400,
  lineHeight: 1.5,
  spacing: 0,
  align: 'left',
  vertical: 'top',
  color: '#ffffff',
  transform: 'none',
  decoration: 'none',
  italic: false
}

export function solid(color: string): Paint {
  return { type: 'solid', color, opacity: 1, visible: true }
}

export function corner(value: number): Corner {
  return [value, value, value, value]
}

export function nodeDefaults(): DesignNodeProps {
  return {
    w: 200,
    h: 120,
    name: 'Frame',
    shape: 'rect',
    radius: corner(0),
    fills: [solid('#222222')],
    strokes: [],
    effects: [],
    layout: { ...NO_LAYOUT },
    text: '',
    type: { ...BASE_TYPE },
    clip: false,
    mask: false,
    blend: 'normal',
    component: '',
    instanceOf: ''
  }
}

export function cleanNodeShape(value: unknown): NodeShape | null {
  return NODE_SHAPES.includes(value as NodeShape) ? (value as NodeShape) : null
}

export function nodeShapeOf(value: unknown): NodeShape {
  return cleanNodeShape(value) ?? 'rect'
}

export function hasCorners(shape: NodeShape): boolean {
  return shape === 'rect'
}

export function holdsChildren(shape: NodeShape): boolean {
  return shape === 'rect'
}

const HEX = /^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$/

export function isHex(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

function clamp(value: unknown, low: number, high: number, fallback: number): number {
  return typeof value === 'number' && isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback
}

function cleanStops(value: unknown): PaintStop[] {
  if (!Array.isArray(value)) return []
  const stops = value
    .filter(stop => isHex((stop as PaintStop)?.color))
    .map(stop => ({ color: (stop as PaintStop).color, at: clamp((stop as PaintStop).at, 0, 1, 0) }))
  return stops.length >= 2 ? stops : []
}

export function cleanPaint(value: unknown): Paint | null {
  const paint = value as Partial<Paint> & { type?: string }
  if (!paint || typeof paint !== 'object') return null
  const opacity = clamp((paint as { opacity?: number }).opacity, 0, 1, 1)
  const visible = (paint as { visible?: unknown }).visible !== false
  if (paint.type === 'solid') {
    return isHex((paint as { color?: string }).color)
      ? { type: 'solid', color: (paint as { color: string }).color, opacity, visible }
      : null
  }
  if (paint.type === 'linear') {
    const stops = cleanStops((paint as { stops?: unknown }).stops)
    if (stops.length === 0) return null
    return { type: 'linear', angle: clamp((paint as { angle?: number }).angle, -360, 360, 180), stops, opacity, visible }
  }
  if (paint.type === 'radial') {
    const stops = cleanStops((paint as { stops?: unknown }).stops)
    return stops.length === 0 ? null : { type: 'radial', stops, opacity, visible }
  }
  return null
}

export function cleanStroke(value: unknown): Stroke | null {
  const stroke = value as Partial<Stroke>
  if (!stroke || typeof stroke !== 'object' || !isHex(stroke.color)) return null
  return {
    color: stroke.color,
    weight: clamp(stroke.weight, 0, 200, 1),
    align: stroke.align === 'center' || stroke.align === 'outside' ? stroke.align : 'inside',
    style: stroke.style === 'dashed' || stroke.style === 'dotted' ? stroke.style : 'solid',
    visible: stroke.visible !== false
  }
}

export function cleanEffect(value: unknown): Effect | null {
  const effect = value as Partial<Effect> & { type?: string }
  if (!effect || typeof effect !== 'object') return null
  const visible = (effect as { visible?: unknown }).visible !== false
  if (effect.type === 'layer-blur' || effect.type === 'background-blur') {
    return { type: effect.type, blur: clamp((effect as { blur?: number }).blur, 0, 200, 8), visible }
  }
  if (effect.type === 'shadow' || effect.type === 'inner-shadow') {
    const shadow = effect as Partial<Extract<Effect, { type: 'shadow' }>>
    return {
      type: effect.type,
      x: clamp(shadow.x, -400, 400, 0),
      y: clamp(shadow.y, -400, 400, 4),
      blur: clamp(shadow.blur, 0, 400, 12),
      spread: clamp(shadow.spread, -400, 400, 0),
      color: isHex(shadow.color) ? shadow.color : '#00000040',
      visible
    }
  }
  return null
}

export function cleanCorner(value: unknown): Corner | null {
  if (typeof value === 'number' && isFinite(value)) return corner(Math.max(0, value))
  if (!Array.isArray(value) || value.length !== 4) return null
  return value.map(part => clamp(part, 0, 9999, 0)) as Corner
}

export function cleanLayout(value: unknown): Layout | null {
  const layout = value as Partial<Layout>
  if (!layout || typeof layout !== 'object') return null
  const direction = layout.direction
  const padding = Array.isArray(layout.padding)
    ? (layout.padding.map(part => clamp(part, 0, 9999, 0)) as Corner)
    : typeof layout.padding === 'number'
      ? corner(layout.padding)
      : NO_LAYOUT.padding
  const sizing = (value: unknown, fallback: Sizing): Sizing =>
    value === 'hug' || value === 'fill' || value === 'fixed' ? value : fallback
  return {
    direction: direction === 'row' || direction === 'column' ? direction : 'none',
    gap: clamp(layout.gap, 0, 9999, 0),
    padding: padding.length === 4 ? padding : NO_LAYOUT.padding,
    align: layout.align === 'center' || layout.align === 'end' ? layout.align : 'start',
    justify:
      layout.justify === 'center' || layout.justify === 'end' || layout.justify === 'between'
        ? layout.justify
        : 'start',
    wrap: layout.wrap === true,
    sizeW: sizing(layout.sizeW, 'fixed'),
    sizeH: sizing(layout.sizeH, 'fixed')
  }
}

export function cleanType(value: unknown): TypeStyle | null {
  const type = value as Partial<TypeStyle>
  if (!type || typeof type !== 'object') return null
  return {
    family: typeof type.family === 'string' && type.family ? type.family : BASE_TYPE.family,
    size: clamp(type.size, 1, 800, BASE_TYPE.size),
    weight: clamp(type.weight, 100, 900, BASE_TYPE.weight),
    lineHeight: clamp(type.lineHeight, 0.5, 4, BASE_TYPE.lineHeight),
    spacing: clamp(type.spacing, -20, 100, BASE_TYPE.spacing),
    align: type.align === 'center' || type.align === 'right' ? type.align : 'left',
    vertical: type.vertical === 'middle' || type.vertical === 'bottom' ? type.vertical : 'top',
    color: isHex(type.color) ? type.color : BASE_TYPE.color,
    transform: type.transform === 'upper' || type.transform === 'lower' ? type.transform : 'none',
    decoration: type.decoration === 'underline' || type.decoration === 'strike' ? type.decoration : 'none',
    paragraph: clamp(type.paragraph, 0, 400, BASE_TYPE.paragraph),
    italic: type.italic === true
  }
}
