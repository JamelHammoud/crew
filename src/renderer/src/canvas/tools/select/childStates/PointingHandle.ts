import { StateNode } from '../../state'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class PointingHandle extends StateNode<SelectEditor> {
  static id = 'pointing_handle'
  private info: SelectPointerInfo = { target: 'handle' }
  private didCtrlOnEnter = false
  private isDoubleClick = false

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    this.isDoubleClick = false
    this.didCtrlOnEnter = Boolean(info.accelKey)
    this.editor.onPointingHandleEnter?.(info)
    this.editor.setCursor({ type: 'grabbing', rotation: 0 })
  }

  onExit(): void {
    this.editor.setHintingShapes([])
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerUp(): void {
    if (this.isDoubleClick) {
      this.parent.transition('idle')
      this.parent.getCurrent()?.handleEvent({
        ...this.info,
        type: 'click',
        name: 'double_click',
        phase: 'down'
      } as any)
      return
    }
    if (this.editor.onPointingHandlePointerUp?.(this.info)) return
    this.parent.transition('idle', this.info)
  }

  onDoubleClick(info: SelectPointerInfo): void {
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    this.isDoubleClick = true
  }

  onPointerMove(info: SelectPointerInfo): void {
    if (!this.editor.inputs.getIsDragging()) return
    if (this.didCtrlOnEnter) this.parent.transition('brushing', info)
    else this.startDraggingHandle()
  }

  onLongPress(): void {
    this.startDraggingHandle()
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

  private startDraggingHandle(): void {
    if (this.editor.getIsReadonly()) return
    if (this.editor.startDraggingHandle?.(this.info)) return
    this.parent.transition('dragging_handle', this.info)
  }

  private cancel(): void {
    this.parent.transition('idle')
  }
}
