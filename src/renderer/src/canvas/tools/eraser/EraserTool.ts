import { Box } from '../../math/Box'
import { pointInPolygon } from '../../math/utils'
import type { VecModel } from '../../math/Vec'

export interface EraserPointerEvent {
  accelKey?: boolean
  [key: string]: unknown
}

export interface EraserKeyboardEvent {
  key?: string
  ctrlKey: boolean
  metaKey: boolean
}

export interface EraserShape {
  id: string
  type: string
}

export interface EraserGeometry {
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    containsPoint(point: VecModel): boolean
  }
  hitTestLineSegment(a: VecModel, b: VecModel, margin: number): boolean
}

export interface EraserTransform {
  clone(): {
    invert(): { applyToPoint(point: VecModel): VecModel }
  }
}

export interface EraserEditor {
  inputs: {
    getOriginPagePoint(): VecModel
    getCurrentPagePoint(): VecModel
    getPreviousPagePoint(): VecModel
    getIsDragging(): boolean
    getAccelKey(): boolean
  }
  options: { hitTestMargin: number }
  scribbles: {
    addScribble(options: { color: 'muted-1'; size: 12 }): { id: string }
    addPoint(id: string, x: number, y: number): void
    stop(id: string): void
  }
  setCursor(cursor: { type: 'cross'; rotation: number }): void
  setCurrentTool(id: string): void
  setCurrentToolIdMask?(id: string | undefined): void
  getZoomLevel(): number
  getCurrentPageShapes(): EraserShape[]
  getCurrentPageRenderingShapesSorted(): EraserShape[]
  getShapesAtPoint(point: VecModel): EraserShape[]
  getShapeIdsInsideBounds(bounds: Box): Set<string>
  getShapeMask(id: string): VecModel[] | undefined
  getShapeGeometry(shape: EraserShape): EraserGeometry | undefined
  getShapePageTransform(shape: EraserShape): EraserTransform | undefined
  getPointInShapeSpace(shape: EraserShape, point: VecModel): VecModel
  getOutermostSelectableShape(shape: EraserShape, filter?: (shape: EraserShape) => boolean): EraserShape
  getErasingShapeIds(): string[]
  getCurrentPageState(): { erasingShapeIds: string[] }
  isShapeOrAncestorLocked(shape: EraserShape): boolean
  isShapeOfType(shape: EraserShape, type: string): boolean
  isShapeFrameLike(shape: EraserShape): boolean
  isPointInShape(shape: EraserShape, point: VecModel, options: { hitInside: false; margin: number }): boolean
  setErasingShapes(ids: string[]): void
  markHistoryStoppingPoint(label: string): string
  bailToMark(id: string): void
  deleteShapes(ids: string[]): void
}

export type EraserStateId = 'idle' | 'pointing' | 'erasing'

abstract class EraserState {
  constructor(
    protected readonly tool: EraserTool,
    protected readonly editor: EraserEditor
  ) {}

  onEnter(_info?: EraserPointerEvent): void {}
  onExit(_info?: EraserPointerEvent, _to?: string): void {}
  onPointerDown(_info: EraserPointerEvent): void {}
  onPointerMove(_info: EraserPointerEvent): void {}
  onPointerUp(_info: EraserPointerEvent): void {}
  onLongPress(_info: EraserPointerEvent): void {}
  onKeyUp(_info: EraserKeyboardEvent): void {}
  onCancel(): void {}
  onComplete(): void {}
  onInterrupt(): void {}
}

export class EraserIdle extends EraserState {
  static readonly id = 'idle'

  override onEnter(info?: EraserPointerEvent): void {
    if (!(info?.accelKey ?? this.editor.inputs.getAccelKey())) this.tool.maybeReturnToOriginatingTool()
  }

  override onKeyUp(info: EraserKeyboardEvent): void {
    if (!info.ctrlKey && !info.metaKey) this.tool.maybeReturnToOriginatingTool()
  }

  override onPointerDown(info: EraserPointerEvent): void {
    this.tool.transition('pointing', info)
  }

  override onCancel(): void {
    this.editor.setCurrentTool(this.tool.info.onInteractionEnd ?? 'select')
  }
}

export class EraserPointing extends EraserState {
  static readonly id = 'pointing'

  override onEnter(info: EraserPointerEvent = {}): void {
    const onlyTop = Boolean(info.accelKey)
    const margin = this.editor.options.hitTestMargin / this.editor.getZoomLevel()
    const shapes = this.editor.getCurrentPageRenderingShapesSorted()
    const current = this.editor.inputs.getCurrentPagePoint()
    const erasing = new Set<string>()
    const initialSize = erasing.size
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i]
      if (this.editor.isShapeOrAncestorLocked(shape) || this.editor.isShapeOfType(shape, 'group')) continue
      if (!this.editor.isPointInShape(shape, current, { hitInside: false, margin })) continue
      const hit = this.editor.getOutermostSelectableShape(shape)
      if (this.editor.isShapeFrameLike(hit) && erasing.size > initialSize) break
      erasing.add(hit.id)
      if (onlyTop) break
    }
    this.editor.setErasingShapes([...erasing])
  }

  override onLongPress(info: EraserPointerEvent): void {
    if (!info.accelKey) this.tool.transition('erasing', info)
  }

  override onExit(_info: EraserPointerEvent | undefined, to?: string): void {
    if (to !== 'erasing') this.editor.setErasingShapes([])
  }

  override onPointerMove(info: EraserPointerEvent): void {
    if (this.editor.inputs.getIsDragging()) this.tool.transition('erasing', info)
  }

  override onPointerUp(info: EraserPointerEvent): void {
    this.complete(info)
  }

  override onCancel(): void {
    this.cancel()
  }

  override onComplete(): void {
    this.complete()
  }

  override onInterrupt(): void {
    this.cancel()
  }

  complete(info?: EraserPointerEvent): void {
    const ids = this.editor.getErasingShapeIds()
    if (ids.length) {
      this.editor.markHistoryStoppingPoint('erase end')
      this.editor.deleteShapes(ids)
    }
    this.tool.transition('idle', info)
  }

  cancel(): void {
    this.tool.transition('idle')
  }
}

export class EraserErasing extends EraserState {
  static readonly id = 'erasing'
  static readonly trackPerformance = true
  private info = {} as EraserPointerEvent
  private scribbleId = 'id'
  private markId = ''
  private excludedShapeIds = new Set<string>()
  erasingShapeIds: string[] = []

  override onEnter(info: EraserPointerEvent = {}): void {
    this.markId = this.editor.markHistoryStoppingPoint('erase scribble begin')
    this.info = info
    const origin = this.editor.inputs.getOriginPagePoint()
    this.excludedShapeIds = new Set(
      this.editor
        .getCurrentPageShapes()
        .filter(shape => {
          if (this.editor.isShapeOrAncestorLocked(shape)) return true
          if (this.editor.isShapeOfType(shape, 'group') || this.editor.isShapeFrameLike(shape)) {
            const local = this.editor.getPointInShapeSpace(shape, origin)
            return this.editor.getShapeGeometry(shape)?.bounds.containsPoint(local) ?? false
          }
          return false
        })
        .map(shape => shape.id)
    )
    this.erasingShapeIds = this.editor
      .getShapesAtPoint(origin)
      .filter(shape => !this.excludedShapeIds.has(shape.id))
      .map(shape => shape.id)
    this.editor.setErasingShapes([...new Set([...this.editor.getErasingShapeIds(), ...this.erasingShapeIds])])
    this.scribbleId = this.editor.scribbles.addScribble({ color: 'muted-1', size: 12 }).id
    this.update()
  }

  override onExit(): void {
    this.editor.setErasingShapes([])
    this.editor.scribbles.stop(this.scribbleId)
  }

  override onPointerMove(): void {
    this.update()
  }

  override onPointerUp(info: EraserPointerEvent): void {
    this.complete(info)
  }

  override onCancel(): void {
    this.cancel()
  }

  override onComplete(): void {
    this.complete()
  }

  update(): void {
    const erasing = new Set(this.editor.getErasingShapeIds())
    const minDist = this.editor.options.hitTestMargin / this.editor.getZoomLevel()
    const current = this.editor.inputs.getCurrentPagePoint()
    const previous = this.editor.inputs.getPreviousPagePoint()
    this.editor.scribbles.addPoint(this.scribbleId, current.x, current.y)
    const lineBounds = Box.FromPoints([previous, current]).expandBy(minDist)
    const candidateIds = this.editor.getShapeIdsInsideBounds(lineBounds)
    if (candidateIds.size === 0) {
      this.editor.setErasingShapes([...erasing])
      return
    }
    const shapes = this.editor.getCurrentPageRenderingShapesSorted().filter(shape => candidateIds.has(shape.id))
    for (const shape of shapes) {
      if (this.editor.isShapeOfType(shape, 'group')) continue
      const mask = this.editor.getShapeMask(shape.id)
      if (mask && !pointInPolygon(current, mask)) continue
      const geometry = this.editor.getShapeGeometry(shape)
      const transform = this.editor.getShapePageTransform(shape)
      if (!geometry || !transform) continue
      const inverse = transform.clone().invert()
      const a = inverse.applyToPoint(previous)
      const b = inverse.applyToPoint(current)
      const bounds = geometry.bounds
      if (
        bounds.minX - minDist > Math.max(a.x, b.x) ||
        bounds.minY - minDist > Math.max(a.y, b.y) ||
        bounds.maxX + minDist < Math.min(a.x, b.x) ||
        bounds.maxY + minDist < Math.min(a.y, b.y)
      ) {
        continue
      }
      if (geometry.hitTestLineSegment(a, b, minDist)) {
        const outermost = this.editor.getOutermostSelectableShape(shape)
        if (this.excludedShapeIds.has(outermost.id)) {
          erasing.add(
            this.editor.getOutermostSelectableShape(shape, candidate => !this.excludedShapeIds.has(candidate.id)).id
          )
        } else {
          erasing.add(outermost.id)
        }
      }
      this.erasingShapeIds = [...erasing]
    }
    this.editor.setErasingShapes(this.erasingShapeIds.filter(id => !this.excludedShapeIds.has(id)))
  }

  complete(info?: EraserPointerEvent): void {
    this.editor.deleteShapes(this.editor.getCurrentPageState().erasingShapeIds)
    this.tool.transition('idle', info)
    this.erasingShapeIds = []
  }

  cancel(): void {
    this.editor.bailToMark(this.markId)
    this.tool.transition('idle', this.info)
  }
}

export class EraserTool {
  static readonly id = 'eraser'
  static readonly initial = 'idle'
  static readonly isLockable = false
  readonly children: Record<EraserStateId, EraserState>
  stateId: EraserStateId = 'idle'
  info: { onInteractionEnd?: string } = {}

  constructor(
    readonly editor: EraserEditor,
    info?: EraserPointerEvent & { onInteractionEnd?: string }
  ) {
    this.children = {
      idle: new EraserIdle(this, editor),
      pointing: new EraserPointing(this, editor),
      erasing: new EraserErasing(this, editor)
    }
    if (info) this.enter(info)
  }

  get state(): EraserState {
    return this.children[this.stateId]
  }

  getPath(): string {
    return `${EraserTool.id}.${this.stateId}`
  }

  onEnter(info: EraserPointerEvent & { onInteractionEnd?: string } = {}): void {
    this.info = info
    if (info.onInteractionEnd) this.editor.setCurrentToolIdMask?.(info.onInteractionEnd)
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  onExit(): void {
    this.editor.setCurrentToolIdMask?.(undefined)
    this.info = {}
  }

  enter(info: EraserPointerEvent & { onInteractionEnd?: string } = {}): void {
    this.onEnter(info)
    this.stateId = EraserTool.initial
    this.state.onEnter(info)
  }

  exit(info?: EraserPointerEvent, to?: string): void {
    this.onExit()
    this.state.onExit(info, to)
  }

  maybeReturnToOriginatingTool(): void {
    if (this.info.onInteractionEnd) this.editor.setCurrentTool(this.info.onInteractionEnd)
  }

  transition(id: EraserStateId, info?: EraserPointerEvent): void {
    if (id === this.stateId) return
    this.state.onExit(info, id)
    this.stateId = id
    this.state.onEnter(info)
  }

  onPointerDown(info: EraserPointerEvent): void {
    this.state.onPointerDown(info)
  }

  onPointerMove(info: EraserPointerEvent): void {
    this.state.onPointerMove(info)
  }

  onPointerUp(info: EraserPointerEvent): void {
    this.state.onPointerUp(info)
  }

  onLongPress(info: EraserPointerEvent): void {
    this.state.onLongPress(info)
  }

  onKeyUp(info: EraserKeyboardEvent): void {
    this.state.onKeyUp(info)
  }

  onCancel(): void {
    this.state.onCancel()
  }

  onComplete(): void {
    this.state.onComplete()
  }

  onInterrupt(): void {
    this.state.onInterrupt()
  }
}
