import { StateNode } from '../../state'
import { selectOnCanvasPointerUp } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class PointingSelection extends StateNode<SelectEditor> {
  static id = 'pointing_selection'

  onPointerUp(info: SelectPointerInfo): void {
    selectOnCanvasPointerUp(this.editor, info)
    this.parent.transition('idle', info)
  }

  onPointerMove(info: SelectPointerInfo): void {
    if (this.editor.inputs.getIsDragging()) this.startTranslating(info)
  }

  onLongPress(info: SelectPointerInfo): void {
    this.startTranslating(info)
  }

  onDoubleClick(info: SelectPointerInfo): void {
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    const point = this.editor.inputs.getCurrentPagePoint()
    const hovered = this.editor.getHoveredShape()
    const hit =
      hovered && !this.editor.isShapeOfType(hovered, 'group')
        ? hovered
        : this.editor.getShapeAtPoint(point, { hitInside: true, margin: 0, renderingOnly: true })
    if (!hit) return
    this.parent.transition('idle')
    this.parent.getCurrent()?.handleEvent({ ...info, target: 'shape', shape: this.editor.getShape(hit) } as any)
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

  private startTranslating(info: SelectPointerInfo): void {
    if (!this.editor.getIsReadonly()) this.parent.transition('translating', info)
  }

  private cancel(): void {
    this.parent.transition('idle')
  }
}
