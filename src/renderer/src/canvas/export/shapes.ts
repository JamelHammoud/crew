import type { DesignNodeProps, Effect, Paint, Stroke, TypeStyle } from '../../../../shared/designNode'
import { finite, pointsBounds, pointsPath, positive, round, type Point } from './geometry'
import { geoPath, nodePath } from './shapePath'
import { dashArray, fillPaint, patternDef, themeColor } from './theme'
import { decodeDrawPoints, escapeXml, plainLines, richLines, svgText } from './text'
import type { ExportBounds, ExportShape, ExportStore } from './types'

export interface ShapeRenderContext {
  store: ExportStore
  defs: Map<string, string>
  darkMode: boolean
  resolveAssetUrl?: (source: string) => string
}

export interface ShapeBody {
  body: string
  bounds: ExportBounds | null
  clip: string | null
  clipBounds?: ExportBounds
  mask: boolean
}

const WEIGHTS: Record<string, number> = { s: 2, m: 3.5, l: 4.5, xl: 6.5 }
const FONT_SIZES: Record<string, number> = { s: 18, m: 24, l: 36, xl: 44 }
const LABEL_SIZES: Record<string, number> = { s: 18, m: 22, l: 26, xl: 32 }

const cleanId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '_')

function stringProp(props: Record<string, unknown>, name: string, fallback = ''): string {
  return typeof props[name] === 'string' ? (props[name] as string) : fallback
}

function sizeValue(table: Record<string, number>, value: unknown, fallback: string): number {
  return table[String(value)] ?? table[fallback]
}

function shapeBox(w: number, h: number, spill = 0): ExportBounds {
  return { x: -spill, y: -spill, w: w + spill * 2, h: h + spill * 2 }
}

function pattern(ctx: ShapeRenderContext, shape: ExportShape, color: unknown): string {
  const id = `pattern-${cleanId(shape.id)}`
  if (!ctx.defs.has(id)) ctx.defs.set(id, patternDef(id, themeColor(color, 'pattern', ctx.darkMode)))
  return id
}

function strokeAttrs(color: string, width: number, dash: unknown): string {
  const array = dashArray(dash, width)
  return [
    `stroke="${escapeXml(color)}"`,
    `stroke-width="${round(width)}"`,
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    array ? `stroke-dasharray="${array}"` : '',
    dash === 'dotted' ? 'stroke-dashoffset="0.01"' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

function renderGeo(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const w = positive(props.w, 100)
  const h = positive(props.h, 100) + Math.max(0, finite(props.growY))
  const width = sizeValue(WEIGHTS, props.size, 'm')
  const stroke = themeColor(props.color, 'solid', ctx.darkMode)
  const path = geoPath(props.geo, w, h, width)
  const fill = fillPaint(props.fill, props.color, ctx.darkMode, pattern(ctx, shape, props.color))
  const label = svgText({
    x: 0,
    y: 0,
    w,
    h,
    lines: richLines(props.richText),
    size: sizeValue(LABEL_SIZES, props.size, 'm'),
    lineHeight: 1.35,
    family: stringProp(props, 'font', 'sans'),
    color: themeColor(props.labelColor, 'solid', ctx.darkMode),
    align: stringProp(props, 'align', 'middle'),
    vertical: stringProp(props, 'verticalAlign', 'middle'),
    padding: 16
  })
  const body = `<g transform="scale(${round(scale)})"><path d="${path}" fill="${fill}" ${strokeAttrs(stroke, width, props.dash)}/>${label}</g>`
  return { body, bounds: shapeBox(w * scale, h * scale, width * scale), clip: null, mask: false }
}

function customText(shape: ExportShape): Partial<TypeStyle> {
  const stored = shape.meta?.type
  return stored && typeof stored === 'object' ? (stored as Partial<TypeStyle>) : {}
}

function renderText(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const custom = customText(shape)
  const size = finite(custom.size, sizeValue(FONT_SIZES, props.size, 'm'))
  const lines = richLines(props.richText)
  const w = positive(props.w, 300)
  const h = Math.max(size, lines.length * size * finite(custom.lineHeight, 1.35))
  const body = `<g transform="scale(${round(scale)})">${svgText({
    x: 0,
    y: 0,
    w,
    h,
    lines,
    size,
    lineHeight: finite(custom.lineHeight, 1.35),
    family: String(custom.family ?? props.font ?? 'sans'),
    weight: custom.weight ?? 400,
    color: String(custom.color ?? themeColor(props.color, 'solid', ctx.darkMode)),
    align: stringProp(props, 'textAlign', 'start'),
    vertical: 'top',
    italic: custom.italic,
    spacing: custom.spacing,
    decoration: custom.decoration,
    transform: custom.transform
  })}</g>`
  return { body, bounds: shapeBox(w * scale, h * scale, size * 0.12), clip: null, mask: false }
}

function renderNote(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const w = 200
  const h = 200 + Math.max(0, finite(props.growY))
  const size = sizeValue(LABEL_SIZES, props.size, 'm') * positive(props.fontSizeAdjustment)
  const fill = themeColor(props.color, 'note', ctx.darkMode)
  const textColor = props.labelColor === 'black' ? '#000000' : themeColor(props.labelColor, 'solid', ctx.darkMode)
  const id = `note-shadow-${cleanId(shape.id)}`
  if (!ctx.darkMode && !ctx.defs.has(id))
    ctx.defs.set(
      id,
      `<filter id="${id}" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.25"/></filter>`
    )
  const body = `<g transform="scale(${round(scale)})"><rect width="${w}" height="${round(h)}" rx="1" fill="${fill}"${ctx.darkMode ? '' : ` filter="url(#${id})"`}/>${svgText(
    {
      x: 0,
      y: 0,
      w,
      h,
      lines: richLines(props.richText),
      size,
      lineHeight: 1.35,
      family: stringProp(props, 'font', 'sans'),
      color: textColor,
      align: stringProp(props, 'align', 'middle'),
      vertical: stringProp(props, 'verticalAlign', 'middle'),
      padding: 16
    }
  )}</g>`
  return { body, bounds: shapeBox(w * scale, h * scale, ctx.darkMode ? 0 : 8), clip: null, mask: false }
}

function renderFrame(shape: ExportShape): ShapeBody {
  const props = shape.props
  const w = positive(props.w, 100)
  const h = positive(props.h, 100)
  const background =
    typeof shape.meta?.background === 'string' && /^#[0-9a-f]{3,8}$/i.test(shape.meta.background)
      ? shape.meta.background
      : '#ffffff'
  const title = stringProp(props, 'name', 'Frame')
  const body = `<rect width="${round(w)}" height="${round(h)}" fill="${escapeXml(background)}" stroke="rgba(0,0,0,0.14)" stroke-width="1"/><rect x="0" y="-28" width="${round(Math.min(w, Math.max(54, title.length * 8 + 16)))}" height="24" rx="4" fill="#ffffff" stroke="rgba(0,0,0,0.14)"/><text x="8" y="-11" fill="#000000" font-family="ui-sans-serif,system-ui,sans-serif" font-size="12">${escapeXml(title)}</text>`
  return {
    body,
    bounds: { x: 0, y: -28, w, h: h + 28 },
    clip: `<rect width="${round(w)}" height="${round(h)}"/>`,
    clipBounds: shapeBox(w, h),
    mask: false
  }
}

function arrowMarker(
  ctx: ShapeRenderContext,
  shape: ExportShape,
  end: 'start' | 'end',
  kind: unknown,
  color: string,
  width: number
): string {
  if (kind === 'none' || !kind) return ''
  const id = `arrow-${end}-${cleanId(shape.id)}`
  if (!ctx.defs.has(id)) {
    const closed =
      kind === 'dot'
        ? '<circle cx="5" cy="5" r="3.5"/>'
        : kind === 'square'
          ? '<rect x="1.5" y="1.5" width="7" height="7"/>'
          : kind === 'diamond'
            ? '<path d="M0 5 5 0 10 5 5 10Z"/>'
            : kind === 'bar' || kind === 'pipe'
              ? '<path d="M5 0V10" fill="none"/>'
              : kind === 'inverted'
                ? '<path d="M0 0 10 5 0 10Z" fill="none"/>'
                : '<path d="M0 0 10 5 0 10Z"/>'
    ctx.defs.set(
      id,
      `<marker id="${id}" markerWidth="10" markerHeight="10" refX="${end === 'end' ? 9 : 1}" refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><g fill="${escapeXml(color)}" stroke="${escapeXml(color)}" stroke-width="${round(Math.max(1, width * 0.65))}" stroke-linejoin="round">${closed}</g></marker>`
    )
  }
  return `marker-${end}="url(#${id})"`
}

function arrowPoints(props: Record<string, unknown>): { start: Point; end: Point; control: Point } {
  const start = props.start as Partial<Point> | undefined
  const end = props.end as Partial<Point> | undefined
  const a = { x: finite(start?.x), y: finite(start?.y) }
  const b = { x: finite(end?.x, 200), y: finite(end?.y) }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy) || 1
  const bend = finite(props.bend)
  return {
    start: a,
    end: b,
    control: { x: (a.x + b.x) / 2 - (dy / length) * bend, y: (a.y + b.y) / 2 + (dx / length) * bend }
  }
}

function renderArrow(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const width = sizeValue(WEIGHTS, props.size, 'm')
  const color = themeColor(props.color, 'solid', ctx.darkMode)
  const { start, end, control } = arrowPoints(props)
  const curved = Math.abs(finite(props.bend)) > 0.001
  const path = curved
    ? `M${round(start.x)} ${round(start.y)} Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`
    : `M${round(start.x)} ${round(start.y)} L${round(end.x)} ${round(end.y)}`
  const markers = [
    arrowMarker(ctx, shape, 'start', props.arrowheadStart, color, width),
    arrowMarker(ctx, shape, 'end', props.arrowheadEnd, color, width)
  ]
    .filter(Boolean)
    .join(' ')
  const labelAt = finite(props.labelPosition, 0.5)
  const labelPoint = curved
    ? {
        x: (1 - labelAt) ** 2 * start.x + 2 * (1 - labelAt) * labelAt * control.x + labelAt ** 2 * end.x,
        y: (1 - labelAt) ** 2 * start.y + 2 * (1 - labelAt) * labelAt * control.y + labelAt ** 2 * end.y
      }
    : { x: start.x + (end.x - start.x) * labelAt, y: start.y + (end.y - start.y) * labelAt }
  const lines = richLines(props.richText)
  const label = svgText({
    x: labelPoint.x - 100,
    y: labelPoint.y - 20,
    w: 200,
    h: 40,
    lines,
    size: 20,
    lineHeight: 1.2,
    family: stringProp(props, 'font', 'sans'),
    color: themeColor(props.labelColor, 'solid', ctx.darkMode),
    align: 'middle',
    vertical: 'middle'
  })
  const points = curved ? [start, control, end] : [start, end]
  const bounds = pointsBounds(points, Math.max(12, width * 3))
  return {
    body: `<g transform="scale(${round(scale)})"><path d="${path}" fill="none" ${strokeAttrs(color, width, props.dash)} ${markers}/>${label}</g>`,
    bounds: bounds ? { x: bounds.x * scale, y: bounds.y * scale, w: bounds.w * scale, h: bounds.h * scale } : null,
    clip: null,
    mask: false
  }
}

function linePoints(props: Record<string, unknown>): Point[] {
  const records =
    props.points && typeof props.points === 'object' ? Object.values(props.points as Record<string, unknown>) : []
  return records
    .filter(point => point && typeof point === 'object')
    .sort((a, b) =>
      String((a as { index?: unknown }).index ?? '').localeCompare(String((b as { index?: unknown }).index ?? ''))
    )
    .map(point => ({ x: finite((point as { x?: unknown }).x), y: finite((point as { y?: unknown }).y) }))
}

function renderLine(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const points = linePoints(props)
  const width = sizeValue(WEIGHTS, props.size, 'm')
  const path = props.spline === 'cubic' && points.length > 2 ? smoothPath(points) : pointsPath(points, false)
  const body = `<g transform="scale(${round(scale)})"><path d="${path}" fill="none" ${strokeAttrs(themeColor(props.color, 'solid', ctx.darkMode), width, props.dash)}/></g>`
  const bounds = pointsBounds(points, width)
  return {
    body,
    bounds: bounds ? { x: bounds.x * scale, y: bounds.y * scale, w: bounds.w * scale, h: bounds.h * scale } : null,
    clip: null,
    mask: false
  }
}

function smoothPath(points: Point[]): string {
  if (points.length < 2) return ''
  let path = `M${round(points[0].x)} ${round(points[0].y)}`
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]
    const to = points[index]
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    path +=
      index === 1
        ? ` L${round(mid.x)} ${round(mid.y)}`
        : ` Q${round(from.x)} ${round(from.y)} ${round(mid.x)} ${round(mid.y)}`
    if (index === points.length - 1) path += ` L${round(to.x)} ${round(to.y)}`
  }
  return path
}

function decodedSegments(props: Record<string, unknown>): Point[] {
  if (!Array.isArray(props.segments)) return []
  const points: Point[] = []
  for (const segment of props.segments) {
    if (!segment || typeof segment !== 'object') continue
    const found = decodeDrawPoints(
      String((segment as { path?: unknown }).path ?? ''),
      (segment as { dim?: unknown }).dim
    )
    for (const point of found)
      points.push({ x: point.x * finite(props.scaleX, 1), y: point.y * finite(props.scaleY, 1) })
  }
  return points
}

function renderStrokeShape(shape: ExportShape, ctx: ShapeRenderContext, highlight: boolean): ShapeBody {
  const props = shape.props
  const scale = positive(props.scale)
  const points = decodedSegments(props)
  const width = sizeValue(WEIGHTS, props.size, 'm') * (highlight ? 3.5 : 1)
  const closed = !highlight && props.isClosed === true
  const color = highlight
    ? themeColor(props.color, 'solid', ctx.darkMode)
    : themeColor(props.color, 'solid', ctx.darkMode)
  const fill = closed ? fillPaint(props.fill, props.color, ctx.darkMode, pattern(ctx, shape, props.color)) : 'none'
  const opacity = highlight ? ' opacity="0.35"' : ''
  const path =
    points.length === 1
      ? `<circle cx="${round(points[0].x)}" cy="${round(points[0].y)}" r="${round(width / 2)}" fill="${color}"/>`
      : `<path d="${pointsPath(points, closed)}" fill="${fill}" ${strokeAttrs(color, width, props.dash)}${opacity}/>`
  const bounds = pointsBounds(points, width)
  return {
    body: `<g transform="scale(${round(scale)})">${path}</g>`,
    bounds: bounds ? { x: bounds.x * scale, y: bounds.y * scale, w: bounds.w * scale, h: bounds.h * scale } : null,
    clip: null,
    mask: false
  }
}

function nodeFill(ctx: ShapeRenderContext, shape: ExportShape, paint: Paint, index: number): string {
  if (paint.type === 'solid') return paint.color
  const id = `node-fill-${cleanId(shape.id)}-${index}`
  if (!ctx.defs.has(id)) {
    const stops = paint.stops
      .slice()
      .sort((a, b) => a.at - b.at)
      .map(
        stop =>
          `<stop offset="${round(stop.at * 100)}%" stop-color="${escapeXml(stop.color)}" stop-opacity="${round(paint.opacity)}"/>`
      )
      .join('')
    if (paint.type === 'radial') ctx.defs.set(id, `<radialGradient id="${id}">${stops}</radialGradient>`)
    else {
      const angle = (finite(paint.angle, 180) * Math.PI) / 180
      const x = Math.cos(angle) * 50
      const y = Math.sin(angle) * 50
      ctx.defs.set(
        id,
        `<linearGradient id="${id}" x1="${round(50 - x)}%" y1="${round(50 - y)}%" x2="${round(50 + x)}%" y2="${round(50 + y)}%">${stops}</linearGradient>`
      )
    }
  }
  return `url(#${id})`
}

function nodeFilter(ctx: ShapeRenderContext, shape: ExportShape, effects: Effect[]): { attr: string; spill: number } {
  const visible = effects.filter(effect => effect.visible)
  if (visible.length === 0) return { attr: '', spill: 0 }
  const id = `node-effect-${cleanId(shape.id)}`
  let spill = 0
  const parts: string[] = []
  for (const effect of visible) {
    if (effect.type === 'shadow') {
      spill = Math.max(spill, Math.abs(effect.x), Math.abs(effect.y), effect.blur * 2 + Math.max(0, effect.spread))
      parts.push(
        `<feDropShadow dx="${round(effect.x)}" dy="${round(effect.y)}" stdDeviation="${round(effect.blur / 2)}" flood-color="${escapeXml(effect.color)}"/>`
      )
    } else if (effect.type === 'inner-shadow') {
      parts.push(
        `<feDropShadow dx="${round(effect.x)}" dy="${round(effect.y)}" stdDeviation="${round(effect.blur / 2)}" flood-color="${escapeXml(effect.color)}"/>`
      )
    } else if (effect.type === 'layer-blur') {
      spill = Math.max(spill, effect.blur * 2)
      parts.push(`<feGaussianBlur stdDeviation="${round(effect.blur / 2)}"/>`)
    }
  }
  if (parts.length === 0) return { attr: '', spill }
  ctx.defs.set(id, `<filter id="${id}" x="-100%" y="-100%" width="300%" height="300%">${parts.join('')}</filter>`)
  return { attr: ` filter="url(#${id})"`, spill }
}

function nodeStroke(path: string, stroke: Stroke): string {
  if (!stroke.visible || stroke.weight <= 0) return ''
  const width = stroke.align === 'center' ? stroke.weight : stroke.weight * 2
  const array = dashArray(stroke.style, stroke.weight)
  return `<path d="${path}" fill="none" stroke="${escapeXml(stroke.color)}" stroke-width="${round(width)}"${array ? ` stroke-dasharray="${array}"` : ''}${stroke.style === 'dotted' ? ' stroke-linecap="round"' : ''} stroke-linejoin="round"/>`
}

function renderDesignNode(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props as unknown as DesignNodeProps
  const w = positive(props.w, 200)
  const h = positive(props.h, 120)
  const path = nodePath(props.shape, w, h, props.radius)
  const filter = nodeFilter(ctx, shape, Array.isArray(props.effects) ? props.effects : [])
  const style = props.blend && props.blend !== 'normal' ? ` style="mix-blend-mode:${escapeXml(props.blend)}"` : ''
  const fills = (Array.isArray(props.fills) ? props.fills : [])
    .map((paint, index) => ({ paint, index }))
    .filter(({ paint }) => paint.visible)
    .reverse()
    .map(
      ({ paint, index }) =>
        `<path d="${path}" fill="${nodeFill(ctx, shape, paint, index)}" fill-opacity="${paint.type === 'solid' ? round(paint.opacity) : 1}"/>`
    )
    .join('')
  const strokes = (Array.isArray(props.strokes) ? props.strokes : []).map(stroke => nodeStroke(path, stroke)).join('')
  const type = props.type ?? ({} as TypeStyle)
  const text = svgText({
    x: 0,
    y: 0,
    w,
    h,
    lines: plainLines(props.text),
    size: finite(type.size, 14),
    lineHeight: finite(type.lineHeight, 1.5),
    family: type.family ?? 'sans',
    weight: type.weight,
    color: type.color ?? '#ffffff',
    align: type.align,
    vertical: type.vertical,
    italic: type.italic,
    spacing: type.spacing,
    decoration: type.decoration,
    transform: type.transform
  })
  const body = props.mask ? '' : `<g${filter.attr}${style}>${fills}${strokes}${text}</g>`
  const outside = (Array.isArray(props.strokes) ? props.strokes : [])
    .filter(stroke => stroke.visible && stroke.align === 'outside')
    .reduce((max, stroke) => Math.max(max, stroke.weight), 0)
  return {
    body,
    bounds: props.mask ? null : shapeBox(w, h, Math.max(filter.spill, outside)),
    clip: props.clip || props.mask ? `<path d="${path}"/>` : null,
    clipBounds: shapeBox(w, h),
    mask: props.mask === true
  }
}

function assetSource(shape: ExportShape, ctx: ShapeRenderContext): string {
  const assetId = typeof shape.props.assetId === 'string' ? shape.props.assetId : ''
  const asset = ctx.store.assets.get(assetId)
  const source = asset?.props.src ?? shape.props.url
  if (typeof source !== 'string') return ''
  return ctx.resolveAssetUrl?.(source) ?? source
}

function renderImageLike(shape: ExportShape, ctx: ShapeRenderContext, video: boolean): ShapeBody {
  const props = shape.props
  const w = positive(props.w, 100)
  const h = positive(props.h, 100)
  const source = assetSource(shape, ctx)
  const flipX = props.flipX === true
  const flipY = props.flipY === true
  const transform =
    flipX || flipY
      ? ` transform="translate(${flipX ? w : 0} ${flipY ? h : 0}) scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})"`
      : ''
  const image = source
    ? `<image href="${escapeXml(source)}" width="${round(w)}" height="${round(h)}" preserveAspectRatio="xMidYMid slice"${transform}/>`
    : `<rect width="${round(w)}" height="${round(h)}" fill="#e8e8e8"/><path d="M0 ${round(h)} L${round(w * 0.35)} ${round(h * 0.6)} L${round(w * 0.55)} ${round(h * 0.78)} L${round(w)} ${round(h * 0.3)}" fill="none" stroke="#9fa8b2" stroke-width="2"/>`
  const play = video
    ? `<circle cx="${round(w / 2)}" cy="${round(h / 2)}" r="24" fill="#00000099"/><path d="M${round(w / 2 - 6)} ${round(h / 2 - 10)} L${round(w / 2 + 12)} ${round(h / 2)} L${round(w / 2 - 6)} ${round(h / 2 + 10)} Z" fill="#ffffff"/>`
    : ''
  return {
    body: `${image}${play}`,
    bounds: shapeBox(w, h),
    clip: `<rect width="${round(w)}" height="${round(h)}"/>`,
    clipBounds: shapeBox(w, h),
    mask: false
  }
}

function renderBookmark(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  const props = shape.props
  const w = positive(props.w, 300)
  const h = positive(props.h, 320)
  const assetId = typeof props.assetId === 'string' ? props.assetId : ''
  const asset = ctx.store.assets.get(assetId)
  const title = String(asset?.props.title ?? props.url ?? '')
  const description = String(asset?.props.description ?? '')
  const image =
    typeof asset?.props.image === 'string' && asset.props.image
      ? `<image href="${escapeXml(asset.props.image)}" width="${round(w)}" height="${round(h * 0.55)}" preserveAspectRatio="xMidYMid slice"/>`
      : ''
  return {
    body: `<rect width="${round(w)}" height="${round(h)}" rx="8" fill="#ffffff" stroke="#d4d4d4"/>${image}${svgText({ x: 16, y: h * 0.58, w: w - 32, h: h * 0.17, lines: [title], size: 18, lineHeight: 1.2, family: 'sans', weight: 600, color: '#1d1d1d' })}${svgText({ x: 16, y: h * 0.76, w: w - 32, h: h * 0.18, lines: [description], size: 13, lineHeight: 1.3, family: 'sans', color: '#666666' })}`,
    bounds: shapeBox(w, h),
    clip: null,
    mask: false
  }
}

function renderEmbed(shape: ExportShape): ShapeBody {
  const props = shape.props
  const w = positive(props.w, 300)
  const h = positive(props.h, 300)
  const url = stringProp(props, 'url')
  return {
    body: `<rect width="${round(w)}" height="${round(h)}" rx="8" fill="#f5f5f5" stroke="#b8b8b8"/><text x="${round(w / 2)}" y="${round(h / 2)}" text-anchor="middle" fill="#555555" font-family="ui-sans-serif,system-ui,sans-serif" font-size="14">${escapeXml(url)}</text>`,
    bounds: shapeBox(w, h),
    clip: null,
    mask: false
  }
}

export function renderShapeBody(shape: ExportShape, ctx: ShapeRenderContext): ShapeBody {
  if (shape.type === 'geo') return renderGeo(shape, ctx)
  if (shape.type === 'text') return renderText(shape, ctx)
  if (shape.type === 'note') return renderNote(shape, ctx)
  if (shape.type === 'frame') return renderFrame(shape)
  if (shape.type === 'arrow') return renderArrow(shape, ctx)
  if (shape.type === 'line') return renderLine(shape, ctx)
  if (shape.type === 'draw') return renderStrokeShape(shape, ctx, false)
  if (shape.type === 'highlight') return renderStrokeShape(shape, ctx, true)
  if (shape.type === 'design-node') return renderDesignNode(shape, ctx)
  if (shape.type === 'image') return renderImageLike(shape, ctx, false)
  if (shape.type === 'video') return renderImageLike(shape, ctx, true)
  if (shape.type === 'bookmark') return renderBookmark(shape, ctx)
  if (shape.type === 'embed') return renderEmbed(shape)
  return { body: '', bounds: null, clip: null, mask: false }
}
