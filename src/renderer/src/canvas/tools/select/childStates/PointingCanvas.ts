import { StateNode } from '../../state'
import { selectOnCanvasPointerUp } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class PointingCanvas extends StateNode<SelectEditor> {
  static id = 'pointing_canvas'

  onEnter(info: SelectPointerInfo): void {
    if (!info.shiftKey && !info.accelKey && this.editor.getSelectedShapeIds().length) {
      this.editor.markHistoryStoppingPoint('selecting none')
      this.editor.selectNone()
    }
  }

  onPointerMove(info: SelectPointerInfo): void {
    if (this.editor.inputs.getIsDragging()) this.parent.transition('brushing', info)
  }

  onPointerUp(info: SelectPointerInfo): void {
    selectOnCanvasPointerUp(this.editor, info)
    this.complete()
  }

  onDoubleClick(info: SelectPointerInfo): void {
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    this.parent.transition('idle')
    this.parent.getCurrent()?.handleEvent(info as any)
  }

  onComplete(): void {
    this.complete()
  }

  onInterrupt(): void {
    this.complete()
  }

  private complete(): void {
    this.parent.transition('idle')
  }
}
