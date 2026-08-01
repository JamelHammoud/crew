import { Box, Mat, Vec, type VecLike } from '../math'
import type { CanvasOverlay, CanvasOverlayEntry, CanvasOverlayUtil } from '../render/types'
import type { TLShape, TLShapeId } from '../schema'
import type { ShapeHandle, ShapeUtil } from '../shapes'
import type { BoundsSnapIndicator } from '../tools/snaps'
import { drawSnapGuides } from './guides'
import type { TLScribble } from './scribbles'

interface OverlayEditor {
  getSelectionRotatedPageBounds(): Box | undefined
  getSelectionRotation(): number
  getSelectedShapeIds(): TLShapeId[]
  getOnlySelectedShape(): TLShape | null
  getShapeUtil(shape: TLShape): ShapeUtil
  getShapePageTransform(shape: TLShape): Mat
  getShapePageBounds(shape: TLShape): Box | undefined
  getViewportPageBounds(): Box
  getShapeGeometry(shape: TLShape): { vertices: VecLike[]; isClosed: boolean }
  getHoveredShape(): TLShape | undefined
  getShape(id: TLShapeId): TLShape | undefined
  getEditingShapeId(): TLShapeId | null
  getZoomLevel(): number
  getCurrentToolPath(): string
  getIsReadonly(): boolean
  isShapeHidden(shape: TLShape): boolean
  isShapeOrAncestorLocked(shape: TLShape): boolean
  getCurrentTheme(): { colors: Record<'light' | 'dark', Record<string, unknown>> }
  getColorMode(): 'light' | 'dark'
  getInstanceState(): {
    brush?: { x: number; y: number; w: number; h: number } | null
    scribbles?: TLScribble[]
    isCoarsePointer?: boolean
    isChangingStyle?: boolean
    hintingShapeIds?: TLShapeId[]
  }
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
  filled: boolean
}

class PaintPass {
  private token = 0
  private live = false

  begin(): void {
    this.token += 1
    if (this.live) return
    this.live = true
    queueMicrotask(() => {
      this.live = false
      this.token += 1
    })
  }

  key(): number {
    return this.live ? this.token : 0
  }
}

class PaintMemo<Value> {
  private key = 0
  private value: Value | undefined

  read(pass: PaintPass, compute: () => Value): Value {
    const key = pass.key()
    if (key !== 0 && key === this.key) return this.value as Value
    const value = compute()
    this.key = key
    this.value = value
    return value
  }
}

export class OverlayManager {
  private readonly values = new Map<string, ToolOverlayUtil>()
  private readonly pass = new PaintPass()
  private hoveredId: string | null = null

  constructor(
    private readonly editor: OverlayEditor,
    constructors: readonly unknown[] = []
  ) {
    this.register(new ShapeIndicatorOverlayUtil(editor, this.pass))
    this.register(new SelectionForegroundOverlayUtil(editor, this.pass))
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
    this.pass.begin()
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
          if (hitsTarget(props.hit, point, props.hit.filled ? 0 : margin)) return overlay
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
const INDICATOR_WIDTH = 1.5
const HINTED_INDICATOR_WIDTH = 2.5
const IDLE_INDICATOR_PATHS = new Set(['select.idle', 'select.editing_shape'])
const SELECTING_INDICATOR_PATHS = new Set([
  'select.brushing',
  'select.scribble_brushing',
  'select.pointing_shape',
  'select.pointing_selection',
  'select.pointing_handle',
  'select.pointing_resize_handle',
  'select.pointing_rotate_handle'
])

interface SelectionForegroundState {
  bounds: Box
  onlyShape: TLShape | null
  zoom: number
  rotation: number
  width: number
  height: number
  handleSize: number
  hitX: number
  hitY: number
  showBox: boolean
  showResizeHandles: boolean
  showRotateHandles: boolean
  hideAlternateCorners: boolean
  showOnlyOneHandle: boolean
  hideVerticalEdges: boolean
  hideHorizontalEdges: boolean
}

const CONTROL_PATHS = new Set([
  'select.idle',
  'select.pointing_selection',
  'select.pointing_shape',
  'select.pointing_resize_handle',
  'select.pointing_rotate_handle',
  'select.crop.idle'
])

const BOX_PATHS = new Set([
  ...CONTROL_PATHS,
  'select.brushing',
  'select.scribble_brushing',
  'select.pointing_canvas',
  'select.crop.pointing_crop',
  'select.crop.pointing_crop_handle'
])

class SelectionForegroundOverlayUtil implements ToolOverlayUtil {
  static type = 'selection_foreground'
  readonly options = { zIndex: 100 }
  private readonly memo = new PaintMemo<SelectionForegroundState | null>()

  constructor(
    private readonly editor: OverlayEditor,
    private readonly pass: PaintPass
  ) {}

  isActive(): boolean {
    const path = this.editor.getCurrentToolPath()
    return (
      this.editor.getEditingShapeId() === null &&
      this.editor.getSelectedShapeIds().length > 0 &&
      (BOX_PATHS.has(path) || path === 'select.resizing')
    )
  }

  getOverlays(): CanvasOverlay[] {
    const state = this.state()
    if (!state) return []
    const origin = { x: state.bounds.x, y: state.bounds.y }
    const corner = Math.max(state.hitX, state.hitY) * 1.5
    const rotateSize = Math.max(state.hitX, state.hitY) * 1.62
    const overlay = (overlayType: string, handle: string, rect: HitTarget['rect']): CanvasOverlay => ({
      id: `selection:${handle}`,
      type: 'selection_foreground',
      props: {
        overlayType,
        handle,
        point: Mat.Identity()
          .translate(origin.x, origin.y)
          .rotate(state.rotation)
          .applyToPoint({
            x: rect.x + rect.w / 2,
            y: rect.y + rect.h / 2
          }),
        radius: 6 / state.zoom,
        hit: { origin, rotation: state.rotation, rect, filled: true }
      }
    })
    const result: CanvasOverlay[] = []
    if (state.showResizeHandles) {
      const cornerHandles = state.showOnlyOneHandle
        ? (['top_left'] as const)
        : state.hideAlternateCorners
          ? (['top_left', 'bottom_right'] as const)
          : CORNERS
      for (const handle of cornerHandles) {
        const at = cornerPoint(handle, state.width, state.height)
        result.push(
          overlay('resize_handle', handle, {
            x: at.x - corner,
            y: at.y - corner,
            w: corner * 2,
            h: corner * 2
          })
        )
      }
      for (const handle of EDGES) {
        if ((handle === 'top' || handle === 'bottom') && state.hideVerticalEdges) continue
        if ((handle === 'left' || handle === 'right') && state.hideHorizontalEdges) continue
        result.push(
          overlay(
            'resize_handle',
            handle,
            edgeRect(handle, state.width, state.height, state.hitX, state.hitY)
          )
        )
      }
    }
    if (state.showRotateHandles) {
      for (const handle of ROTATE_CORNERS) {
        const at = rotateCornerPoint(handle, state.width, state.height, rotateSize)
        result.push(
          overlay('rotate_handle', handle, {
            x: at.x - rotateSize,
            y: at.y - rotateSize,
            w: rotateSize * 2,
            h: rotateSize * 2
          })
        )
      }
    }
    return result
  }

  render(context: CanvasRenderingContext2D): void {
    const state = this.state()
    if (!state) return
    const stroke = colorOf(this.editor, 'selectionStroke')
    context.save()
    context.translate(state.bounds.x, state.bounds.y)
    context.rotate(state.rotation)
    context.strokeStyle = stroke
    context.fillStyle = colorOf(this.editor, 'background')
    context.lineWidth = 1.5 / state.zoom
    if (state.showBox) context.strokeRect(0, 0, state.width, state.height)
    if (state.showResizeHandles) {
      const cornerHandles = state.showOnlyOneHandle
        ? (['top_left'] as const)
        : state.hideAlternateCorners
          ? (['top_left', 'bottom_right'] as const)
          : CORNERS
      for (const handle of cornerHandles) {
        const point = cornerPoint(handle, state.width, state.height)
        context.fillRect(
          point.x - state.handleSize / 2,
          point.y - state.handleSize / 2,
          state.handleSize,
          state.handleSize
        )
        context.strokeRect(
          point.x - state.handleSize / 2,
          point.y - state.handleSize / 2,
          state.handleSize,
          state.handleSize
        )
      }
    }
    context.restore()
  }

  private state(): SelectionForegroundState | null {
    return this.memo.read(this.pass, () => this.computeState())
  }

  private computeState(): SelectionForegroundState | null {
    const bounds = this.editor.getSelectionRotatedPageBounds()
    if (!bounds) return null
    const onlyShape = this.editor.getOnlySelectedShape()
    if (onlyShape && this.editor.isShapeHidden(onlyShape)) return null
    const util = onlyShape ? this.editor.getShapeUtil(onlyShape) : null
    const instance = this.editor.getInstanceState()
    const path = this.editor.getCurrentToolPath()
    const zoom = this.editor.getZoomLevel()
    const handleSize = 8 / zoom
    const isTinyX = bounds.w < handleSize * 2
    const isTinyY = bounds.h < handleSize * 2
    const isSmallX = bounds.w < handleSize * 4
    const isSmallY = bounds.h < handleSize * 4
    const coarse = instance.isCoarsePointer ? 1.75 : 1
    const hitTargetSize = (6 / zoom) * coarse
    const hitX = (isSmallX ? hitTargetSize / 2 : hitTargetSize) * (coarse * 0.75)
    const hitY = (isSmallY ? hitTargetSize / 2 : hitTargetSize) * (coarse * 0.75)
    const controls = CONTROL_PATHS.has(path) && !instance.isChangingStyle && !this.editor.getIsReadonly()
    const locked = Boolean(onlyShape && this.editor.isShapeOrAncestorLocked(onlyShape))
    const showResizeHandles =
      controls &&
      !locked &&
      (!onlyShape || Boolean(util?.canResize(onlyShape as never) && !util.hideResizeHandles(onlyShape as never)))
    const showRotateHandles =
      controls &&
      !locked &&
      !instance.isCoarsePointer &&
      !isTinyX &&
      !isTinyY &&
      (!onlyShape || !util?.hideRotateHandle(onlyShape as never))
    const hideAlternateCorners = isTinyX || isTinyY
    const showOnlyOneHandle = isTinyX && isTinyY
    const hideVerticalEdges = hideAlternateCorners || showOnlyOneHandle || Boolean(instance.isCoarsePointer)
    const mobileText = Boolean(instance.isCoarsePointer && onlyShape?.type === 'text')
    const hideHorizontalEdges = hideVerticalEdges && !mobileText
    const showSelectionBounds = !onlyShape || !util?.hideSelectionBoundsFg(onlyShape as never)
    const showBox =
      showSelectionBounds &&
      !instance.isChangingStyle &&
      (BOX_PATHS.has(path) || (path === 'select.resizing' && onlyShape?.type === 'text'))
    return {
      bounds,
      onlyShape,
      zoom,
      rotation: this.editor.getSelectionRotation(),
      width: bounds.w,
      height: bounds.h,
      handleSize,
      hitX,
      hitY,
      showBox,
      showResizeHandles,
      showRotateHandles,
      hideAlternateCorners,
      showOnlyOneHandle,
      hideVerticalEdges,
      hideHorizontalEdges
    }
  }
}

interface MarkedShapes {
  indicated: TLShape[]
  hinted: TLShape[]
}

class ShapeIndicatorOverlayUtil implements ToolOverlayUtil {
  static type = 'shape_indicator'
  readonly options = { zIndex: 50 }
  private readonly memo = new PaintMemo<MarkedShapes>()
  private readonly paths = new WeakMap<TLShape['props'], Path2D | null>()

  constructor(
    private readonly editor: OverlayEditor,
    private readonly pass: PaintPass
  ) {}

  isActive(): boolean {
    const { indicated, hinted } = this.marked()
    return indicated.length > 0 || hinted.length > 0
  }

  getOverlays(): CanvasOverlay[] {
    const { indicated, hinted } = this.marked()
    if (indicated.length === 0 && hinted.length === 0) return []
    return [
      {
        id: 'shape-indicator',
        type: 'shape_indicator',
        props: { indicated: indicated.map(shape => shape.id), hinted: hinted.map(shape => shape.id) }
      }
    ]
  }

  render(context: CanvasRenderingContext2D): void {
    const { indicated, hinted } = this.marked()
    if (indicated.length === 0 && hinted.length === 0) return
    const zoom = this.editor.getZoomLevel()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = colorOf(this.editor, 'selectionStroke')
    context.lineWidth = INDICATOR_WIDTH / zoom
    this.stroke(context, indicated)
    if (hinted.length === 0) return
    context.lineWidth = HINTED_INDICATOR_WIDTH / zoom
    this.stroke(context, hinted)
  }

  private stroke(context: CanvasRenderingContext2D, shapes: TLShape[]): void {
    const batch = typeof Path2D === 'undefined' ? null : new Path2D()
    let batched = false
    for (const shape of shapes) {
      const transform = this.editor.getShapePageTransform(shape)
      const path = batch ? this.pathOf(shape) : null
      if (batch && path) {
        batch.addPath(path, transform)
        batched = true
        continue
      }
      this.trace(context, shape, transform)
    }
    if (batch && batched) context.stroke(batch)
  }

  private pathOf(shape: TLShape): Path2D | null {
    const cached = this.paths.get(shape.props)
    if (cached !== undefined) return cached
    const path = this.editor.getShapeUtil(shape).getIndicatorPath(shape as never) ?? null
    this.paths.set(shape.props, path)
    return path
  }

  private trace(context: CanvasRenderingContext2D, shape: TLShape, transform: Mat): void {
    const geometry = this.editor.getShapeGeometry(shape)
    const vertices = geometry.vertices
    const count = vertices.length
    if (count < 2) return
    const { a, b, c, d, e, f } = transform
    const first = vertices[0]
    context.beginPath()
    context.moveTo(a * first.x + c * first.y + e, b * first.x + d * first.y + f)
    for (let index = 1; index < count; index++) {
      const vertex = vertices[index]
      context.lineTo(a * vertex.x + c * vertex.y + e, b * vertex.x + d * vertex.y + f)
    }
    if (geometry.isClosed) context.closePath()
    context.stroke()
  }

  private marked(): MarkedShapes {
    return this.memo.read(this.pass, () => this.computeMarked())
  }

  private computeMarked(): MarkedShapes {
    const editor = this.editor
    const path = editor.getCurrentToolPath()
    const instance = editor.getInstanceState()
    const indicated: TLShape[] = []
    const idle = IDLE_INDICATOR_PATHS.has(path)
    if (!instance.isChangingStyle && (idle || SELECTING_INDICATOR_PATHS.has(path))) {
      for (const id of editor.getSelectedShapeIds()) {
        const shape = editor.getShape(id)
        if (shape && !editor.isShapeHidden(shape)) indicated.push(shape)
      }
      if (idle && !instance.isCoarsePointer) {
        const hovered = editor.getHoveredShape()
        if (hovered && !editor.isShapeHidden(hovered) && !indicated.some(shape => shape.id === hovered.id)) {
          indicated.push(hovered)
        }
      }
    }
    const hinted: TLShape[] = []
    for (const id of instance.hintingShapeIds ?? []) {
      const shape = editor.getShape(id)
      if (shape && !editor.isShapeHidden(shape)) hinted.push(shape)
    }
    return { indicated, hinted }
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
    context.fillStyle = colorOf(this.editor, 'background')
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
