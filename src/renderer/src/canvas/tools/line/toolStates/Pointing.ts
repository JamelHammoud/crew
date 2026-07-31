import { Mat } from '../../../math/Mat'
import { Vec } from '../../../math/Vec'
import { createShapeId } from '../../../schema/id'
import { getIndexAbove, sortByIndex, type IndexKey } from '../../../schema/indices'
import type { TLShapeId } from '../../../schema/records'
import { LineStateNode } from '../StateNode'
import type { LineHandle, LinePointerInfo, TLLineShape } from '../types'

const MINIMUM_DISTANCE_BETWEEN_SHIFT_CLICKED_HANDLES = 2

function snapToGrid(point: Vec, state: { isGridMode: boolean }, gridSize: number): Vec {
  return state.isGridMode ? point.clone().snapToGrid(gridSize) : point.clone()
}

function last<T>(items: T[]): T | undefined {
  return items[items.length - 1]
}

export class Pointing extends LineStateNode {
  readonly id = 'pointing'
  shape?: TLLineShape
  markId: string | undefined

  override onEnter(info: LinePointerInfo): void {
    const currentPagePoint = this.editor.inputs.getCurrentPagePoint()
    this.markId = undefined
    const shapeId = info.shapeId as TLShapeId | undefined
    const shape = shapeId ? this.editor.getShape(shapeId) : undefined

    if (shape && this.editor.inputs.getShiftKey()) {
      this.markId = this.editor.markHistoryStoppingPoint(`creating_line:${shape.id}`)
      this.shape = shape
      const handles = this.editor.getShapeHandles(shape)
      if (!handles) return
      const vertexHandles = handles.filter((handle) => handle.type === 'vertex').sort(sortByIndex)
      const endHandle = vertexHandles[vertexHandles.length - 1]
      const previousEndHandle = vertexHandles[vertexHandles.length - 2]
      if (!endHandle || !previousEndHandle) return
      const parentTransform = this.editor.getShapeParentTransform(shape)
      if (!parentTransform) return
      const shapePagePoint = Mat.applyToPoint(parentTransform, new Vec(shape.x, shape.y))
      const nudgedPoint = Vec.Sub(currentPagePoint, shapePagePoint).addXY(0.1, 0.1)
      const nextPoint = snapToGrid(
        nudgedPoint,
        this.editor.getInstanceState(),
        this.editor.getDocumentSettings().gridSize
      )
      const points = structuredClone(shape.props.points)
      const minDistance = MINIMUM_DISTANCE_BETWEEN_SHIFT_CLICKED_HANDLES / this.editor.getZoomLevel()

      if (
        Vec.DistMin(endHandle, previousEndHandle, minDistance) ||
        Vec.DistMin(nextPoint, endHandle, minDistance)
      ) {
        points[endHandle.id] = {
          id: endHandle.id,
          index: endHandle.index,
          x: nextPoint.x,
          y: nextPoint.y
        }
      } else {
        const nextIndex = getIndexAbove(endHandle.index)
        points[nextIndex] = {
          id: nextIndex,
          index: nextIndex,
          x: nextPoint.x,
          y: nextPoint.y
        }
      }

      this.editor.updateShapes([{ id: shape.id, type: 'line', props: { points } }])
      this.shape = this.editor.getShape(shape.id)
      return
    }

    const id = createShapeId()
    this.markId = this.editor.markHistoryStoppingPoint(`creating_line:${id}`)
    const newPoint = snapToGrid(
      Vec.From(currentPagePoint),
      this.editor.getInstanceState(),
      this.editor.getDocumentSettings().gridSize
    )
    this.editor.createShapes([
      {
        id,
        type: 'line',
        x: newPoint.x,
        y: newPoint.y,
        props: { scale: this.editor.getResizeScaleFactor() }
      }
    ])
    const createdShape = this.editor.getShape(id)
    if (!createdShape) {
      this.cancel()
      return
    }
    this.editor.select(id)
    this.shape = createdShape
  }

  override onPointerMove(): void {
    if (!this.shape || !this.editor.inputs.getIsDragging()) return
    const handles = this.editor.getShapeHandles(this.shape)
    if (!handles) {
      if (this.markId) this.editor.bailToMark(this.markId)
      throw new Error('No handles found')
    }
    const handle = last(handles)
    if (!handle) return
    this.editor.setCurrentTool('select.dragging_handle', {
      shape: this.shape,
      isCreating: true,
      creatingMarkId: this.markId,
      handle: { ...handle, x: handle.x - 0.1, y: handle.y - 0.1 },
      onInteractionEnd: 'line'
    })
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onLongPress(): void {
    if (this.editor.getInstanceState().isCoarsePointer) this.cancel()
  }

  override onCancel(): void {
    this.cancel()
  }

  override onComplete(): void {
    this.complete()
  }

  override onInterrupt(): void {
    this.parent.transition('idle')
    if (this.markId) this.editor.bailToMark(this.markId)
    this.editor.snaps.clearIndicators()
  }

  complete(): void {
    this.parent.transition('idle', { shapeId: this.shape?.id })
    this.editor.snaps.clearIndicators()
  }

  cancel(): void {
    if (this.markId) this.editor.bailToMark(this.markId)
    this.parent.transition('idle', { shapeId: this.shape?.id })
    this.editor.snaps.clearIndicators()
  }
}

export function sortLineHandles(handles: LineHandle[]): LineHandle[] {
  return [...handles].sort((a, b) => sortByIndex(a as LineHandle & { index: IndexKey }, b))
}
