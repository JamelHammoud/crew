import { Vec } from '../../../math'
import { createShapeId, fromPlainText, type TLShape, type TLShapeId } from '../../../schema'
import { BoxStateNode, maybeSnapToGrid, type BoxPointerInfo } from '../../box'
import { startEditingShapeWithRichText } from '../editing'

type TextShape = TLShape<'text'>

export class Pointing extends BoxStateNode {
  readonly id = 'pointing'
  shape?: TextShape
  markId = ''
  enterTime = 0

  override onEnter(): void {
    this.enterTime = Date.now()
  }

  override onExit(): void {
    this.editor.setHintingShapes?.([])
  }

  override onPointerMove(info: BoxPointerInfo): void {
    if (Date.now() - this.enterTime < 150) return
    if (this.editor.inputs.getIsPointing && !this.editor.inputs.getIsPointing()) return
    const origin = Vec.From(this.editor.inputs.getOriginPagePoint())
    const current = Vec.From(this.editor.inputs.getCurrentPagePoint?.() ?? origin)
    const width = Math.abs(origin.x - current.x)
    const coarse = this.editor.getInstanceState().isCoarsePointer
    const dragDistanceSquared = coarse
      ? (this.editor.options?.coarseDragDistanceSquared ?? 36)
      : (this.editor.options?.dragDistanceSquared ?? 16)
    const minimum = (Math.sqrt(dragDistanceSquared) * 6) / (this.editor.getZoomLevel?.() ?? 1)
    if (width <= minimum) return
    const id = createShapeId()
    this.markId = this.editor.markHistoryStoppingPoint(`creating_text:${id}`)
    const shape = this.createTextShape(id, origin, false, width)
    if (!shape) {
      this.cancel()
      return
    }
    this.shape = shape
    this.editor.select(id)
    const scale = this.editor.getResizeScaleFactor()
    this.editor.setCurrentTool('select.resizing', {
      ...info,
      target: 'selection',
      handle: 'right',
      isCreating: true,
      creatingMarkId: this.markId,
      creationCursorOffset: { x: width * scale, y: 1 },
      onInteractionEnd: 'text',
      onCreate: () => startEditingShapeWithRichText(this.editor, shape.id)
    })
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onLongPress(): void {
    if (this.editor.getInstanceState().isCoarsePointer) this.cancel()
  }

  override onComplete(): void {
    this.cancel()
  }
  override onCancel(): void {
    this.cancel()
  }
  override onInterrupt(): void {
    this.cancel()
  }

  private complete(): void {
    this.editor.markHistoryStoppingPoint('creating text shape')
    const id = createShapeId()
    const point = Vec.From(this.editor.inputs.getOriginPagePoint())
    const shape = this.createTextShape(id, point, true, 20)
    if (!shape) return
    this.editor.select(id)
    startEditingShapeWithRichText(this.editor, id)
  }

  private cancel(): void {
    this.parent.transition('idle')
    if (this.markId) this.editor.bailToMark?.(this.markId)
  }

  private createTextShape(id: TLShapeId, point: Vec, autoSize: boolean, width: number): TextShape | undefined {
    this.editor.createShapes([
      {
        id,
        type: 'text',
        x: point.x,
        y: point.y,
        props: {
          richText: fromPlainText(''),
          autoSize,
          w: width,
          scale: this.editor.getResizeScaleFactor()
        }
      }
    ])
    const shape = this.editor.getShape(id)
    if (!shape || shape.type !== 'text') {
      this.cancel()
      return
    }
    const bounds = this.editor.getShapePageBounds(shape)
    if (!bounds) {
      this.cancel()
      return
    }
    const delta = new Vec()
    if (autoSize) {
      if (shape.props.textAlign === 'middle') delta.x = -bounds.width / 2
      else if (shape.props.textAlign === 'end') delta.x = -bounds.width
    }
    delta.y = -bounds.height / 2
    const parentTransform = this.editor.getShapeParentTransform(shape)
    if (parentTransform) delta.rot(-parentTransform.rotation())
    const topLeft = new Vec(shape.x + delta.x, shape.y + delta.y)
    const snapped = maybeSnapToGrid(topLeft, this.editor)
    this.editor.updateShape({ id, type: 'text', x: snapped.x, y: snapped.y })
    return this.editor.getShape(id) as TextShape | undefined
  }
}
