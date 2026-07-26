import type { CSSProperties } from 'react'
import { nodeShapeOf, type DesignNodeProps, type Effect, type Layout, type Paint, type Stroke, type TypeStyle } from '../../../shared/designNode'
import { polygonClip, type UnitPoint } from './nodeShape'

const FAMILIES: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI", sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: '"Cascadia Mono", ui-monospace, "SF Mono", Menlo, monospace'
}

const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end' }
const JUSTIFY: Record<string, string> = { ...ALIGN, between: 'space-between' }

function withOpacity(color: string, opacity: number): string {
  if (opacity >= 1) return color
  const alpha = Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0')
  return color.length === 9 ? color.slice(0, 7) + alpha : color + alpha
}

function stopList(stops: Array<{ color: string; at: number }>): string {
  return stops
    .slice()
    .sort((a, b) => a.at - b.at)
    .map(stop => `${stop.color} ${Math.round(stop.at * 100)}%`)
    .join(', ')
}

function paintLayer(paint: Paint): string | null {
  if (paint.type === 'solid') return `linear-gradient(${withOpacity(paint.color, paint.opacity)}, ${withOpacity(paint.color, paint.opacity)})`
  if (paint.type === 'linear') return `linear-gradient(${paint.angle}deg, ${stopList(paint.stops)})`
  if (paint.type === 'radial') return `radial-gradient(circle at 50% 50%, ${stopList(paint.stops)})`
  return null
}

function strokeShadows(strokes: Stroke[]): string[] {
  const out: string[] = []
  for (const stroke of strokes) {
    if (!stroke.visible || stroke.weight <= 0 || stroke.style !== 'solid') continue
    if (stroke.align === 'inside') out.push(`inset 0 0 0 ${stroke.weight}px ${stroke.color}`)
    else if (stroke.align === 'outside') out.push(`0 0 0 ${stroke.weight}px ${stroke.color}`)
    else {
      const half = stroke.weight / 2
      out.push(`inset 0 0 0 ${half}px ${stroke.color}`, `0 0 0 ${half}px ${stroke.color}`)
    }
  }
  return out
}

function dashedStroke(strokes: Stroke[]): CSSProperties {
  const dashed = strokes.find(stroke => stroke.visible && stroke.style !== 'solid' && stroke.weight > 0)
  if (!dashed) return {}
  return { outline: `${dashed.weight}px ${dashed.style} ${dashed.color}`, outlineOffset: `-${dashed.weight}px` }
}

function effectStyle(effects: Effect[]): { shadows: string[]; filter: string[]; backdrop: string[] } {
  const shadows: string[] = []
  const filter: string[] = []
  const backdrop: string[] = []
  for (const effect of effects) {
    if (!effect.visible) continue
    if (effect.type === 'shadow') shadows.push(`${effect.x}px ${effect.y}px ${effect.blur}px ${effect.spread}px ${effect.color}`)
    else if (effect.type === 'inner-shadow')
      shadows.push(`inset ${effect.x}px ${effect.y}px ${effect.blur}px ${effect.spread}px ${effect.color}`)
    else if (effect.type === 'layer-blur') filter.push(`blur(${effect.blur}px)`)
    else backdrop.push(`blur(${effect.blur}px)`)
  }
  return { shadows, filter, backdrop }
}

export function layoutStyle(layout: Layout): CSSProperties {
  if (layout.direction === 'none') return {}
  const [top, right, bottom, left] = layout.padding
  return {
    display: 'flex',
    flexDirection: layout.direction === 'row' ? 'row' : 'column',
    gap: `${layout.gap}px`,
    padding: `${top}px ${right}px ${bottom}px ${left}px`,
    alignItems: ALIGN[layout.align],
    justifyContent: JUSTIFY[layout.justify],
    flexWrap: layout.wrap ? 'wrap' : 'nowrap'
  }
}

export function textStyle(type: TypeStyle): CSSProperties {
  return {
    fontFamily: FAMILIES[type.family] ?? type.family,
    fontSize: `${type.size}px`,
    fontWeight: type.weight,
    lineHeight: type.lineHeight,
    letterSpacing: `${type.spacing}px`,
    textAlign: type.align,
    color: type.color,
    textTransform: type.transform === 'upper' ? 'uppercase' : type.transform === 'lower' ? 'lowercase' : 'none',
    fontStyle: type.italic ? 'italic' : 'normal'
  }
}

function fillLayers(fills: Paint[]): string[] {
  return fills
    .filter(fill => fill.visible)
    .map(paintLayer)
    .filter((layer): layer is string => layer !== null)
}

function cornerRadius(props: DesignNodeProps): string {
  if (nodeShapeOf(props.shape) === 'ellipse') return '50%'
  const [tl, tr, br, bl] = props.radius
  return `${tl}px ${tr}px ${br}px ${bl}px`
}

export function nodeStyle(props: DesignNodeProps): CSSProperties {
  const layers = fillLayers(props.fills)
  const { shadows, filter, backdrop } = effectStyle(props.effects)
  const boxShadow = [...strokeShadows(props.strokes), ...shadows]
  return {
    borderRadius: cornerRadius(props),
    backgroundImage: layers.length > 0 ? layers.join(', ') : undefined,
    boxShadow: boxShadow.length > 0 ? boxShadow.join(', ') : undefined,
    filter: filter.length > 0 ? filter.join(' ') : undefined,
    backdropFilter: backdrop.length > 0 ? backdrop.join(' ') : undefined,
    WebkitBackdropFilter: backdrop.length > 0 ? backdrop.join(' ') : undefined,
    mixBlendMode: props.blend === 'normal' ? undefined : (props.blend as CSSProperties['mixBlendMode']),
    overflow: props.clip || props.mask ? 'hidden' : undefined,
    ...dashedStroke(props.strokes),
    ...layoutStyle(props.layout)
  } as CSSProperties
}

export function polygonFillStyle(props: DesignNodeProps, points: UnitPoint[]): CSSProperties {
  const layers = fillLayers(props.fills)
  const { backdrop } = effectStyle(props.effects)
  return {
    clipPath: polygonClip(points),
    backgroundImage: layers.length > 0 ? layers.join(', ') : undefined,
    backdropFilter: backdrop.length > 0 ? backdrop.join(' ') : undefined,
    WebkitBackdropFilter: backdrop.length > 0 ? backdrop.join(' ') : undefined
  } as CSSProperties
}

export function polygonStyle(props: DesignNodeProps): CSSProperties {
  const filter: string[] = []
  for (const effect of props.effects) {
    if (!effect.visible) continue
    if (effect.type === 'shadow') filter.push(`drop-shadow(${effect.x}px ${effect.y}px ${effect.blur}px ${effect.color})`)
    else if (effect.type === 'layer-blur') filter.push(`blur(${effect.blur}px)`)
  }
  return {
    filter: filter.length > 0 ? filter.join(' ') : undefined,
    mixBlendMode: props.blend === 'normal' ? undefined : (props.blend as CSSProperties['mixBlendMode'])
  }
}

export function strokeDash(stroke: Stroke): string | undefined {
  if (stroke.style === 'dashed') return `${stroke.weight * 3} ${stroke.weight * 2}`
  if (stroke.style === 'dotted') return `0 ${stroke.weight * 2}`
  return undefined
}
