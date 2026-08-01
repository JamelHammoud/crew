import { Vec } from '../../math'
import { getShapeParent, hasAncestor } from './shapeTree'
import type { SelectEditor } from './types'

const SLOW_POINTER_LAG_DURATION = 320
const FAST_POINTER_LAG_DURATION = 60

export interface DragTargetInfo {
  initialDraggingOverShapeId: string | null
  nextDraggingOverShapeId?: string | null
  prevDraggingOverShapeId?: string | null
  initialParentIds: Map<string, string>
  initialIndices: Map<string, string>
}

export class DragAndDropManager {
  private shapesToActuallyMove: any[] = []
  private readonly initialParentIds = new Map<string, string>()
  private readonly initialIndices = new Map<string, string>()
  private initialDraggingOverShape: any
  private prevDraggingOverShape: any
  private prevPagePoint = new Vec()
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(private readonly editor: SelectEditor) {}

  startDraggingShapes(movingShapes: any[], point: Vec, onReparent?: () => void): void {
    if (this.intervalId !== null) return

    const moving = new Set(movingShapes)
    const movingGroups = new Set<any>()
    for (const shape of moving) {
      const parent = getShapeParent(this.editor, shape)
      if (parent && this.editor.isShapeOfType(parent, 'group')) movingGroups.add(parent)
    }
    for (const group of movingGroups) {
      moving.add(group)
      for (const id of this.editor.getSortedChildIdsForParent?.(group.id) ?? []) {
        const child = this.editor.getShape(id)
        if (child) moving.delete(child)
      }
    }

    this.initialParentIds.clear()
    this.initialIndices.clear()
    for (const shape of moving) {
      const parent = getShapeParent(this.editor, shape)
      if (parent) this.initialParentIds.set(shape.id, parent.id)
      this.initialIndices.set(shape.id, shape.index)
    }

    const sorted = this.editor.getCurrentPageShapesSorted()
    this.shapesToActuallyMove = [...moving]
      .filter(shape => !shape.isLocked)
      .sort((a, b) => sorted.indexOf(a) - sorted.indexOf(b))

    this.initialDraggingOverShape = this.draggingOverShape(point)
    this.prevDraggingOverShape = this.initialDraggingOverShape

    this.update(point, onReparent)

    let frame = 0
    this.intervalId = setInterval(
      () => {
        frame++
        if (frame % 3 && (this.editor.inputs.getPointerVelocity?.()?.len() ?? 0) > 0.5) return
        this.update(this.editor.inputs.getCurrentPagePoint(), onReparent)
      },
      movingShapes.length > 10 ? SLOW_POINTER_LAG_DURATION : FAST_POINTER_LAG_DURATION
    )
  }

  dropShapes(shapes: any[]): void {
    const point = this.editor.inputs.getCurrentPagePoint()
    this.update(point)
    const target = this.draggingOverShape(point, shapes)
    if (target) {
      const receivable = this.receivableFor(target, shapes)
      if (receivable.length) {
        const util = this.editor.getShapeUtil(target)
        if (util.onDropShapesOver) util.onDropShapesOver(target, receivable, this.info())
        else this.reparentIn(target, receivable)
      }
    }
    this.clear()
  }

  clear(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId)
    this.intervalId = null
    this.initialParentIds.clear()
    this.initialIndices.clear()
    this.shapesToActuallyMove = []
    this.initialDraggingOverShape = undefined
    this.prevDraggingOverShape = undefined
    this.editor.setHintingShapes([])
  }

  private info(extra: Partial<DragTargetInfo> = {}): DragTargetInfo {
    return {
      initialDraggingOverShapeId: this.initialDraggingOverShape?.id ?? null,
      initialParentIds: this.initialParentIds,
      initialIndices: this.initialIndices,
      ...extra
    }
  }

  private draggingOverShape(point: Vec, dropping = this.shapesToActuallyMove): any {
    const draggingIds = new Set(dropping.map((shape: any) => shape.id))
    const candidates = this.editor
      .getShapesAtPoint(point, { hitInside: true, margin: 0 })
      .filter((shape: any) => !draggingIds.has(shape.id) && !shape.isLocked && !this.editor.isShapeHidden(shape))
    for (const candidate of candidates) {
      const util = this.editor.getShapeUtil(candidate)
      if (
        util.onDragShapesOver ||
        util.onDragShapesIn ||
        util.onDragShapesOut ||
        util.onDropShapesOver ||
        util.isFrameLike?.(candidate)
      ) {
        return candidate
      }
    }
    return undefined
  }

  private receivableFor(target: any, dragging: any[]): any[] {
    const util = this.editor.getShapeUtil(target)
    return dragging.filter((shape: any) => util.canReceiveNewChildrenOfType(target, shape.type))
  }

  private removableFor(target: any, dragging: any[]): any[] {
    const util = this.editor.getShapeUtil(target)
    return dragging.filter((shape: any) => util.canRemoveChildrenOfType(target, shape.type))
  }

  private update(point: Vec, onReparent?: () => void): void {
    const dragging = this.shapesToActuallyMove
      .map((shape: any) => this.editor.getShape(shape.id))
      .filter(Boolean)
    if (!dragging.length) return

    const next = this.draggingOverShape(point)
    const currentPagePoint = this.editor.inputs.getCurrentPagePoint()
    const cursorDidMove = !this.prevPagePoint.equals(currentPagePoint)
    this.prevPagePoint = Vec.From(currentPagePoint)

    if (this.prevDraggingOverShape?.id === next?.id) {
      if (cursorDidMove && next) {
        this.editor.getShapeUtil(next).onDragShapesOver?.(next, dragging, this.info())
      }
      return
    }

    if (this.prevDraggingOverShape) {
      const previous = this.editor.getShape(this.prevDraggingOverShape.id)
      if (previous) {
        const removable = this.removableFor(previous, dragging)
        if (removable.length) {
          const util = this.editor.getShapeUtil(previous)
          const info = this.info({ nextDraggingOverShapeId: next?.id ?? null })
          if (util.onDragShapesOut) util.onDragShapesOut(previous, removable, info)
          else if (!next) this.reparentOut(previous, removable)
        }
      }
    }

    if (next) {
      const receivable = this.receivableFor(next, dragging)
      if (receivable.length) {
        const util = this.editor.getShapeUtil(next)
        const info = this.info({ prevDraggingOverShapeId: this.prevDraggingOverShape?.id ?? null })
        if (util.onDragShapesIn) util.onDragShapesIn(next, receivable, info)
        else this.reparentIn(next, receivable)
        this.editor.setHintingShapes([next.id])
      } else if (this.prevDraggingOverShape) {
        this.editor.setHintingShapes([])
      }
    } else if (this.prevDraggingOverShape) {
      this.editor.setHintingShapes([])
    }

    onReparent?.()
    this.prevDraggingOverShape = next
  }

  private reparentIn(target: any, dragging: any[]): void {
    if (dragging.every((shape: any) => shape.parentId === target.id)) return
    if (dragging.some((shape: any) => hasAncestor(this.editor, target, shape.id))) return

    const previousChildren = dragging.filter((shape: any) => this.initialParentIds.get(shape.id) === target.id)
    let restoreIndices = false
    if (previousChildren.length) {
      const currentChildren = (this.editor.getSortedChildIdsForParent?.(target.id) ?? [])
        .map((id: string) => this.editor.getShape(id))
        .filter(Boolean)
      restoreIndices = previousChildren.every(
        (shape: any) => !currentChildren.some((child: any) => child.index === shape.index)
      )
    }

    this.editor.reparentShapes(dragging, target.id)

    if (!restoreIndices) return
    for (const shape of previousChildren) {
      const index = this.initialIndices.get(shape.id)
      if (index) this.editor.updateShape({ id: shape.id, type: shape.type, index })
    }
  }

  private reparentOut(target: any, dragging: any[]): void {
    const leaving = dragging.filter((shape: any) => shape.parentId === target.id)
    if (!leaving.length) return
    this.editor.reparentShapes(leaving, this.editor.getCurrentPageId())
  }
}
