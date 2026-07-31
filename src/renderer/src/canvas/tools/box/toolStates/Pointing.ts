import { Vec } from '../../../math'
import { createShapeId } from '../../../schema'
import type { TLShape } from '../../../schema'
import type { BaseBoxShapeTool } from '../BaseBoxShapeTool'
import { BoxStateNode } from '../StateNode'
import type { BoxPointerInfo, BoxToolEditor } from '../types'

export class Pointing extends BoxStateNode {
  readonly id = 'pointing'

  override onPointerMove(info: BoxPointerInfo): void {
    if (!this.editor.inputs.getIsDragging()) return
    const originPagePoint = this.editor.inputs.getOriginPagePoint()
    const parent = this.parent as BaseBoxShapeTool
    const id = createShapeId()
    const creatingMarkId = this.editor.markHistoryStoppingPoint(`creating_box:${id}`)
    const newPoint = maybeSnapToGrid(Vec.From(originPagePoint), this.editor)
    this.editor.createShapes([
      {
        id,
        type: parent.shapeType,
        x: newPoint.x,
        y: newPoint.y,
        props: { w: 1, h: 1 }
      }
    ])
    const shape = this.editor.getShape(id)
    if (!shape) {
      this.cancel()
      return
    }
    this.editor.select(id)
    this.editor.setCurrentTool('select.resizing', {
      ...info,
      target: 'selection',
      handle: 'bottom_right',
      isCreating: true,
      creatingMarkId,
      creationCursorOffset: { x: 1, y: 1 },
      onInteractionEnd: parent.id,
      onCreate: parent.onCreate ? (created: TLShape | null) => parent.onCreate?.(created) : undefined
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
    this.cancel()
  }

  complete(): void {
    const originPagePoint = this.editor.inputs.getOriginPagePoint()
    const parent = this.parent as BaseBoxShapeTool
    const id = createShapeId()
    this.editor.markHistoryStoppingPoint(`creating_box:${id}`)
    this.editor.createShapes([{ id, type: parent.shapeType, x: originPagePoint.x, y: originPagePoint.y }])
    const shape = this.editor.getShape(id)
    if (!shape) {
      this.cancel()
      return
    }
    if (!hasBoxProps(shape)) {
      this.cancel()
      return
    }
    let { w, h } = shape.props
    const delta = new Vec(w / 2, h / 2)
    const parentTransform = this.editor.getShapeParentTransform(shape)
    if (parentTransform) delta.rot(-parentTransform.rotation())
    const scale = this.editor.getResizeScaleFactor()
    if (scale !== 1) {
      w *= scale
      h *= scale
      delta.mul(scale)
    }
    const point = maybeSnapToGrid(new Vec(shape.x - delta.x, shape.y - delta.y), this.editor)
    const props: Record<string, unknown> = { ...shape.props, w, h }
    if ('scale' in shape.props) props.scale = scale
    this.editor.updateShape({ id, type: shape.type, x: point.x, y: point.y, props })
    this.editor.setSelectedShapes([id])
    if (this.editor.getInstanceState().isToolLocked) this.parent.transition('idle')
    else this.editor.setCurrentTool('select.idle')
  }

  cancel(): void {
    this.parent.transition('idle')
  }
}

function hasBoxProps(shape: TLShape): shape is TLShape & { props: { w: number; h: number } } {
  return (
    typeof (shape.props as { w?: unknown }).w === 'number' && typeof (shape.props as { h?: unknown }).h === 'number'
  )
}

export function maybeSnapToGrid(point: Vec, editor: BoxToolEditor): Vec {
  if (editor.getInstanceState().isGridMode) {
    return point.clone().snapToGrid(editor.getDocumentSettings().gridSize)
  }
  return point.clone()
}
