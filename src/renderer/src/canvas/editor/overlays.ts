import { Box, Mat, Vec, type VecLike } from '../math'
import type { CanvasOverlay, CanvasOverlayEntry, CanvasOverlayUtil } from '../render/types'
import type { TLShape, TLShapeId } from '../schema'
import type { ShapeHandle, ShapeUtil } from '../shapes'
import type { BoundsSnapIndicator } from '../tools/snaps'
import type { TLScribble } from './scribbles'

interface OverlayEditor {
  getSelectionRotatedPageBounds(): Box | undefined
  getSelectionRotation(): number
  getSelectedShapeIds(): TLShapeId[]
  getOnlySelectedShape(): TLShape | null
  getShapeUtil(shape: TLShape): ShapeUtil
  getShapePageTransform(shape: TLShape): { applyToPoint(point: VecLike): VecLike }
  getShapeGeometry(shape: TLShape): { vertices: VecLike[]; isClosed: boolean }
  getHoveredShape(): TLShape | undefined
  getEditingShapeId(): TLShapeId | null
  getZoomLevel(): number
  getCurrentTheme(): { colors: Record<'light' | 'dark', Record<string, unknown>> }
  getColorMode(): 'light' | 'dark'
  getInstanceState(): { brush?: { x: number; y: number; w: number; h: number } | null; scribbles?: TLScribble[] }
  snaps: { getIndicators(): BoundsSnapIndicator[] }
}

interface ToolOverlayUtil extends CanvasOverlayUtil {
  options?: { zIndex?: number }
  getOverlays?(): CanvasOverlay[]
  onPointerDown?(overlay: CanvasOverlay, info: unknown): boolean | undefined
}

interface HitTarget {
  origin: VecLike
  rotation: number
  rect: { x: number; y: number; w: number; h: number }
}

export class OverlayManager {
  private readonly values = new Map<string, ToolOverlayUtil>()
  private hoveredId: string | null = null

  constructor(
    private readonly editor: OverlayEditor,
    constructors: readonly unknown[] = []
  ) {
    this.register(new ShapeIndicatorOverlayUtil(editor))
    this.register(new SelectionForegroundOverlayUtil(editor))
    this.register(new BrushOverlayUtil(editor))
    this.register(new SnapOverlayUtil(editor))
    this.register(new ScribbleOverlayUtil(editor))
    this.register(new ShapeHandleOverlayUtil(editor))
    for (const Constructor of constructors) {
      const value =
        typeof Constructor === 'function'
          ? new (Constructor as new (editor: OverlayEditor) => ToolOverlayUtil)(editor)
          : Constructor
      const id = overlayId(value)
      if (id && isOverlayUtil(value)) this.values.set(id, value)
    }
  }

  get(id: string): ToolOverlayUtil | undefined {
    return this.values.get(id)
  }

  all(): ToolOverlayUtil[] {
    return [...this.values.values()]
  }

  getActiveOverlayEntries(): CanvasOverlayEntry[] {
    const entries: Array<CanvasOverlayEntry & { zIndex: number }> = []
    for (const value of this.values.values()) {
      if (!value.isActive()) continue
      entries.push({ util: value, overlays: value.getOverlays?.() ?? [], zIndex: value.options?.zIndex ?? 0 })
    }
    return entries.sort((a, b) => a.zIndex - b.zIndex)
  }

  getOverlayUtil<Util extends ToolOverlayUtil = ToolOverlayUtil>(type: string): Util
  getOverlayUtil<Util extends ToolOverlayUtil = ToolOverlayUtil>(overlay: CanvasOverlay): Util
  getOverlayUtil<Util extends ToolOverlayUtil = ToolOverlayUtil>(value: string | CanvasOverlay): Util {
    const type = typeof value === 'string' ? value : value.type
    const util = this.values.get(type)
    if (!util) throw new Error(`No overlay util found for type: "${type}"`)
    return util as Util
  }

  getOverlayAtPoint(point: VecLike, margin = 0): CanvasOverlay | null {
    const entries = this.getActiveOverlayEntries()
    for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex--) {
      let nearest: CanvasOverlay | null = null
      let nearestDistance = Infinity
      for (const overlay of entries[entryIndex].overlays) {
        const props = overlay.props as { point?: VecLike; radius?: number; hit?: HitTarget }
        if (props.hit) {
          if (hitsTarget(props.hit, point, margin)) return overlay
          continue
        }
        if (!props.point) continue
        const radius = (props.radius ?? 6 / this.editor.getZoomLevel()) + margin
        const distance = Vec.Dist2(point, props.point)
        if (distance > radius ** 2 || distance >= nearestDistance) continue
        nearestDistance = distance
        nearest = overlay
      }
      if (nearest) return nearest
    }
    return null
  }

  getHoveredOverlay(): CanvasOverlay | null {
    if (!this.hoveredId) return null
    return (
      this.getActiveOverlayEntries()
        .flatMap(entry => entry.overlays)
        .find(overlay => overlay.id === this.hoveredId) ?? null
    )
  }

  setHoveredOverlay(id: string | null): void {
    this.hoveredId = id
  }

  private register(util: ToolOverlayUtil): void {
    const id = overlayId(util)
    if (id) this.values.set(id, util)
  }
}

function hitsTarget(target: HitTarget, point: VecLike, margin: number): boolean {
  const local = Mat.Identity()
    .translate(target.origin.x, target.origin.y)
    .rotate(target.rotation)
    .invert()
    .applyToPoint(point)
  const { x, y, w, h } = target.rect
  return local.x >= x - margin && local.x <= x + w + margin && local.y >= y - margin && local.y <= y + h + margin
}

const CORNERS = ['top_left', 'top_right', 'bottom_right', 'bottom_left'] as const
const EDGES = ['top', 'right', 'bottom', 'left'] as const
const ROTATE_CORNERS = ['top_left_rotate', 'top_right_rotate', 'bottom_right_rotate', 'bottom_left_rotate'] as const

class SelectionForegroundOverlayUtil implements ToolOverlayUtil {
  static type = 'selection_foreground'
  readonly options = { zIndex: 100 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.editor.getEditingShapeId() === null && this.editor.getSelectedShapeIds().length > 0
  }

  getOverlays(): CanvasOverlay[] {
    const bounds = this.editor.getSelectionRotatedPageBounds()
    if (!bounds) return []
    const zoom = this.editor.getZoomLevel()
    const rotation = this.editor.getSelectionRotation()
    const origin = { x: bounds.x, y: bounds.y }
    const { w, h } = bounds
    const size = 6 / zoom
    const hitX = (w < (8 / zoom) * 4 ? size / 2 : size) * 0.75
    const hitY = (h < (8 / zoom) * 4 ? size / 2 : size) * 0.75
    const corner = Math.max(hitX, hitY) * 1.5
    const rotateSize = Math.max(hitX, hitY) * 1.62
    const overlay = (handle: string, rect: HitTarget['rect']): CanvasOverlay => ({
      id: `selection:${handle}`,
      type: 'selection_foreground',
      props: {
        handle,
        point: Mat.Identity().translate(origin.x, origin.y).rotate(rotation).applyToPoint({
          x: rect.x + rect.w / 2,
          y: rect.y + rect.h / 2
        }),
        radius: 6 / zoom,
        hit: { origin, rotation, rect }
      }
    })
    return [
      ...CORNERS.map(handle => {
        const at = cornerPoint(handle, w, h)
        return overlay(handle, { x: at.x - corner, y: at.y - corner, w: corner * 2, h: corner * 2 })
      }),
      ...EDGES.map(handle => overlay(handle, edgeRect(handle, w, h, hitX, hitY))),
      ...ROTATE_CORNERS.map(handle => {
        const at = rotateCornerPoint(handle, w, h, rotateSize)
        return overlay(handle, {
          x: at.x - rotateSize,
          y: at.y - rotateSize,
          w: rotateSize * 2,
          h: rotateSize * 2
        })
      })
    ]
  }

  render(context: CanvasRenderingContext2D): void {
    const bounds = this.editor.getSelectionRotatedPageBounds()
    if (!bounds) return
    const zoom = this.editor.getZoomLevel()
    const rotation = this.editor.getSelectionRotation()
    const stroke = colorOf(this.editor, 'selectionStroke')
    context.save()
    context.translate(bounds.x, bounds.y)
    context.rotate(rotation)
    context.strokeStyle = stroke
    context.fillStyle = '#ffffff'
    context.lineWidth = 1.5 / zoom
    context.strokeRect(0, 0, bounds.w, bounds.h)
    const radius = 4 / zoom
    for (const handle of CORNERS) {
      const point = cornerPoint(handle, bounds.w, bounds.h)
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
    context.restore()
  }
}

class ShapeIndicatorOverlayUtil implements ToolOverlayUtil {
  static type = 'shape_indicator'
  readonly options = { zIndex: 50 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.indicated().length > 0
  }

  getOverlays(): CanvasOverlay[] {
    return this.indicated().map(shape => ({
      id: `shape-indicator:${shape.id}`,
      type: 'shape_indicator',
      props: { shapeId: shape.id }
    }))
  }

  render(context: CanvasRenderingContext2D): void {
    const shapes = this.indicated()
    if (shapes.length === 0) return
    context.strokeStyle = colorOf(this.editor, 'selectionStroke')
    context.lineWidth = 1.5 / this.editor.getZoomLevel()
    for (const shape of shapes) {
      const transform = this.editor.getShapePageTransform(shape)
      const geometry = this.editor.getShapeGeometry(shape)
      const vertices = geometry.vertices.map(vertex => transform.applyToPoint(vertex))
      if (vertices.length < 2) continue
      context.beginPath()
      context.moveTo(vertices[0].x, vertices[0].y)
      for (const vertex of vertices.slice(1)) context.lineTo(vertex.x, vertex.y)
      if (geometry.isClosed) context.closePath()
      context.stroke()
    }
  }

  private indicated(): TLShape[] {
    if (this.editor.getEditingShapeId() !== null) return []
    const hovered = this.editor.getHoveredShape()
    if (!hovered || this.editor.getSelectedShapeIds().includes(hovered.id)) return []
    return [hovered]
  }
}

class BrushOverlayUtil implements ToolOverlayUtil {
  static type = 'brush'
  readonly options = { zIndex: 10 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return Boolean(this.editor.getInstanceState().brush)
  }

  getOverlays(): CanvasOverlay[] {
    const brush = this.editor.getInstanceState().brush
    return brush ? [{ id: 'brush:current', type: 'brush', props: { box: { ...brush } } }] : []
  }

  render(context: CanvasRenderingContext2D): void {
    const brush = this.editor.getInstanceState().brush
    if (!brush) return
    context.fillStyle = colorOf(this.editor, 'brushFill')
    context.strokeStyle = colorOf(this.editor, 'brushStroke')
    context.lineWidth = 1 / this.editor.getZoomLevel()
    context.fillRect(brush.x, brush.y, brush.w, brush.h)
    context.strokeRect(brush.x, brush.y, brush.w, brush.h)
  }
}

class SnapOverlayUtil implements ToolOverlayUtil {
  static type = 'snap_indicator'
  readonly options = { zIndex: 20 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.editor.snaps.getIndicators().length > 0
  }

  getOverlays(): CanvasOverlay[] {
    return this.editor.snaps.getIndicators().map(indicator => ({
      id: indicator.id,
      type: 'snap_indicator',
      props: { indicator }
    }))
  }

  render(context: CanvasRenderingContext2D): void {
    const indicators = this.editor.snaps.getIndicators()
    if (indicators.length === 0) return
    drawSnapGuides(context, indicators, this.editor.getZoomLevel(), colorOf(this.editor, 'snap'))
  }
}

class ScribbleOverlayUtil implements ToolOverlayUtil {
  static type = 'scribble'
  readonly options = { zIndex: 30 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return (this.editor.getInstanceState().scribbles?.length ?? 0) > 0
  }

  getOverlays(): CanvasOverlay[] {
    return (this.editor.getInstanceState().scribbles ?? []).map(scribble => ({
      id: `scribble:${scribble.id}`,
      type: 'scribble',
      props: { scribble }
    }))
  }

  render(context: CanvasRenderingContext2D): void {
    const scribbles = this.editor.getInstanceState().scribbles ?? []
    const zoom = this.editor.getZoomLevel()
    for (const scribble of scribbles) {
      if (scribble.points.length < 2) continue
      context.save()
      context.globalAlpha = scribble.opacity
      context.strokeStyle = colorOf(this.editor, scribble.color)
      context.lineWidth = scribble.size / zoom
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.beginPath()
      context.moveTo(scribble.points[0].x, scribble.points[0].y)
      for (const point of scribble.points.slice(1)) context.lineTo(point.x, point.y)
      context.stroke()
      context.restore()
    }
  }
}

class ShapeHandleOverlayUtil implements ToolOverlayUtil {
  static type = 'shape_handle'
  readonly options = { zIndex: 200 }

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.editor.getEditingShapeId() === null && this.handles().length > 0
  }

  getOverlays(): CanvasOverlay[] {
    return this.handles().map(({ shape, handle, point }) => ({
      id: `shape-handle:${shape.id}:${handle.id}`,
      type: 'shape_handle',
      props: { shapeId: shape.id, handle, point, radius: 6 / this.editor.getZoomLevel() }
    }))
  }

  render(context: CanvasRenderingContext2D): void {
    const handles = this.handles()
    if (handles.length === 0) return
    const zoom = this.editor.getZoomLevel()
    context.strokeStyle = colorOf(this.editor, 'selectionStroke')
    context.fillStyle = '#ffffff'
    context.lineWidth = 1.5 / zoom
    for (const { handle, point } of handles) {
      const radius = (handle.type === 'virtual' ? 3 : 4) / zoom
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
  }

  private handles(): Array<{ shape: TLShape; handle: ShapeHandle; point: VecLike }> {
    const shape = this.editor.getOnlySelectedShape()
    if (!shape) return []
    const handles = this.editor.getShapeUtil(shape).getHandles?.(shape as never) ?? []
    const transform = this.editor.getShapePageTransform(shape)
    return handles.map(handle => ({ shape, handle, point: transform.applyToPoint(handle) }))
  }
}

function cornerPoint(handle: (typeof CORNERS)[number], width: number, height: number): VecLike {
  if (handle === 'top_left') return { x: 0, y: 0 }
  if (handle === 'top_right') return { x: width, y: 0 }
  if (handle === 'bottom_right') return { x: width, y: height }
  return { x: 0, y: height }
}

function rotateCornerPoint(
  handle: (typeof ROTATE_CORNERS)[number],
  width: number,
  height: number,
  size: number
): VecLike {
  if (handle === 'top_left_rotate') return { x: -size, y: -size }
  if (handle === 'top_right_rotate') return { x: width + size, y: -size }
  if (handle === 'bottom_right_rotate') return { x: width + size, y: height + size }
  return { x: -size, y: height + size }
}

function edgeRect(
  handle: (typeof EDGES)[number],
  width: number,
  height: number,
  hitX: number,
  hitY: number
): HitTarget['rect'] {
  if (handle === 'top') return { x: 0, y: -hitY, w: width, h: hitY * 2 }
  if (handle === 'right') return { x: width - hitX, y: 0, w: hitX * 2, h: height }
  if (handle === 'bottom') return { x: 0, y: height - hitY, w: width, h: hitY * 2 }
  return { x: -hitX, y: 0, w: hitX * 2, h: height }
}

function colorOf(editor: OverlayEditor, name: string): string {
  const value = editor.getCurrentTheme().colors[editor.getColorMode()][name]
  if (typeof value === 'string') return value
  const solid = (value as { solid?: unknown } | undefined)?.solid
  return typeof solid === 'string' ? solid : 'hsl(214, 84%, 56%)'
}

function overlayId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const id =
    (value as { id?: unknown }).id ??
    (value as { constructor?: { type?: unknown } }).constructor?.type ??
    (value as { constructor?: { id?: unknown } }).constructor?.id
  return typeof id === 'string' ? id : null
}

function isOverlayUtil(value: unknown): value is ToolOverlayUtil {
  return Boolean(
    value &&
      typeof (value as ToolOverlayUtil).isActive === 'function' &&
      typeof (value as ToolOverlayUtil).render === 'function'
  )
}
