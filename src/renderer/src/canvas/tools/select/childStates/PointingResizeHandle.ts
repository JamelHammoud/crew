import { StateNode } from '../../state'
import { finishInteraction } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export const CursorTypeMap: Record<string, string> = {
  bottom: 'ns-resize',
  top: 'ns-resize',
  left: 'ew-resize',
  right: 'ew-resize',
  bottom_left: 'nesw-resize',
  bottom_right: 'nwse-resize',
  top_left: 'nwse-resize',
  top_right: 'nesw-resize',
  bottom_left_rotate: 'swne-rotate',
  bottom_right_rotate: 'senw-rotate',
  top_left_rotate: 'nwse-rotate',
  top_right_rotate: 'nesw-rotate',
  mobile_rotate: 'grabbing'
}

export class PointingResizeHandle extends StateNode<SelectEditor> {
  static id = 'pointing_resize_handle'
  private info: SelectPointerInfo = { target: 'selection' }

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    if (typeof info.onInteractionEnd === 'string') this.parent.setCurrentToolIdMask(info.onInteractionEnd)
    this.updateCursor()
  }

  onExit(): void {
    this.parent.setCurrentToolIdMask(undefined)
  }

  onPointerMove(): void {
    if (this.editor.inputs.getIsDragging()) this.startResizing()
  }

  onLongPress(): void {
    this.startResizing()
  }

  onPointerUp(): void {
    this.finish()
  }

  onDoubleClick(info: SelectPointerInfo): void {
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    this.parent.transition('idle')
    this.parent.getCurrent()?.handleEvent(info as any)
  }

  onCancel(): void {
    this.finish()
  }

  onComplete(): void {
    this.finish()
  }

  onInterrupt(): void {
    this.finish()
  }

  private updateCursor(): void {
    this.editor.setCursor({
      type: CursorTypeMap[this.info.handle],
      rotation: this.editor.getSelectionRotation()
    })
  }

  private startResizing(): void {
    if (!this.editor.getIsReadonly()) this.parent.transition('resizing', this.info)
  }

  private finish(): void {
    finishInteraction(this.editor, this.info, () => this.parent.transition('idle'))
  }
}
