import { Vec } from '../../../math/Vec'
import { createShapeId } from '../../../schema/id'
import { ArrowStateNode } from '../StateNode'
import type {
  ArrowPointerInfo,
  ArrowTimerId,
  TLArrowShape
} from '../types'

function snapToGrid(point: Vec, state: { isGridMode: boolean }, gridSize: number): Vec {
  return state.isGridMode ? point.clone().snapToGrid(gridSize) : point.clone()
}

export class Pointing extends ArrowStateNode {
  readonly id = 'pointing'
  shape: TLArrowShape | undefined
  isPrecise = false
  isPreciseTimerId: ArrowTimerId | null = null
  markId = ''

  override onEnter(info: ArrowPointerInfo): void {
    this.markId = ''
    this.isPrecise = Boolean(info.isPrecise)
    const targetState = this.editor.updateArrowTargetState({
      editor: this.editor,
      pointInPageSpace: this.editor.inputs.getCurrentPagePoint(),
      arrow: undefined,
      isPrecise: this.isPrecise,
      currentBinding: undefined,
      oppositeBinding: undefined
    })
    if (!targetState) {
      this.createArrowShape()
      if (!this.shape) {
        this.cancel()
        return
      }
    }
    this.startPreciseTimeout()
  }

  override onExit(): void {
    this.shape = undefined
    this.editor.clearArrowTargetState()
    this.clearPreciseTimeout()
  }

  override onPointerMove(): void {
    if (!this.editor.inputs.getIsDragging()) return
    if (!this.shape) this.createArrowShape()
    if (!this.shape) {
      this.cancel()
      return
    }
    this.updateArrowShapeEndHandle()
    this.editor.setCurrentTool('select.dragging_handle', {
      shape: this.shape,
      handle: { id: 'end', type: 'vertex', index: 'a3', x: 0, y: 0 },
      isCreating: true,
      creatingMarkId: this.markId || undefined,
      onInteractionEnd: 'arrow'
    })
  }

  override onPointerUp(): void {
    this.cancel()
  }

  override onLongPress(): void {
    if (this.editor.getInstanceState().isCoarsePointer) this.cancel()
  }

  override onCancel(): void {
    this.cancel()
  }

  override onComplete(): void {
    this.cancel()
  }

  override onInterrupt(): void {
    this.cancel()
  }

  cancel(): void {
    if (this.shape && this.markId) this.editor.bailToMark(this.markId)
    this.parent.transition('idle')
  }

  createArrowShape(): void {
    const originPagePoint = this.editor.inputs.getOriginPagePoint()
    const id = createShapeId()
    this.markId = this.editor.markHistoryStoppingPoint(`creating_arrow:${id}`)
    const newPoint = snapToGrid(
      Vec.From(originPagePoint),
      this.editor.getInstanceState(),
      this.editor.getDocumentSettings().gridSize
    )
    this.editor.createShape({
      id,
      type: 'arrow',
      x: newPoint.x,
      y: newPoint.y,
      props: { scale: this.editor.getResizeScaleFactor() }
    })
    const shape = this.editor.getShape(id)
    if (!shape) return
    const handles = this.editor.getShapeHandles(shape)
    if (!handles) throw new Error('expected handles for arrow')
    const startHandle = handles.find((handle) => handle.id === 'start')
    if (!startHandle) throw new Error('expected start handle for arrow')
    const change = this.editor.getShapeUtil('arrow').onHandleDrag?.(shape, {
      handle: { ...startHandle, x: 0, y: 0 },
      isPrecise: true,
      isCreatingShape: true,
      initial: this.shape
    })
    if (change) this.editor.updateShapes([change])
    this.shape = this.editor.getShape(id)
    this.editor.select(id)
  }

  updateArrowShapeEndHandle(): void {
    const shape = this.shape
    if (!shape) throw new Error('expected shape')
    const handles = this.editor.getShapeHandles(shape)
    if (!handles) throw new Error('expected handles for arrow')
    const startHandle = handles.find((handle) => handle.id === 'start')
    const endHandle = handles.find((handle) => handle.id === 'end')
    if (!startHandle || !endHandle) throw new Error('expected endpoint handles for arrow')
    const util = this.editor.getShapeUtil('arrow')
    const initial = this.shape
    const startChange = util.onHandleDrag?.(shape, {
      handle: { ...startHandle, x: 0, y: 0 },
      isPrecise: this.isPrecise,
      isCreatingShape: true,
      initial
    })
    if (startChange) this.editor.updateShapes([startChange])
    const currentShape = this.editor.getShape(shape.id)
    if (!currentShape) throw new Error('expected shape')
    const point = this.editor.getPointInShapeSpace(
      currentShape,
      this.editor.inputs.getCurrentPagePoint()
    )
    const endChange = util.onHandleDrag?.(currentShape, {
      handle: { ...endHandle, x: point.x, y: point.y },
      isPrecise: this.isPrecise,
      isCreatingShape: true,
      initial
    })
    if (endChange) this.editor.updateShapes([endChange])
    this.shape = this.editor.getShape(shape.id)
  }

  private startPreciseTimeout(): void {
    const delay = this.editor.getShapeUtil('arrow').options.pointingPreciseTimeout
    this.isPreciseTimerId = this.editor.timers.setTimeout(() => {
      if (!this.getIsActive()) return
      this.isPrecise = true
    }, delay)
  }

  private clearPreciseTimeout(): void {
    if (this.isPreciseTimerId === null) return
    const clear = this.editor.timers.clearTimeout ?? clearTimeout
    clear(this.isPreciseTimerId)
    this.isPreciseTimerId = null
  }
}
