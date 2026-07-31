import { StateNode } from '../../state'
import { finishInteraction } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class PointingArrowLabel extends StateNode<SelectEditor> {
  static id = 'pointing_arrow_label'
  private info: SelectPointerInfo = { target: 'shape' }
  private shapeId = ''
  private markId = ''
  private wasAlreadySelected = false
  private didDrag = false
  private didCtrlOnEnter = false

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    this.shapeId = info.shape.id
    this.didDrag = false
    this.didCtrlOnEnter = Boolean(info.accelKey)
    this.wasAlreadySelected = this.editor.getOnlySelectedShapeId() === this.shapeId
    if (typeof info.onInteractionEnd === 'string') this.parent.setCurrentToolIdMask(info.onInteractionEnd)
    this.editor.setCursor({ type: 'grabbing', rotation: 0 })
    this.markId = this.editor.markHistoryStoppingPoint('label-drag start')
    const selected = this.editor.getSelectedShapeIds()
    this.editor.setSelectedShapes(info.shiftKey || info.accelKey ? [...selected, this.shapeId] : [this.shapeId])
    this.editor.onArrowLabelPointerDown?.(info)
  }

  onExit(): void {
    this.parent.setCurrentToolIdMask(undefined)
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerMove(): void {
    if (!this.editor.inputs.getIsDragging()) return
    if (this.didCtrlOnEnter) {
      this.parent.transition('brushing', this.info)
      return
    }
    this.didDrag = true
    this.editor.updateArrowLabelPosition?.(this.shapeId, this.info)
  }

  onPointerUp(): void {
    const shape = this.editor.getShape(this.shapeId)
    if (!shape) return
    if (this.didDrag || !this.wasAlreadySelected) this.complete()
    else if (this.editor.canEditShape(shape)) this.editor.startEditingShapeWithRichText?.(shape.id)
  }

  onCancel(): void {
    this.cancel()
  }

  onComplete(): void {
    this.cancel()
  }

  onInterrupt(): void {
    this.cancel()
  }

  private complete(): void {
    finishInteraction(this.editor, this.info, () => this.parent.transition('idle'))
  }

  private cancel(): void {
    this.editor.bailToMark(this.markId)
    finishInteraction(this.editor, this.info, () => this.parent.transition('idle'))
  }
}
