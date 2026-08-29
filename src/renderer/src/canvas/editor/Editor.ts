import { Group2d, Rectangle2d, intersectPolygonPolygon, type Geometry2d } from '../geometry'
import { snapshotToSvgResult, svgDataUrl, type ImageExportOptions } from '../export'
import { Box, Mat, Vec, pointInPolygon } from '../math'
import { atom, computed, transact, unsafe__withoutCapture, type Atom, type Computed } from '../signals'
import {
  DocumentRecordType,
  PageRecordType,
  TLDOCUMENT_ID,
  ZERO_INDEX_KEY,
  createShapeId,
  getSnapshot,
  getIndexAbove,
  getIndicesBetween,
  type IndexKey,
  type JsonObject,
  type TLAsset,
  type TLAssetId,
  type TLBinding,
  type TLBindingId,
  type TLPage,
  type TLPageId,
  type TLParentId,
  type TLRecord,
  type TLShape,
  type TLShapeId
} from '../schema'
import { ShapeUtil, type CrewShapePartial, type ShapeResizeInfo } from '../shapes/ShapeUtil'
import { uniqueId } from '../store'
import type { BindingPartial } from './bindingTypes'
import { BindingManager } from './bindings'
import { cloneContent } from './clipboard'
import { CameraManager } from './camera'
import { EdgeScrollManager } from './edgeScroll'
import { EditorEmitter } from './emitter'
import { CanvasEventBridge, type CanvasEventHandlers } from './events'
import { EditorHistory } from './history'
import { getShapeAtPoint, getShapesAtPoint, type HitTestOptions } from './hitTest'
import { InputsManager } from './inputs'
import { OverlayManager } from './overlays'
import { descendantsOf, rootIds, sortedChildren, sortedPageShapes } from './pages'
import { UserPreferencesManager } from './preferences'
import { ScribbleManager, type TLScribble } from './scribbles'
import { SelectionManager } from './selection'
import { registerDefaultSideEffects } from './sideEffects'
import { SnapManager } from './snaps'
import { snappableShapes, type SnappableShape } from './snappable'
import { reorderedShapes, type OrderOperation } from './ordering'
import { sharedOpacity, styleKey } from './styles'
import { FontManager, TextMeasure } from './textMeasure'
import { ThemeManager } from './theme'
import { TickManager } from './ticks'
import { ToolManager } from './tools'
import type { CanvasEventInfo } from '../tools/state/events'
import type {
  SharedStyle,
  TLCameraMoveOptions,
  TLCameraPoint,
  TLColorMode,
  TLEditorOptions,
  TLContent,
  TLPutContentOptions,
  TLResizeShapeOptions,
  TLShapeUpdate,
  TLStyleProp,
  TLTheme,
  VecLike,
  ViewportBounds
} from './types'

type ShapeCreate = CrewShapePartial<TLShape> & {
  parentId?: TLParentId
  index?: IndexKey
  isLocked?: boolean
}

interface EditorInstanceState {
  brush: ViewportBounds | null
  duplicateProps: { shapeIds: TLShapeId[]; offset: { x: number; y: number } } | null
  isGridMode: boolean
  isChangingStyle: boolean
  isCoarsePointer: boolean
  isToolLocked: boolean
  cursor: { type: string; rotation: number }
  isReadonly: boolean
  erasingShapeIds: TLShapeId[]
  hintingShapeIds: TLShapeId[]
  hoveredShapeId: TLShapeId | null
  scribbles: TLScribble[]
}

function sameInstanceValue(one: unknown, two: unknown): boolean {
  if (Object.is(one, two)) return true
  if (!one || !two || typeof one !== 'object' || typeof two !== 'object') return false
  if (Array.isArray(one) !== Array.isArray(two)) return false
  const keys = Object.keys(one)
  if (keys.length !== Object.keys(two).length) return false
  return keys.every(key => Object.is((one as Record<string, unknown>)[key], (two as Record<string, unknown>)[key]))
}

export class Editor {
  readonly id = uniqueId()
  readonly store
  readonly history: EditorHistory
  readonly inputs = new InputsManager()
  readonly overlays: OverlayManager
  readonly sideEffects
  readonly user: UserPreferencesManager
  readonly textMeasure
  readonly fonts = new FontManager()
  readonly hitTestMargin: number
  readonly options
  readonly root: { handleEvent: (info: CanvasEventInfo) => void; getCurrent: () => unknown }
  readonly menus = { clearOpenMenus: () => undefined }
  readonly timers = {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      typeof requestAnimationFrame === 'undefined'
        ? (setTimeout(() => callback(Date.now()), 16) as unknown as number)
        : requestAnimationFrame(callback)
  }
  readonly performance = {
    _notifyInteractionStart: (_id: string, _path: string) => undefined,
    _notifyInteractionEnd: () => undefined
  }
  readonly edgeScrollManager: EdgeScrollManager
  readonly snaps = new SnapManager()
  readonly scribbles: ScribbleManager
  readonly bindings: BindingManager
  private readonly emitter = new EditorEmitter()
  private readonly ticks: TickManager
  private readonly camera: CameraManager
  private readonly selection = new SelectionManager()
  private readonly tools: ToolManager
  private readonly eventBridge: CanvasEventBridge
  private readonly themes: ThemeManager
  private readonly shapeUtils = new Map<TLShape['type'], ShapeUtil>()
  private readonly geometryCache = new Map<TLShapeId, Computed<Geometry2d>>()
  private readonly pageBoundsCache = new Map<TLShapeId, Computed<Box | undefined>>()
  private readonly pageShapesCache = new Map<TLPageId, Computed<TLShape[]>>()
  private readonly pageTransformCache = new Map<TLShapeId, Computed<Mat>>()
  private baseCulledCache: Computed<ReadonlySet<TLShapeId>> | null = null
  private readonly getContainerFn: () => HTMLElement
  private readonly opacityForNextShape = { value: 1 }
  private readonly stylesForNextShape = new Map<string, unknown>()
  private readonly instanceState: Atom<EditorInstanceState> = atom('editor.instanceState', {
    brush: null,
    duplicateProps: null,
    isGridMode: false,
    isChangingStyle: false,
    isCoarsePointer: false,
    isToolLocked: false,
    cursor: { type: 'default', rotation: 0 },
    isReadonly: false,
    erasingShapeIds: [],
    hintingShapeIds: [],
    hoveredShapeId: null,
    scribbles: []
  })
  private currentPageId: TLPageId
  private disposed = false
  private stopSideEffects: () => void = () => undefined
  private toolIdMask: string | undefined
  private culled: ReadonlySet<TLShapeId> = new Set()
  private richTextEditor: {
    commands?: { focus(position?: unknown): unknown }
    isFocused?: boolean
    [key: string]: unknown
  } | null = null
  private arrowTargetId: TLShapeId | null = null
  private hoverLocked = false

  constructor(options: TLEditorOptions) {
    this.store = options.store
    this.sideEffects = options.store.sideEffects
    this.options = {
      hitTestMargin: 8,
      selectLockedShapes: false,
      dragDistanceSquared: 16,
      coarseDragDistanceSquared: 36,
      adjacentShapeMargin: 10,
      animationMediumMs: 180,
      ...options.options,
      camera: { ...options.options?.camera }
    }
    this.hitTestMargin = this.options.hitTestMargin as number
    this.getContainerFn = options.getContainer ?? defaultContainer
    this.ensureStore(options.currentPageId)
    this.currentPageId = this.resolvePageId(options.currentPageId)
    this.history = new EditorHistory(options.store)
    this.camera = new CameraManager({
      zoomMin: options.options?.camera?.zoomMin,
      zoomMax: options.options?.camera?.zoomMax,
      zoomSteps: options.options?.camera?.zoomSteps,
      panSpeed: options.options?.camera?.panSpeed,
      zoomSpeed: options.options?.camera?.zoomSpeed,
      isLocked: options.options?.camera?.isLocked
    })
    this.scribbles = new ScribbleManager(this)
    this.edgeScrollManager = new EdgeScrollManager(this)
    this.bindings = new BindingManager(this, options.bindingUtils)
    this.ticks = new TickManager(elapsed => this.tick(elapsed))
    this.user = new UserPreferencesManager({
      initial: {
        colorScheme: options.colorScheme ?? options.user?.getUserPreferences?.().colorScheme ?? 'light',
        ...options.user?.getUserPreferences?.()
      },
      write: options.user?.setUserPreferences
    })
    this.themes = new ThemeManager(options.themes, options.initialTheme)
    this.overlays = new OverlayManager(this, options.overlayUtils)
    this.textMeasure = options.textMeasure ?? new TextMeasure(this.getContainerFn)
    for (const Constructor of options.shapeUtils ?? []) {
      const type = Constructor.type
      this.shapeUtils.set(type, new Constructor(this as never))
    }
    this.tools = new ToolManager(this, options.tools, options.initialState)
    this.root = { handleEvent: info => this.tools.dispatch(info), getCurrent: () => this.tools.getCurrent() }
    this.eventBridge = new CanvasEventBridge(this)
    this.stopSideEffects = registerDefaultSideEffects(this)
    this.ticks.start()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.ticks.dispose()
    this.stopSideEffects()
    this.emitter.clear()
    this.history.dispose()
    this.fonts.dispose()
    this.user.dispose()
    this.textMeasure.dispose?.()
  }

  on(event: string, handler: (...args: never[]) => void): this {
    this.emitter.on(event, handler)
    return this
  }

  once(event: string, handler: (...args: never[]) => void): this {
    this.emitter.once(event, handler)
    return this
  }

  off(event: string, handler: (...args: never[]) => void): this {
    this.emitter.off(event, handler)
    return this
  }

  emit(event: string, ...args: unknown[]): this {
    this.emitter.emit(event, ...args)
    return this
  }

  tick(elapsed: number): void {
    if (this.disposed) return
    this.camera.tick(elapsed)
    this.scribbles.tick(elapsed)
    this.inputs.updatePointerVelocity(elapsed)
    this.tools.dispatch({ name: 'tick', elapsed })
    this.emitter.emit('tick', elapsed)
  }

  getContainer(): HTMLElement {
    return this.getContainerFn()
  }

  getCamera(): TLCameraPoint {
    return this.camera.getCamera()
  }

  setCamera(point: VecLike, options?: TLCameraMoveOptions): this {
    this.camera.setCamera(point, options)
    this.refreshInputPagePoint()
    return this
  }

  getZoomLevel(): number {
    return this.camera.getCamera().z
  }

  getViewportScreenBounds(): Box {
    return this.camera.getScreenBounds()
  }

  getViewportPageBounds(): Box {
    return this.camera.getViewportPageBounds()
  }

  getCameraState(): 'idle' | 'moving' {
    return this.camera.getState()
  }

  getViewportScreenCenter(): Vec {
    return this.camera.getScreenCenter()
  }

  getViewportPageCenter(): Vec {
    return this.getViewportPageBounds().center
  }

  private get instance(): EditorInstanceState {
    return this.instanceState.get()
  }

  private peekInstance(): EditorInstanceState {
    return this.instanceState.__unsafe__getWithoutCapture()
  }

  private patchInstance(update: Partial<EditorInstanceState>): void {
    const current = this.peekInstance()
    let next: EditorInstanceState | null = null
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) continue
      if (sameInstanceValue((current as unknown as Record<string, unknown>)[key], value)) continue
      next ??= { ...current }
      ;(next as unknown as Record<string, unknown>)[key] = value
    }
    if (next) this.instanceState.set(next)
  }

  getInstanceState(): EditorInstanceState & { devicePixelRatio: number; screenBounds: ViewportBounds } {
    const bounds = this.camera.getScreenBounds()
    return {
      devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      screenBounds: bounds.toJson(),
      ...this.instance
    }
  }

  updateInstanceState(update: Partial<EditorInstanceState> & { screenBounds?: ViewportBounds }): this {
    if (update.screenBounds) this.setViewportScreenBounds(update.screenBounds)
    const { screenBounds, ...rest } = update
    void screenBounds
    this.patchInstance(rest)
    return this
  }

  getCurrentPageState(): {
    selectedShapeIds: TLShapeId[]
    editingShapeId: TLShapeId | null
    focusedGroupId: TLShapeId | null
    hintingShapeIds: TLShapeId[]
    hoveredShapeId: TLShapeId | null
  } {
    const focused = this.getFocusedGroupId()
    return {
      selectedShapeIds: this.getSelectedShapeIds(),
      editingShapeId: this.getEditingShapeId(),
      focusedGroupId: focused.startsWith('shape:') ? (focused as TLShapeId) : null,
      hintingShapeIds: this.instance.hintingShapeIds,
      hoveredShapeId: this.instance.hoveredShapeId
    }
  }

  setViewportScreenBounds(bounds: ViewportBounds): this {
    if (!this.camera.setScreenBounds(bounds)) return this
    this.refreshInputPagePoint()
    return this
  }

  screenToPage(point: VecLike): Vec {
    return this.camera.screenToPage(point)
  }

  pageToScreen(point: VecLike): Vec {
    return this.camera.pageToScreen(point)
  }

  pageToViewport(point: VecLike): Vec {
    return this.camera.pageToViewport(point)
  }

  updatePointer(point: VecLike): this {
    this.inputs.update(point, this.screenToPage(point))
    return this
  }

  zoomIn(point: VecLike = this.getViewportScreenCenter(), options?: TLCameraMoveOptions): this {
    this.camera.zoomIn(point, options)
    this.refreshInputPagePoint()
    return this
  }

  zoomOut(point: VecLike = this.getViewportScreenCenter(), options?: TLCameraMoveOptions): this {
    this.camera.zoomOut(point, options)
    this.refreshInputPagePoint()
    return this
  }

  resetZoom(point: VecLike = this.getViewportScreenCenter(), options?: TLCameraMoveOptions): this {
    this.camera.resetZoom(point, options)
    this.refreshInputPagePoint()
    return this
  }

  zoomToBounds(bounds: Box, options?: { targetZoom?: number; inset?: number } & TLCameraMoveOptions): this {
    this.camera.zoomToBounds(bounds, options)
    this.refreshInputPagePoint()
    return this
  }

  zoomToFit(options?: TLCameraMoveOptions): this {
    const bounds = this.getCurrentPageBounds()
    if (bounds) this.camera.zoomToBounds(bounds, options)
    this.refreshInputPagePoint()
    return this
  }

  zoomToSelection(options?: TLCameraMoveOptions): this {
    const bounds = this.getSelectionPageBounds()
    if (!bounds) return this
    const isAtDefaultZoom = Math.abs(this.getZoomLevel() - 1) < 0.01
    this.camera.zoomToBounds(bounds, isAtDefaultZoom ? options : { targetZoom: 1, ...options })
    this.refreshInputPagePoint()
    return this
  }

  centerOnPoint(point: VecLike, options?: TLCameraMoveOptions): this {
    this.camera.centerOnPoint(point, options)
    this.refreshInputPagePoint()
    return this
  }

  pan(offset: VecLike, options?: TLCameraMoveOptions): this {
    this.camera.pan(offset, options)
    this.refreshInputPagePoint()
    return this
  }

  getCurrentPageId(): TLPageId {
    return this.currentPageId
  }

  setCurrentPage(pageId: TLPageId): this {
    if (this.store.get(pageId)?.typeName !== 'page') return this
    this.currentPageId = pageId
    this.selectNone()
    return this
  }

  getCurrentPage(): TLPage {
    const page = this.store.get(this.currentPageId)
    if (!page || page.typeName !== 'page') throw new Error(`Missing current page ${this.currentPageId}`)
    return page
  }

  getCurrentPageShapes(): TLShape[] {
    const pageIds = new Set(this.getCurrentPageShapesSorted().map(shape => shape.id))
    return this.allShapes().filter(shape => pageIds.has(shape.id))
  }

  getCurrentPageShapeIds(): Set<TLShapeId> {
    return new Set(this.getCurrentPageShapesSorted().map(shape => shape.id))
  }

  getCurrentPageShapesSorted(): TLShape[] {
    let value = this.pageShapesCache.get(this.currentPageId)
    if (!value) {
      const pageId = this.currentPageId
      value = computed(`editor.pageShapes:${pageId}`, () => sortedPageShapes(this.allShapes(), pageId))
      this.pageShapesCache.set(pageId, value)
    }
    return value.get()
  }

  getCurrentPageRenderingShapesSorted(): TLShape[] {
    return this.getCurrentPageShapesSorted().filter(shape => !this.isShapeHidden(shape))
  }

  getRenderingShapes(): Array<{
    id: TLShapeId
    shape: TLShape
    index: number
    backgroundIndex: number
    opacity: number
    isEditing: boolean
  }> {
    const editingShapeId = this.getEditingShapeId()
    const shapes = this.getCurrentPageRenderingShapesSorted()
    return shapes.map((shape, index) => ({
      id: shape.id,
      shape,
      index,
      backgroundIndex: index,
      opacity: shape.opacity,
      isEditing: editingShapeId === shape.id
    }))
  }

  getCulledShapes(): ReadonlySet<TLShapeId> {
    if (this.inputs.getIsPointing()) return this.culled
    this.baseCulledCache ??= computed('editor.baseCulledShapes', () => {
      const viewport = this.getViewportPageBounds()
      this.store.getRevision()
      return unsafe__withoutCapture(() => this.computeBaseCulledShapes(viewport))
    })
    const next = new Set(this.baseCulledCache.get())
    this.getSelectedShapeIds().forEach(id => next.delete(id))
    const editing = this.getEditingShapeId()
    if (editing) next.delete(editing)
    return sameIds(this.culled, next) ? this.culled : (this.culled = next)
  }

  private computeBaseCulledShapes(viewport: Box): ReadonlySet<TLShapeId> {
    const visible = this.getShapeIdsInsideBounds(viewport)
    const result = new Set<TLShapeId>()
    for (const shape of this.getCurrentPageShapesSorted()) {
      if (visible.has(shape.id)) continue
      if (!this.getShapeUtil(shape).canCull(shape as never)) continue
      result.add(shape.id)
    }
    return result
  }

  getSortedChildIdsForParent(parentId: TLParentId): TLShapeId[] {
    return sortedChildren(this.allShapes(), parentId).map(shape => shape.id)
  }

  getShapeAncestors(shapeOrId: TLShape | TLShapeId): TLShape[] {
    const result: TLShape[] = []
    let shape = this.liveShape(shapeOrId)
    while (shape?.parentId.startsWith('shape:')) {
      const parent = this.getShape(shape.parentId as TLShapeId)
      if (!parent) break
      result.push(parent)
      shape = parent
    }
    return result.reverse()
  }

  getShapeParent(shapeOrId: TLShape | TLShapeId): TLShape | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape || !shape.parentId.startsWith('shape:')) return undefined
    return this.getShape(shape.parentId as TLShapeId)
  }

  findShapeAncestor(shapeOrId: TLShape | TLShapeId, predicate: (parent: TLShape) => boolean): TLShape | undefined {
    const parent = this.getShapeParent(shapeOrId)
    if (!parent) return undefined
    return predicate(parent) ? parent : this.findShapeAncestor(parent, predicate)
  }

  hasAncestor(shapeOrId: TLShape | TLShapeId | undefined, ancestorId: TLShapeId): boolean {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return false
    if (shape.parentId === ancestorId) return true
    return this.hasAncestor(this.getShapeParent(shape), ancestorId)
  }

  getAncestorPageId(shapeOrId: TLShape | TLShapeId | undefined): TLPageId | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return undefined
    if (shape.parentId.startsWith('page:')) return shape.parentId as TLPageId
    return this.getAncestorPageId(shape.parentId as TLShapeId)
  }

  findCommonAncestor(
    shapes: readonly (TLShape | TLShapeId)[],
    predicate?: (shape: TLShape) => boolean
  ): TLShapeId | undefined {
    if (shapes.length === 0) return undefined
    const records = shapes
      .map(shape => (typeof shape === 'string' ? this.getShape(shape) : shape))
      .filter((shape): shape is TLShape => shape !== undefined)
    if (records.length === 0) return undefined
    if (records.length === 1) {
      const parentId = records[0].parentId
      if (!parentId.startsWith('shape:')) return undefined
      if (!predicate) return parentId as TLShapeId
      return this.findShapeAncestor(records[0], predicate)?.id
    }
    const [first, ...rest] = records
    let ancestors = this.getShapeAncestors(first)
    for (const shape of rest) {
      if (!ancestors.length) break
      const others = new Set(this.getShapeAncestors(shape).map(ancestor => ancestor.id))
      ancestors = ancestors.filter(ancestor => others.has(ancestor.id))
    }
    const match = [...ancestors].reverse().find(ancestor => !predicate || predicate(ancestor))
    return match?.id
  }

  getShapeNearestSibling(siblingShape: TLShape, targetShape: TLShape | undefined): TLShape | undefined {
    if (!targetShape) return undefined
    if (targetShape.parentId === siblingShape.parentId) return targetShape
    const ancestor = this.getShapeAncestors(targetShape).find(shape => shape.parentId === siblingShape.parentId)
    return ancestor
  }

  getShapeHandles(shapeOrId: TLShape | TLShapeId): ReturnType<NonNullable<ShapeUtil['getHandles']>> | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return undefined
    return this.getShapeUtil(shape).getHandles?.(shape as never)
  }

  getCurrentPageBounds(): Box | null {
    const bounds = this.getCurrentPageShapesSorted()
      .filter(shape => !this.isShapeHidden(shape))
      .map(shape => this.getShapeMaskedPageBounds(shape))
      .filter((value): value is Box => value !== undefined)
    return bounds.length ? Box.Common(bounds) : null
  }

  getShape(id: TLShapeId): TLShape | undefined {
    const record = this.store.get(id)
    return record?.typeName === 'shape' ? record : undefined
  }

  getAsset(id: string): TLAsset | undefined {
    const record = this.store.get(id as TLAssetId)
    return record?.typeName === 'asset' ? record : undefined
  }

  resolveAssetUrl(source: string): string {
    const resolve = this.options.resolveAssetUrl
    return typeof resolve === 'function' ? resolve(source) : source
  }

  getBinding(id: TLBindingId): TLBinding | undefined {
    return this.bindings.get(id)
  }

  getBindingsFromShape(shapeOrId: TLShape | TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.bindings.fromShape(idOf(shapeOrId), type)
  }

  getBindingsToShape(shapeOrId: TLShape | TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.bindings.toShape(idOf(shapeOrId), type)
  }

  getBindingsInvolvingShape(shapeOrId: TLShape | TLShapeId, type?: TLBinding['type']): TLBinding[] {
    return this.bindings.involvingShape(idOf(shapeOrId), type)
  }

  deleteBinding(binding: TLBinding | string, options?: { isolateShapes?: boolean }): this {
    return this.deleteBindings([binding], options)
  }

  deleteBindings(bindings: readonly (TLBinding | string)[], options?: { isolateShapes?: boolean }): this {
    this.bindings.delete(
      bindings.map(binding => (typeof binding === 'string' ? (binding as TLBindingId) : binding.id)),
      options
    )
    return this
  }

  createBinding(partial: BindingPartial): this {
    return this.createBindings([partial])
  }

  createBindings(partials: BindingPartial[]): this {
    this.bindings.create(partials)
    return this
  }

  getShapeUtil(shapeOrType: TLShape | TLShape['type']): ShapeUtil {
    const type = typeof shapeOrType === 'string' ? shapeOrType : shapeOrType.type
    return this.shapeUtils.get(type) ?? new FallbackShapeUtil(this as never)
  }

  getShapeGeometry(shapeOrId: TLShape | TLShapeId): Geometry2d {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return new Rectangle2d({ width: 1, height: 1, isFilled: true })
    let value = this.geometryCache.get(shape.id)
    if (!value) {
      value = computed(`editor.shapeGeometry:${shape.id}`, () => this.computeShapeGeometry(shape.id))
      this.geometryCache.set(shape.id, value)
    }
    return value.get()
  }

  private computeShapeGeometry(shapeId: TLShapeId): Geometry2d {
    const shape = this.getShape(shapeId)
    if (!shape) return new Rectangle2d({ width: 1, height: 1, isFilled: true })
    if (shape.type === 'group') {
      const children = this.getSortedChildIdsForParent(shape.id)
        .map(id => this.getShapePageBounds(id))
        .filter((value): value is Box => value !== undefined)
      if (children.length > 0) {
        const inverse = this.getShapePageTransform(shape).clone().invert()
        const bounds = Box.FromPoints(inverse.applyToPoints(Box.Common(children).corners))
        return new Rectangle2d({ x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h, isFilled: false })
      }
    }
    return this.getShapeUtil(shape).getGeometry(shape as never)
  }

  getShapeLocalTransform(shapeOrId: TLShape | TLShapeId): Mat {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return Mat.Identity()
    return Mat.Translate(shape.x, shape.y).rotate(shape.rotation)
  }

  getShapeParentTransform(shapeOrId: TLShape | TLShapeId): Mat {
    const shape = this.liveShape(shapeOrId)
    if (!shape || shape.parentId.startsWith('page:')) return Mat.Identity()
    return this.getShapePageTransform(shape.parentId as TLShapeId)
  }

  getShapePageTransform(shapeOrId: TLShape | TLShapeId): Mat {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return Mat.Identity()
    let value = this.pageTransformCache.get(shape.id)
    if (!value) {
      value = computed(`editor.shapePageTransform:${shape.id}`, () => {
        const current = this.getShape(shape.id)
        if (!current) return Mat.Identity()
        return Mat.Compose(this.getShapeParentTransform(current), this.getShapeLocalTransform(current))
      })
      this.pageTransformCache.set(shape.id, value)
    }
    return value.get()
  }

  getPointInShapeSpace(shapeOrId: TLShape | TLShapeId, point: VecLike): Vec {
    return this.getShapePageTransform(shapeOrId).clone().invert().applyToPoint(point)
  }

  getShapePageBounds(shapeOrId: TLShape | TLShapeId): Box | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return undefined
    let value = this.pageBoundsCache.get(shape.id)
    if (!value) {
      value = computed(`editor.shapePageBounds:${shape.id}`, () => {
        const current = this.getShape(shape.id)
        if (!current) return undefined
        const geometry = this.getShapeGeometry(current)
        return Box.FromPoints(this.getShapePageTransform(current).applyToPoints(geometry.boundsVertices))
      })
      this.pageBoundsCache.set(shape.id, value)
    }
    return value.get()
  }

  getSelectionPageBounds(): Box | null {
    const bounds = this.getSelectedShapes()
      .map(shape => this.getShapePageBounds(shape))
      .filter((value): value is Box => value !== undefined)
    return bounds.length ? Box.Common(bounds) : null
  }

  getOnlySelectedShape(): TLShape | null {
    const shapes = this.getSelectedShapes()
    return shapes.length === 1 ? shapes[0] : null
  }

  getOnlySelectedShapeId(): TLShapeId | null {
    return this.getOnlySelectedShape()?.id ?? null
  }

  getSelectionRotation(): number {
    const ids = this.getSelectedShapeIds()
    if (ids.length === 0) return 0
    const rotation = this.getShapePageTransform(ids[0]).rotation()
    return ids.every(id => this.getShapePageTransform(id).rotation() === rotation) ? rotation : 0
  }

  getSelectionRotatedPageBounds(): Box | undefined {
    const ids = this.getSelectedShapeIds()
    if (ids.length === 0) return undefined
    const rotation = this.getSelectionRotation()
    if (rotation === 0) return this.getSelectionPageBounds() ?? undefined
    if (ids.length === 1) {
      const bounds = this.getShapeGeometry(ids[0]).bounds.clone()
      bounds.point = this.getShapePageTransform(ids[0]).applyToPoint(bounds.point)
      return bounds
    }
    const points = ids
      .flatMap(id => this.getShapePageTransform(id).applyToPoints(this.getShapeGeometry(id).bounds.corners))
      .map(point => point.rot(-rotation))
    const bounds = Box.FromPoints(points)
    bounds.point = bounds.point.rot(rotation)
    return bounds
  }

  getFocusedGroupId(): TLShapeId | TLPageId {
    return this.selection.getFocusedGroupId(this.currentPageId)
  }

  setFocusedGroup(shape: TLShape | TLShapeId | null): this {
    const id = typeof shape === 'string' ? shape : (shape?.id ?? null)
    const record = id ? this.getShape(id) : undefined
    this.selection.setFocusedGroupId(record?.type === 'group' ? record.id : null)
    return this
  }

  getSelectedShapeIds(): TLShapeId[] {
    return this.selection.getSelectedShapeIds()
  }

  getSelectedShapes(): TLShape[] {
    return this.getSelectedShapeIds()
      .map(id => this.getShape(id)!)
      .filter(Boolean)
  }

  setSelectedShapes(shapes: readonly (TLShape | TLShapeId)[]): this {
    const ids = shapes
      .map(shape => (typeof shape === 'string' ? shape : shape.id))
      .filter(id => this.getShape(id) !== undefined)
    this.commitSelection(rootIds(this.allShapes(), ids))
    return this
  }

  select(...shapes: Array<TLShape | TLShapeId>): this {
    return this.setSelectedShapes(shapes)
  }

  selectNone(): this {
    this.commitSelection([])
    return this
  }

  selectAll(): this {
    return this.setSelectedShapes(sortedChildren(this.allShapes(), this.currentPageId).filter(shape => !shape.isLocked))
  }

  getEditingShapeId(): TLShapeId | null {
    return this.selection.getEditingShapeId()
  }

  setEditingShape(shapeOrId: TLShape | TLShapeId | null): this {
    const id = typeof shapeOrId === 'string' ? shapeOrId : (shapeOrId?.id ?? null)
    this.selection.setEditingShapeId(id && this.getShape(id) ? id : null)
    return this
  }

  setHintingShapes(ids: TLShapeId[]): this {
    this.patchInstance({ hintingShapeIds: ids.filter(id => this.getShape(id) !== undefined) })
    return this
  }

  getErasingShapeIds(): TLShapeId[] {
    return this.instance.erasingShapeIds
  }

  setErasingShapes(ids: TLShapeId[]): this {
    this.patchInstance({ erasingShapeIds: ids.filter(id => this.getShape(id) !== undefined) })
    return this
  }

  getEditingShape(): TLShape | undefined {
    const id = this.getEditingShapeId()
    return id ? this.getShape(id) : undefined
  }

  setRichTextEditor(editor: typeof this.richTextEditor): this {
    this.richTextEditor = editor
    return this
  }

  getRichTextEditor(): typeof this.richTextEditor {
    return this.richTextEditor
  }

  isTextInputFocused(): boolean {
    if (this.richTextEditor?.isFocused) return true
    if (typeof document === 'undefined') return false
    const active = document.activeElement
    return active instanceof HTMLElement && Boolean(active.closest('input, textarea, [contenteditable="true"]'))
  }

  setCursor(cursor: { type: string; rotation: number }): this {
    this.patchInstance({ cursor })
    return this
  }

  canEditShape(shapeOrId: TLShape | TLShapeId | undefined): boolean {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return false
    const util = this.getShapeUtil(shape)
    if (shape.isLocked && !util.canEditWhileLocked(shape as never)) return false
    return util.canEdit(shape as never)
  }

  canCropShape(shapeOrId: TLShape | TLShapeId | null | undefined): boolean {
    const shape = this.liveShape(shapeOrId)
    return Boolean(shape && this.getShapeUtil(shape).canCrop(shape as never))
  }

  getOutermostSelectableShape(shape: TLShape | TLShapeId, filter?: (shape: TLShape) => boolean): TLShape {
    const start = typeof shape === 'string' ? this.getShape(shape) : shape
    if (!start) return shape as TLShape
    const focusedGroupId = this.getFocusedGroupId()
    const focusedGroup = focusedGroupId.startsWith('shape:') ? this.getShape(focusedGroupId as TLShapeId) : undefined
    let match = start
    let node: TLShape | undefined = start
    while (node) {
      if (
        this.isShapeOfType(node, 'group') &&
        focusedGroup?.id !== node.id &&
        !this.hasAncestor(focusedGroup, node.id) &&
        (filter?.(node) ?? true)
      ) {
        match = node
      } else if (focusedGroup?.id === node.id) {
        break
      }
      node = this.getShapeParent(node)
    }
    return match
  }

  isShapeOrAncestorLocked(shapeOrId: TLShape | TLShapeId): boolean {
    let shape = this.liveShape(shapeOrId)
    while (shape) {
      if (shape.isLocked) return true
      shape = shape.parentId.startsWith('shape:') ? this.getShape(shape.parentId as TLShapeId) : undefined
    }
    return false
  }

  getIsReadonly(): boolean {
    return this.instance.isReadonly
  }

  focus(): this {
    this.getContainer().focus?.()
    return this
  }

  deselect(...shapes: Array<TLShape | TLShapeId>): this {
    const removing = new Set(shapes.map(shape => (typeof shape === 'string' ? shape : shape.id)))
    this.commitSelection(this.getSelectedShapeIds().filter(id => !removing.has(id)))
    return this
  }

  cancelDoubleClick(): void {}

  getSelectedShapeAtPoint(point: VecLike): TLShape | undefined {
    const selected = this.getSelectedShapeIds()
    return this.getCurrentPageShapesSorted()
      .filter(shape => shape.type !== 'group' && selected.includes(shape.id))
      .reverse()
      .find(shape => this.isPointInShape(shape, point, { hitInside: true, margin: 0 }))
  }

  getHoveredShapeId(): TLShapeId | null {
    return this.instance.hoveredShapeId
  }

  getHoveredShape(): TLShape | undefined {
    const id = this.getHoveredShapeId()
    return id ? this.getShape(id) : undefined
  }

  setHoveredShape(shapeOrId: TLShape | TLShapeId | null): this {
    const id = typeof shapeOrId === 'string' ? shapeOrId : (shapeOrId?.id ?? null)
    this.patchInstance({ hoveredShapeId: id && this.getShape(id) ? id : null })
    return this
  }

  updateHoveredOverlayId(): boolean {
    const overlay = this.overlays.getOverlayAtPoint(this.inputs.getCurrentPagePoint())
    this.overlays.setHoveredOverlay(overlay?.id ?? null)
    return Boolean(overlay)
  }

  updateHoveredShapeId(): void {
    if (this.getCameraState() !== 'moving') {
      this.hoverLocked = false
      this.setHoveredShape(this.shapeToHover())
      return
    }
    if (this.hoverLocked) return
    const current = this.getHoveredShapeId()
    if (!current) {
      this.hoverLocked = true
      return
    }
    if (this.shapeToHover() === current) return
    this.setHoveredShape(null)
    this.hoverLocked = true
  }

  private shapeToHover(): TLShapeId | null {
    const hit = this.getShapeAtPoint(this.inputs.getCurrentPagePoint(), {
      hitInside: false,
      hitLabels: false,
      hitLocked: this.options.selectLockedShapes as boolean,
      margin: this.hitTestMargin / this.getZoomLevel(),
      renderingOnly: true
    })
    if (!hit) return null
    const outermost = this.getOutermostSelectableShape(hit)
    if (outermost === hit) return hit.id
    if (outermost.id === this.getFocusedGroupId() || this.getSelectedShapeIds().includes(outermost.id)) return hit.id
    return outermost.id
  }

  cancelUpdateHoveredShapeId(): void {
    this.hoverLocked = false
  }

  createShape<_Shape extends TLShape = TLShape>(partial: ShapeCreate): this {
    return this.createShapes([partial])
  }

  createShapes(partials: ShapeCreate[]): this {
    const records: TLShape[] = []
    const pendingSiblings = new Map<TLParentId, IndexKey>()
    for (const partial of partials) {
      const id = partial.id ?? createShapeId()
      const parentId = partial.parentId ?? this.currentPageId
      const util = this.getShapeUtil(partial.type)
      const defaults = util.getDefaultProps() as Record<string, unknown>
      const styles = this.stylesForProps(defaults)
      const siblings = sortedChildren([...this.allShapes(), ...records], parentId)
      const previousIndex = pendingSiblings.get(parentId) ?? siblings.at(-1)?.index
      const index = partial.index ?? getIndexAbove(previousIndex)
      pendingSiblings.set(parentId, index)
      records.push({
        id,
        typeName: 'shape',
        type: partial.type,
        x: finite(partial.x, 0),
        y: finite(partial.y, 0),
        rotation: finite(partial.rotation, 0),
        index,
        parentId,
        isLocked: partial.isLocked ?? false,
        opacity: clamp(partial.opacity ?? this.opacityForNextShape.value, 0, 1),
        props: { ...defaults, ...styles, ...(partial.props ?? {}) },
        meta: { ...(partial.meta ?? {}) } as JsonObject
      } as TLShape)
    }
    this.store.put(records)
    return this
  }

  updateShape<_Shape extends TLShape = TLShape>(partial: TLShapeUpdate): this {
    return this.updateShapes([partial])
  }

  updateShapes(partials: TLShapeUpdate[]): this {
    const records: TLShape[] = []
    for (const partial of partials) {
      const shape = this.getShape(partial.id)
      if (!shape || shape.type !== partial.type) continue
      let next = {
        ...shape,
        ...withoutUndefined(partial),
        props: partial.props ? { ...shape.props, ...partial.props } : shape.props,
        meta: partial.meta ? { ...shape.meta, ...partial.meta } : shape.meta,
        id: shape.id,
        type: shape.type,
        typeName: 'shape'
      } as TLShape
      next = this.getShapeUtil(shape).onBeforeUpdate?.(shape as never, next as never) ?? next
      records.push(next)
    }
    if (records.length) this.store.put(records)
    return this
  }

  deleteShapes(shapes: readonly (TLShape | TLShapeId)[]): this {
    const requested = shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    const ids = descendantsOf(
      this.allShapes(),
      requested.filter(id => this.getShape(id))
    )
    const deleting = new Set(ids)
    this.store.remove(ids)
    this.commitSelection(this.getSelectedShapeIds().filter(id => !deleting.has(id)))
    return this
  }

  duplicateShapes(shapes: readonly (TLShape | TLShapeId)[], offset: VecLike = { x: 16, y: 16 }): this {
    const ids = shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    const content = this.getContentFromCurrentPage(ids)
    if (!content) return this
    const clone = cloneContent(content)
    const roots = new Set(clone.rootShapeIds)
    for (const shape of clone.shapes) {
      if (roots.has(shape.id)) {
        shape.x += offset.x
        shape.y += offset.y
        shape.index = getIndexAbove(
          sortedChildren([...this.allShapes(), ...clone.shapes], shape.parentId).at(-1)?.index
        )
      }
    }
    this.store.put([...clone.assets.filter(asset => !this.store.has(asset.id)), ...clone.shapes, ...clone.bindings])
    this.setSelectedShapes(clone.rootShapeIds)
    return this
  }

  reparentShapes(shapes: readonly (TLShape | TLShapeId)[], parentId: TLParentId, insertIndex?: IndexKey): this {
    if (!parentId.startsWith('page:') && !this.getShape(parentId as TLShapeId)) return this
    const ids = rootIds(
      this.allShapes(),
      shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    )
    const parentTransform = parentId.startsWith('shape:')
      ? this.getShapePageTransform(parentId as TLShapeId)
      : Mat.Identity()
    const inverseParent = parentTransform.clone().invert()
    const moving = ids.map(id => this.getShape(id)).filter((shape): shape is TLShape => Boolean(shape))
    let indices = insertIndex
      ? getIndicesBetween(insertIndex, nextSiblingIndex(this.allShapes(), parentId, insertIndex), moving.length)
      : getIndicesBetween(sortedChildren(this.allShapes(), parentId).at(-1)?.index, null, moving.length)
    if (indices.length !== moving.length) indices = getIndicesBetween(null, null, moving.length)
    const updates = moving.map((shape, at) => {
      const local = Mat.Compose(inverseParent, this.getShapePageTransform(shape)).decompose()
      return {
        id: shape.id,
        type: shape.type,
        parentId,
        index: indices[at],
        x: local.x,
        y: local.y,
        rotation: local.rotation
      } as TLShapeUpdate
    })
    return this.updateShapes(updates)
  }

  groupShapes(shapes: readonly (TLShape | TLShapeId)[], groupId = createShapeId()): this {
    const ids = rootIds(
      this.allShapes(),
      shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    )
    const moving = ids.map(id => this.getShape(id)).filter((shape): shape is TLShape => Boolean(shape))
    if (moving.length < 1) return this
    const parentId = commonParent(moving) ?? this.currentPageId
    const pageBounds = moving
      .map(shape => this.getShapePageBounds(shape))
      .filter((value): value is Box => Boolean(value))
    if (pageBounds.length === 0) return this
    const parentTransform = parentId.startsWith('shape:')
      ? this.getShapePageTransform(parentId as TLShapeId)
      : Mat.Identity()
    const point = parentTransform.clone().invert().applyToPoint(Box.Common(pageBounds).point)
    const lowest = moving.map(shape => shape.index).sort()[0]
    this.createShape({ id: groupId, type: 'group', parentId, index: lowest, x: point.x, y: point.y, props: {} })
    this.reparentShapes(moving, groupId)
    this.setSelectedShapes([groupId])
    return this
  }

  ungroupShapes(groups: readonly (TLShape | TLShapeId)[]): this {
    const selected: TLShapeId[] = []
    for (const input of groups) {
      const group = typeof input === 'string' ? this.getShape(input) : input
      if (!group || group.type !== 'group') continue
      const children = this.getSortedChildIdsForParent(group.id)
      this.reparentShapes(children, group.parentId, group.index)
      selected.push(...children)
      this.store.remove([group.id])
    }
    this.setSelectedShapes(selected)
    return this
  }

  bringForward(shapes: readonly (TLShape | TLShapeId)[]): this {
    return this.reorder(shapes, 'forward')
  }

  bringToFront(shapes: readonly (TLShape | TLShapeId)[]): this {
    return this.reorder(shapes, 'front')
  }

  sendBackward(shapes: readonly (TLShape | TLShapeId)[]): this {
    return this.reorder(shapes, 'backward')
  }

  sendToBack(shapes: readonly (TLShape | TLShapeId)[]): this {
    return this.reorder(shapes, 'back')
  }

  nudgeShapes(shapes: readonly (TLShape | TLShapeId)[], offset: VecLike): this {
    const updates: TLShapeUpdate[] = []
    for (const input of shapes) {
      const shape = typeof input === 'string' ? this.getShape(input) : input
      if (!shape || shape.isLocked) continue
      const parent = this.getShapeParentTransform(shape)
      const localOffset = linearInverse(parent, offset)
      updates.push({ id: shape.id, type: shape.type, x: shape.x + localOffset.x, y: shape.y + localOffset.y })
    }
    return this.updateShapes(updates)
  }

  rotateShapesBy(shapes: readonly (TLShape | TLShapeId)[], delta: number): this {
    const ids = rootIds(
      this.allShapes(),
      shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    )
    const moving = ids
      .map(id => this.getShape(id))
      .filter((shape): shape is TLShape => shape !== undefined && !shape.isLocked)
    const bounds = moving.map(shape => this.getShapePageBounds(shape)).filter((value): value is Box => Boolean(value))
    if (bounds.length === 0) return this
    const center = Box.Common(bounds).center
    const updates = moving.map(shape => {
      const pageOrigin = this.getShapePageTransform(shape).point()
      const rotated = Vec.RotWith(pageOrigin, center, delta)
      const local = this.getShapeParentTransform(shape).invert().applyToPoint(rotated)
      return {
        id: shape.id,
        type: shape.type,
        x: local.x,
        y: local.y,
        rotation: shape.rotation + delta
      } as TLShapeUpdate
    })
    return this.updateShapes(updates)
  }

  resizeShape(shapeOrId: TLShape | TLShapeId, scale: VecLike, options: TLResizeShapeOptions = {}): this {
    const shape = options.initialShape ?? this.liveShape(shapeOrId)
    if (!shape || shape.isLocked) return this
    const util = this.getShapeUtil(shape)
    if (!util.canResize(shape as never)) return this
    const initialBounds = options.initialBounds ?? this.getShapeGeometry(shape).bounds
    const pageTransform = this.getShapePageTransform(shape)
    const scaleOrigin = options.scaleOrigin ?? this.getShapePageBounds(shape)?.center
    if (!scaleOrigin) return this
    const pageOrigin = pageTransform.point()
    const scaledPageOrigin = new Vec(
      scaleOrigin.x + (pageOrigin.x - scaleOrigin.x) * scale.x,
      scaleOrigin.y + (pageOrigin.y - scaleOrigin.y) * scale.y
    )
    const localOrigin = this.getShapeParentTransform(shape).invert().applyToPoint(scaledPageOrigin)
    if (util.onResize) {
      const info: ShapeResizeInfo<TLShape> = {
        newPoint: localOrigin,
        handle: (options.dragHandle ?? 'bottom_right') as ShapeResizeInfo<TLShape>['handle'],
        mode: options.mode ?? 'resize_bounds',
        scaleX: finite(scale.x, 1),
        scaleY: finite(scale.y, 1),
        initialBounds,
        initialShape: shape
      }
      const next = util.onResize(shape as never, info as never) as TLShape
      this.store.put([next])
      return this
    }
    const props = shape.props as Record<string, unknown>
    const nextProps = { ...props }
    if (typeof props.w === 'number') nextProps.w = Math.max(1, Math.abs(props.w * scale.x))
    if (typeof props.h === 'number') nextProps.h = Math.max(1, Math.abs(props.h * scale.y))
    if ('flipX' in props && scale.x < 0) nextProps.flipX = !props.flipX
    if ('flipY' in props && scale.y < 0) nextProps.flipY = !props.flipY
    return this.updateShape({ id: shape.id, type: shape.type, x: localOrigin.x, y: localOrigin.y, props: nextProps })
  }

  flipShapes(shapes: readonly (TLShape | TLShapeId)[], operation: 'horizontal' | 'vertical'): this {
    const ids = rootIds(
      this.allShapes(),
      shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    )
    const bounds = ids.map(id => this.getShapePageBounds(id)).filter((value): value is Box => Boolean(value))
    if (bounds.length === 0) return this
    const center = Box.Common(bounds).center
    const scale = operation === 'horizontal' ? { x: -1, y: 1 } : { x: 1, y: -1 }
    for (const id of ids) this.resizeShape(id, scale, { scaleOrigin: center })
    return this
  }

  alignShapes(
    shapes: readonly (TLShape | TLShapeId)[],
    operation: 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom'
  ): this {
    const moving = shapes
      .map(input => (typeof input === 'string' ? this.getShape(input) : input))
      .filter((shape): shape is TLShape => Boolean(shape))
    const bounds = moving.map(shape => this.getShapePageBounds(shape)).filter((value): value is Box => Boolean(value))
    if (bounds.length < 2) return this
    const common = Box.Common(bounds)
    moving.forEach((shape, index) => {
      const box = bounds[index]
      const offset = alignOffset(box, common, operation)
      this.nudgeShapes([shape], offset)
    })
    return this
  }

  toggleLock(shapes: readonly (TLShape | TLShapeId)[]): this {
    const updates = shapes
      .map(input => {
        const shape = typeof input === 'string' ? this.getShape(input) : input
        return shape ? ({ id: shape.id, type: shape.type, isLocked: !shape.isLocked } as TLShapeUpdate) : null
      })
      .filter((value): value is TLShapeUpdate => value !== null)
    return this.updateShapes(updates)
  }

  getContentFromCurrentPage(shapes: readonly (TLShape | TLShapeId)[]): TLContent | null {
    const requested = shapes
      .map(shape => (typeof shape === 'string' ? shape : shape.id))
      .filter(id => this.getShape(id))
    const roots = rootIds(this.allShapes(), requested)
    if (roots.length === 0) return null
    const allIds = descendantsOf(this.allShapes(), roots)
    const ids = new Set(allIds)
    const copiedShapes = this.getCurrentPageShapesSorted()
      .filter(shape => ids.has(shape.id))
      .map(shape => structuredClone(shape))
    const bindings = this.store
      .query('binding')
      .get()
      .filter(binding => ids.has(binding.fromId) && ids.has(binding.toId))
      .map(binding => structuredClone(binding))
    const assetIds = new Set(
      copiedShapes
        .map(shape => (shape.props as { assetId?: unknown }).assetId)
        .filter((id): id is string => typeof id === 'string')
    )
    const assets = this.store
      .query('asset')
      .get()
      .filter(asset => assetIds.has(asset.id))
      .map(asset => structuredClone(asset))
    return { shapes: copiedShapes, bindings, rootShapeIds: roots, assets, schema: this.store.schema.serialize() }
  }

  async getSvgString(
    shapes: readonly (TLShape | TLShapeId)[],
    options: ImageExportOptions = {}
  ): Promise<{ svg: string; width: number; height: number } | undefined> {
    const shapeIds = shapes
      .map(shape => (typeof shape === 'string' ? shape : shape.id))
      .filter(id => this.getShape(id) !== undefined)
    if (shapeIds.length === 0) return undefined
    const result = snapshotToSvgResult(getSnapshot(this.store).document, {
      shapeIds,
      pageId: this.currentPageId,
      bounds: options.bounds,
      padding: options.padding === 'auto' ? undefined : options.padding,
      scale: options.scale,
      background: options.background,
      darkMode: options.darkMode ?? this.getColorMode() === 'dark',
      preserveAspectRatio: options.preserveAspectRatio
      ,resolveAssetUrl: options.resolveAssetUrl ?? (source => this.resolveAssetUrl(source))
    })
    if (!result) return undefined
    return { svg: result.svg, width: result.width, height: result.height }
  }

  async toImage(
    shapes: readonly (TLShape | TLShapeId)[],
    options: ImageExportOptions = {}
  ): Promise<{ blob: Blob; width: number; height: number }> {
    const format = options.format ?? 'png'
    const result = await this.getSvgString(shapes, options)
    if (!result) throw new Error('Could not create SVG')
    if (format === 'svg') {
      return {
        blob: new Blob([result.svg], { type: 'image/svg+xml' }),
        width: result.width,
        height: result.height
      }
    }
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      throw new Error('Raster image export requires a browser')
    }
    const pixelRatio = positiveNumber(options.pixelRatio, 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(result.width * pixelRatio))
    canvas.height = Math.max(1, Math.floor(result.height * pixelRatio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create image canvas')
    const image = await loadImage(svgDataUrl(result.svg))
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasBlob(canvas, `image/${format}`, options.quality)
    return { blob, width: result.width, height: result.height }
  }

  putContentOntoCurrentPage(content: TLContent, options: TLPutContentOptions = {}): this {
    const clone = cloneContent(content, options.preserveIds)
    const roots = new Set(clone.rootShapeIds)
    const rootShapes = clone.shapes.filter(shape => roots.has(shape.id))
    const oldBounds = rootShapes
      .map(shape => boundsFromShapeRecord(shape))
      .filter((value): value is Box => Boolean(value))
    const center = oldBounds.length ? Box.Common(oldBounds).center : new Vec()
    const point = options.point ?? this.getViewportPageBounds().center
    for (const shape of clone.shapes) {
      if (roots.has(shape.id)) {
        shape.parentId = this.currentPageId
        shape.x += point.x - center.x
        shape.y += point.y - center.y
        shape.index = getIndexAbove(
          sortedChildren([...this.allShapes(), ...clone.shapes], this.currentPageId).at(-1)?.index
        )
      }
    }
    const records: TLRecord[] = [
      ...clone.assets.filter(asset => !this.store.has(asset.id)),
      ...clone.shapes.filter(shape => !this.store.has(shape.id)),
      ...clone.bindings.filter(binding => !this.store.has(binding.id))
    ]
    this.store.put(records)
    if (options.select !== false) this.setSelectedShapes(clone.rootShapeIds)
    return this
  }

  getSharedOpacity(): SharedStyle<number> {
    return sharedOpacity(this.opacityTargets(this.getSelectedShapes()), this.opacityForNextShape.value)
  }

  setOpacityForNextShapes(opacity: number): this {
    this.opacityForNextShape.value = clamp(opacity, 0, 1)
    return this
  }

  setOpacityForSelectedShapes(opacity: number): this {
    const value = clamp(opacity, 0, 1)
    return this.updateShapes(
      this.opacityTargets(this.getSelectedShapes()).map(shape => ({ id: shape.id, type: shape.type, opacity: value }))
    )
  }

  setStyleForNextShapes<T>(style: TLStyleProp<T> | string, value: T): this {
    this.stylesForNextShape.set(styleKey(style), value)
    return this
  }

  setStyleForSelectedShapes<T>(style: TLStyleProp<T> | string, value: T): this {
    const key = styleKey(style)
    return this.updateShapes(
      this.getSelectedShapes()
        .filter(shape => key in shape.props)
        .map(shape => ({ id: shape.id, type: shape.type, props: { [key]: value } }))
    )
  }

  getColorMode(): TLColorMode {
    return this.user.getColorMode()
  }

  getCurrentTheme(): TLTheme {
    return this.themes.getCurrentTheme()
  }

  getCurrentThemeId(): string {
    return this.themes.getCurrentThemeId()
  }

  setCurrentTheme(id: string): this {
    this.themes.setCurrentTheme(id)
    return this
  }

  getCurrentToolId(): string {
    return this.toolIdMask ?? this.tools.getCurrentToolId()
  }

  getCurrentToolPath(): string {
    return this.tools?.getCurrentToolPath() ?? 'select.idle'
  }

  setCurrentToolIdMask(id: string | undefined): this {
    this.toolIdMask = id
    return this
  }

  cancel(): this {
    return this.dispatch({ name: 'cancel' })
  }

  complete(): this {
    return this.dispatch({ name: 'complete' })
  }

  interrupt(): this {
    return this.dispatch({ name: 'interrupt' })
  }

  setCurrentTool(id: string, info?: unknown): this {
    this.tools.setCurrentTool(id, info)
    return this
  }

  dispatch(info: CanvasEventInfo): this {
    this.inputs.updateFromEvent(info, {
      camera: this.getCamera(),
      screenBounds: this.getViewportScreenBounds(),
      dragDistanceSquared: (this.peekInstance().isCoarsePointer
        ? this.options.coarseDragDistanceSquared
        : this.options.dragDistanceSquared) as number
    })
    this.tools.dispatch(info)
    return this
  }

  getCanvasEventHandlers(): CanvasEventHandlers {
    return this.eventBridge.getHandlers()
  }

  markHistoryStoppingPoint(name?: string): string {
    return this.history.markHistoryStoppingPoint(name)
  }

  getCanUndo(): boolean {
    return this.history.getNumUndos() > 0
  }

  getCanRedo(): boolean {
    return this.history.getNumRedos() > 0
  }

  bail(): this {
    this.history.bail()
    this.cleanSelection()
    return this
  }

  bailToMark(id: string): this {
    this.history.bailToMark(id)
    this.cleanSelection()
    return this
  }

  squashToMark(id: string): this {
    this.history.squashToMark(id)
    return this
  }

  undo(): this {
    this.history.undo()
    this.cleanSelection()
    return this
  }

  redo(): this {
    this.history.redo()
    this.cleanSelection()
    return this
  }

  run(fn: () => void, options?: { history?: 'ignore' | 'record' }): this {
    if (options?.history === 'ignore') this.history.ignore(() => this.store.atomic(fn))
    else this.store.atomic(fn)
    return this
  }

  getShapeAtPoint(point: VecLike, options?: HitTestOptions): TLShape | undefined {
    return getShapeAtPoint(this, Vec.From(point), options)
  }

  getShapesAtPoint(point: VecLike, options?: HitTestOptions): TLShape[] {
    return getShapesAtPoint(this, Vec.From(point), options)
  }

  getShapeMask(shapeOrId: TLShape | TLShapeId): Vec[] | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape || shape.parentId.startsWith('page:')) return undefined
    const clipPaths: Vec[][] = []
    for (const ancestor of this.getShapeAncestors(shape)) {
      const util = this.getShapeUtil(ancestor)
      const clip = util.getClipPath?.(ancestor as never)
      if (!clip) continue
      clipPaths.push(this.getShapePageTransform(ancestor).applyToPoints(clip))
    }
    if (clipPaths.length === 0) return undefined
    return clipPaths.reduce((accumulated, next) => {
      const intersection = intersectPolygonPolygon(accumulated, next)
      return intersection ? intersection.map(point => Vec.From(point)) : []
    })
  }

  getShapeClipPath(shapeOrId: TLShape | TLShapeId): string | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return undefined
    const mask = this.getShapeMask(shape)
    if (!mask) return undefined
    if (mask.length === 0) return 'polygon(0px 0px, 0px 0px, 0px 0px)'
    const local = this.getShapePageTransform(shape).clone().invert().applyToPoints(mask)
    return `polygon(${local.map(point => `${point.x}px ${point.y}px`).join(',')})`
  }

  getShapeMaskedPageBounds(shapeOrId: TLShape | TLShapeId): Box | undefined {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return undefined
    const bounds = this.getShapePageBounds(shape)
    if (!bounds) return undefined
    const mask = this.getShapeMask(shape)
    if (!mask) return bounds
    if (mask.length === 0) return undefined
    const intersection = intersectPolygonPolygon(mask, bounds.corners)
    return intersection ? Box.FromPoints(intersection.map(point => Vec.From(point))) : undefined
  }

  getShapeText(shape: TLShape): string | undefined {
    return this.getShapeUtil(shape).getText?.(shape as never)
  }

  isShapeFrameLike(shape: TLShape): boolean {
    return this.getShapeUtil(shape).isFrameLike(shape as never)
  }

  isShapeHidden(shapeOrId: TLShape | TLShapeId): boolean {
    let shape = this.liveShape(shapeOrId)
    while (shape) {
      if (shape.meta.hidden === true) return true
      shape = shape.parentId.startsWith('shape:') ? this.getShape(shape.parentId as TLShapeId) : undefined
    }
    return false
  }

  isShapeOfType<Type extends TLShape['type']>(shape: TLShape, type: Type): shape is Extract<TLShape, { type: Type }> {
    return shape.type === type
  }

  candidatesAtPoint(_point: Vec, _margin: number): Set<TLShapeId> | null {
    return null
  }

  isPointInShape(
    shapeOrId: TLShape | TLShapeId,
    point: VecLike,
    options: { margin?: number; hitInside?: boolean } = {}
  ): boolean {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return false
    const mask = this.getShapeMask(shape)
    if (mask && !pointInPolygon(point, mask)) return false
    return this.getShapeGeometry(shape).hitTestPoint(
      this.getPointInShapeSpace(shape, point),
      options.margin ?? 0,
      options.hitInside ?? false
    )
  }

  isPointInShapeLabel(shapeOrId: TLShape | TLShapeId, point: VecLike): boolean {
    const shape = this.liveShape(shapeOrId)
    if (!shape) return false
    const geometry = this.getShapeGeometry(shape)
    if (!(geometry instanceof Group2d)) return false
    const inShape = this.getPointInShapeSpace(shape, point)
    return geometry.children.some(child => child.isLabel && child.isPointInBounds(inShape))
  }

  isOverArrowLabel(shapeOrId: TLShape | TLShapeId | undefined): boolean {
    const shape = this.liveShape(shapeOrId)
    if (!shape || shape.type !== 'arrow') return false
    if (!this.getShapeText(shape)?.trim()) return false
    return this.isPointInShapeLabel(shape, this.inputs.getCurrentPagePoint())
  }

  getShapeIdsInsideBounds(bounds: Box): Set<TLShapeId> {
    return new Set(
      this.getCurrentPageShapesSorted()
        .filter(shape => {
          const shapeBounds = this.getShapePageBounds(shape)
          return shapeBounds ? bounds.collides(shapeBounds) : false
        })
        .map(shape => shape.id)
    )
  }

  getSnappableShapes(): SnappableShape[] {
    return snappableShapes(this)
  }

  getShapeStrokeWidth(_shape: TLShape): number {
    return this.getCurrentTheme().strokeWidth ?? 2
  }

  getIsSnapMode(): boolean {
    return this.user.getUserPreferences().isSnapMode
  }

  canCreateShapes(_ids?: TLShapeId[]): boolean {
    return !this.getIsReadonly()
  }

  hasRichText(shape: TLShape): boolean {
    return 'richText' in shape.props
  }

  startEditingShapeWithRichText(shapeOrId: TLShape | TLShapeId, options: { selectAll?: boolean } = {}): this {
    const shape = this.liveShape(shapeOrId)
    if (!shape || !this.hasRichText(shape) || !this.canEditShape(shape)) return this
    this.setEditingShape(shape)
    this.setCurrentTool('select.editing_shape', { target: 'shape', shape, selectAll: options.selectAll })
    return this
  }

  popFocusedGroupId(): this {
    const focused = this.getFocusedGroupId()
    const group = focused.startsWith('shape:') ? this.getShape(focused as TLShapeId) : undefined
    if (!group) {
      this.selection.setFocusedGroupId(null)
      this.selectNone()
      return this
    }
    const above = this.findShapeAncestor(group, shape => this.isShapeOfType(shape, 'group'))
    this.selection.setFocusedGroupId(above?.id ?? null)
    this.select(group.id)
    return this
  }

  kickoutOccludedShapes(_shapes: TLShape[]): this {
    return this
  }

  updateArrowTargetState(options: {
    pointInPageSpace: VecLike
    arrow?: TLShape<'arrow'>
    isPrecise?: boolean
  }): { target: TLShape } | null {
    const target = this.getShapeAtPoint(options.pointInPageSpace, {
      hitInside: true,
      hitLocked: false,
      renderingOnly: true,
      filter: shape =>
        shape.id !== options.arrow?.id &&
        !['arrow', 'line', 'draw', 'highlight', 'group'].includes(shape.type) &&
        this.getShapeUtil(shape).canBind(shape as never)
    })
    this.arrowTargetId = target?.id ?? null
    this.setHintingShapes(target ? [target.id] : [])
    return target ? { target } : null
  }

  clearArrowTargetState(): void {
    this.arrowTargetId = null
    this.setHintingShapes([])
  }

  bindArrowTerminal(arrow: TLShape<'arrow'>, terminal: 'start' | 'end', pagePoint: VecLike, isPrecise: boolean): this {
    for (const binding of this.getBindingsFromShape(arrow.id, 'arrow')) {
      if (binding.props.terminal === terminal) this.deleteBinding(binding.id)
    }
    const state = this.updateArrowTargetState({ pointInPageSpace: pagePoint, arrow, isPrecise })
    const target = state?.target
    if (!target) return this
    const bounds = this.getShapePageBounds(target)
    if (!bounds || bounds.w === 0 || bounds.h === 0) return this
    const normalizedAnchor = isPrecise
      ? {
          x: Math.max(0, Math.min(1, (pagePoint.x - bounds.x) / bounds.w)),
          y: Math.max(0, Math.min(1, (pagePoint.y - bounds.y) / bounds.h))
        }
      : { x: 0.5, y: 0.5 }
    return this.createBinding({
      type: 'arrow',
      fromId: arrow.id,
      toId: target.id,
      props: { terminal, normalizedAnchor, isExact: false, isPrecise, snap: 'edge' }
    })
  }

  getResizeScaleFactor(): number {
    return 1
  }

  getDocumentSettings(): { gridSize: number } {
    const document = this.store.get(TLDOCUMENT_ID)
    return { gridSize: document?.typeName === 'document' ? document.gridSize : 10 }
  }

  getCameraOptions(): ReturnType<CameraManager['getOptions']> {
    return this.camera.getOptions()
  }

  getBaseZoom(): number {
    return this.camera.getBaseZoom()
  }

  stopCameraAnimation(): void {
    this.camera.stopAnimation()
  }

  slideCamera(options: { speed: number; direction: VecLike; friction?: number; speedThreshold?: number }): void {
    this.camera.slideCamera(options)
  }

  private ensureStore(preferredPageId?: TLPageId): void {
    if (!this.store.has(TLDOCUMENT_ID)) this.store.put([DocumentRecordType.create({ id: TLDOCUMENT_ID })])
    if (this.store.query('page').get().length === 0) {
      this.store.put([
        PageRecordType.create({
          id: preferredPageId ?? ('page:page' as TLPageId),
          name: 'Page 1',
          index: ZERO_INDEX_KEY
        })
      ])
    }
  }

  private resolvePageId(preferred?: TLPageId): TLPageId {
    if (preferred && this.store.get(preferred)?.typeName === 'page') return preferred
    const page = this.store
      .query('page')
      .get()
      .sort((a, b) => a.index.localeCompare(b.index))[0]
    if (!page) throw new Error('Editor requires a page')
    return page.id
  }

  private liveShape(shapeOrId: TLShape | TLShapeId | undefined | null): TLShape | undefined {
    if (!shapeOrId) return undefined
    if (typeof shapeOrId === 'string') return this.getShape(shapeOrId)
    return this.getShape(shapeOrId.id) ?? shapeOrId
  }

  private allShapes(): TLShape[] {
    return this.store.query('shape').get()
  }

  private reorder(shapes: readonly (TLShape | TLShapeId)[], operation: OrderOperation): this {
    const ids = shapes.map(shape => (typeof shape === 'string' ? shape : shape.id))
    const byParent = new Map<TLParentId, TLShapeId[]>()
    for (const id of ids) {
      const shape = this.getShape(id)
      if (!shape) continue
      const list = byParent.get(shape.parentId) ?? []
      list.push(id)
      byParent.set(shape.parentId, list)
    }
    for (const [parentId, moving] of byParent) {
      const next = reorderedShapes(sortedChildren(this.allShapes(), parentId), moving, operation)
      this.store.put(next)
    }
    return this
  }

  private opacityTargets(shapes: readonly TLShape[]): TLShape[] {
    const result: TLShape[] = []
    const add = (shape: TLShape) => {
      if (shape.type !== 'group') {
        result.push(shape)
        return
      }
      for (const id of this.getSortedChildIdsForParent(shape.id)) {
        const child = this.getShape(id)
        if (child) add(child)
      }
    }
    for (const shape of shapes) add(shape)
    return result
  }

  private stylesForProps(defaults: Record<string, unknown>): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const [key, value] of this.stylesForNextShape) if (key in defaults) values[key] = value
    return values
  }

  private refreshInputPagePoint(): void {
    this.inputs.update(this.inputs.currentScreenPoint, this.screenToPage(this.inputs.currentScreenPoint))
  }

  private cleanSelection(): void {
    this.commitSelection(this.getSelectedShapeIds())
    const editing = this.selection.getEditingShapeId()
    if (editing && !this.getShape(editing)) this.selection.setEditingShapeId(null)
  }

  private commitSelection(ids: readonly TLShapeId[]): void {
    transact(() => {
      this.selection.setSelectedShapeIds([...ids])
      const focused = this.getFocusedGroupId()
      if (focused.startsWith('shape:') && !this.getShape(focused as TLShapeId)) {
        this.selection.setFocusedGroupId(null)
      }
      if (!ids.length) return
      const group = this.findCommonAncestor(ids, shape => this.isShapeOfType(shape, 'group'))
      this.selection.setFocusedGroupId(group ?? null)
    })
  }
}

class FallbackShapeUtil extends ShapeUtil<TLShape> {
  getDefaultProps(): TLShape['props'] {
    return {} as TLShape['props']
  }

  getGeometry(shape: TLShape): Geometry2d {
    const props = shape.props as { w?: number; h?: number }
    return new Rectangle2d({
      width: Math.max(1, Math.abs(props.w ?? 1)),
      height: Math.max(1, Math.abs(props.h ?? 1)),
      isFilled: true
    })
  }

  component(): null {
    return null
  }
}

function sameIds(previous: ReadonlySet<TLShapeId>, next: ReadonlySet<TLShapeId>): boolean {
  if (previous.size !== next.size) return false
  for (const id of previous) if (!next.has(id)) return false
  return true
}

function idOf(shapeOrId: TLShape | TLShapeId): TLShapeId {
  return typeof shapeOrId === 'string' ? shapeOrId : shapeOrId.id
}

function defaultContainer(): HTMLElement {
  if (typeof document === 'undefined') return {} as HTMLElement
  return document.body
}

function finite(value: number | undefined, fallback: number): number {
  return value === undefined || !Number.isFinite(value) ? fallback : value
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function withoutUndefined<T extends object>(object: T): Partial<T> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as Partial<T>
}

function commonParent(shapes: TLShape[]): TLParentId | null {
  const parent = shapes[0]?.parentId
  return parent && shapes.every(shape => shape.parentId === parent) ? parent : null
}

function nextSiblingIndex(shapes: TLShape[], parentId: TLParentId, index: IndexKey): IndexKey | null {
  return sortedChildren(shapes, parentId).find(shape => shape.index > index)?.index ?? null
}

function linearInverse(matrix: Mat, vector: VecLike): Vec {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (determinant === 0) return Vec.From(vector)
  return new Vec(
    (matrix.d * vector.x - matrix.c * vector.y) / determinant,
    (-matrix.b * vector.x + matrix.a * vector.y) / determinant
  )
}

function alignOffset(shape: Box, common: Box, operation: string): Vec {
  switch (operation) {
    case 'left':
      return new Vec(common.minX - shape.minX, 0)
    case 'center-horizontal':
      return new Vec(common.midX - shape.midX, 0)
    case 'right':
      return new Vec(common.maxX - shape.maxX, 0)
    case 'top':
      return new Vec(0, common.minY - shape.minY)
    case 'center-vertical':
      return new Vec(0, common.midY - shape.midY)
    case 'bottom':
      return new Vec(0, common.maxY - shape.maxY)
    default:
      return new Vec()
  }
}

function boundsFromShapeRecord(shape: TLShape): Box | null {
  const props = shape.props as { w?: unknown; h?: unknown }
  if (typeof props.w !== 'number' || typeof props.h !== 'number') return new Box(shape.x, shape.y, 1, 1)
  return new Box(shape.x, shape.y, Math.abs(props.w), Math.abs(props.h))
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not construct image'))
    image.src = source
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob)
        else reject(new Error('Could not encode image'))
      },
      type,
      quality
    )
  })
}
