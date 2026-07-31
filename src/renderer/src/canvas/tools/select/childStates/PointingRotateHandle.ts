import { StateNode } from '../../state'
import { finishInteraction } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'
import { CursorTypeMap } from './PointingResizeHandle'

export class PointingRotateHandle extends StateNode<SelectEditor> {
  static id = 'pointing_rotate_handle'
  private info: SelectPointerInfo = { target: 'selection' }

  onEnter(info: SelectPointerInfo): void {
    this.info = info
    if (typeof info.onInteractionEnd === 'string') this.parent.setCurrentToolIdMask(info.onInteractionEnd)
    this.editor.setCursor({ type: CursorTypeMap[info.handle], rotation: this.editor.getSelectionRotation() })
  }

  onExit(): void {
    this.parent.setCurrentToolIdMask(undefined)
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }

  onPointerMove(): void {
    if (this.editor.inputs.getIsDragging()) this.startRotating()
  }

  onLongPress(): void {
    this.startRotating()
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

  private startRotating(): void {
    if (!this.editor.getIsReadonly()) this.parent.transition('rotating', this.info)
  }

  private finish(): void {
    finishInteraction(this.editor, this.info, () => this.parent.transition('idle'))
  }
}
