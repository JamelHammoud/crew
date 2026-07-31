import type { Box, VecLike } from '../math'
import type { CanvasOverlay, CanvasOverlayEntry, CanvasOverlayUtil } from '../render/types'
import type { TLShapeId } from '../schema'

interface OverlayEditor {
  getSelectionRotatedPageBounds(): Box | undefined
  getSelectionRotation(): number
  getSelectedShapeIds(): TLShapeId[]
  getZoomLevel(): number
  getCurrentTheme(): { colors: Record<'light' | 'dark', { selectionStroke: string }> }
  getColorMode(): 'light' | 'dark'
  getInstanceState(): { brush?: { x: number; y: number; w: number; h: number } | null }
}

interface ToolOverlayUtil extends CanvasOverlayUtil {
  getOverlays?(): CanvasOverlay[]
  onPointerDown?(overlay: CanvasOverlay, info: unknown): boolean | void
}

export class OverlayManager {
  private readonly values = new Map<string, ToolOverlayUtil>()
  private hoveredId: string | null = null

  constructor(private readonly editor: OverlayEditor, constructors: readonly unknown[] = []) {
    this.register(new SelectionForegroundOverlayUtil(editor))
    this.register(new BrushOverlayUtil(editor))
    this.register(new EmptyOverlayUtil('snap_indicator'))
    this.register(new EmptyOverlayUtil('shape_handle'))
    for (const Constructor of constructors) {
      const value = typeof Constructor === 'function'
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
    const entries: CanvasOverlayEntry[] = []
    for (const value of this.values.values()) {
      if (!value.isActive()) continue
      entries.push({ util: value, overlays: value.getOverlays?.() ?? [] })
    }
    return entries
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
      const overlays = entries[entryIndex].overlays
      for (const overlay of overlays) {
        const props = overlay.props as { point?: VecLike; radius?: number; bounds?: Box }
        if (props.point) {
          const radius = (props.radius ?? 6 / this.editor.getZoomLevel()) + margin
          if ((point.x - props.point.x) ** 2 + (point.y - props.point.y) ** 2 <= radius ** 2) return overlay
        } else if (props.bounds?.containsPoint(point, margin)) {
          return overlay
        }
      }
    }
    return null
  }

  getHoveredOverlay(): CanvasOverlay | null {
    if (!this.hoveredId) return null
    return this.getActiveOverlayEntries().flatMap(entry => entry.overlays).find(overlay => overlay.id === this.hoveredId) ?? null
  }

  setHoveredOverlay(id: string | null): void {
    this.hoveredId = id
  }

  private register(util: ToolOverlayUtil): void {
    const id = overlayId(util)
    if (id) this.values.set(id, util)
  }
}

class SelectionForegroundOverlayUtil implements ToolOverlayUtil {
  static type = 'selection_foreground'

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.editor.getSelectedShapeIds().length > 0
  }

  getOverlays(): CanvasOverlay[] {
    const bounds = this.editor.getSelectionRotatedPageBounds()
    if (!bounds) return []
    const zoom = this.editor.getZoomLevel()
    const radius = 6 / zoom
    const points = selectionHandlePoints(bounds, this.editor.getSelectionRotation(), 24 / zoom)
    const handles = Object.entries(points).map(([handle, point]) => ({
      id: `selection:${handle}`,
      type: 'selection_foreground',
      props: { handle, point, radius }
    }))
    return [{ id: 'selection:bounds', type: 'selection_foreground', props: { bounds } }, ...handles]
  }

  render(context: CanvasRenderingContext2D): void {
    const bounds = this.editor.getSelectionRotatedPageBounds()
    if (!bounds) return
    const zoom = this.editor.getZoomLevel()
    const rotation = this.editor.getSelectionRotation()
    const stroke = this.editor.getCurrentTheme().colors[this.editor.getColorMode()].selectionStroke
    context.strokeStyle = stroke
    context.fillStyle = '#ffffff'
    context.lineWidth = 1.5 / zoom
    context.save()
    context.translate(bounds.x, bounds.y)
    context.rotate(rotation)
    context.strokeRect(0, 0, bounds.w, bounds.h)
    context.restore()
    const points = selectionHandlePoints(bounds, rotation, 24 / zoom)
    const radius = 4 / zoom
    for (const point of Object.values(points)) {
      context.beginPath()
      context.arc(point.x, point.y, radius, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
  }
}

class BrushOverlayUtil implements ToolOverlayUtil {
  static type = 'brush'

  constructor(private readonly editor: OverlayEditor) {}

  isActive(): boolean {
    return this.editor.getInstanceState().brush !== null
  }

  getOverlays(): CanvasOverlay[] {
    const brush = this.editor.getInstanceState().brush
    return brush ? [{ id: 'brush:current', type: 'brush', props: { bounds: brush } }] : []
  }

  render(context: CanvasRenderingContext2D): void {
    const brush = this.editor.getInstanceState().brush
    if (!brush) return
    const colors = this.editor.getCurrentTheme().colors[this.editor.getColorMode()] as Record<string, string>
    context.fillStyle = colors.brushFill ?? 'rgba(128,128,128,.1)'
    context.strokeStyle = colors.brushStroke ?? 'rgba(128,128,128,.25)'
    context.lineWidth = 1 / this.editor.getZoomLevel()
    context.fillRect(brush.x, brush.y, brush.w, brush.h)
    context.strokeRect(brush.x, brush.y, brush.w, brush.h)
  }
}

class EmptyOverlayUtil implements ToolOverlayUtil {
  constructor(readonly id: string) {}

  isActive(): boolean {
    return false
  }

  render(): void {}
}

function selectionHandlePoints(bounds: Box, rotation: number, rotateDistance: number): Record<string, VecLike> {
  const local: Record<string, VecLike> = {
    top_left: { x: bounds.x, y: bounds.y },
    top: { x: bounds.midX, y: bounds.y },
    top_right: { x: bounds.maxX, y: bounds.y },
    right: { x: bounds.maxX, y: bounds.midY },
    bottom_right: { x: bounds.maxX, y: bounds.maxY },
    bottom: { x: bounds.midX, y: bounds.maxY },
    bottom_left: { x: bounds.x, y: bounds.maxY },
    left: { x: bounds.x, y: bounds.midY },
    mobile_rotate: { x: bounds.midX, y: bounds.y - rotateDistance }
  }
  if (rotation === 0) return local
  for (const point of Object.values(local)) {
    const dx = point.x - bounds.x
    const dy = point.y - bounds.y
    point.x = bounds.x + dx * Math.cos(rotation) - dy * Math.sin(rotation)
    point.y = bounds.y + dx * Math.sin(rotation) + dy * Math.cos(rotation)
  }
  return local
}

function overlayId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const id = (value as { id?: unknown }).id
    ?? (value as { constructor?: { type?: unknown } }).constructor?.type
    ?? (value as { constructor?: { id?: unknown } }).constructor?.id
  return typeof id === 'string' ? id : null
}

function isOverlayUtil(value: unknown): value is ToolOverlayUtil {
  return Boolean(value && typeof (value as ToolOverlayUtil).isActive === 'function' && typeof (value as ToolOverlayUtil).render === 'function')
}
