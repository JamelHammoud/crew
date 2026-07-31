import { StateNode } from '../../state'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class PointingShape extends StateNode<SelectEditor> {
  static id = 'pointing_shape'
  private hitShape: any
  private hitShapeForPointerUp: any
  private didCtrlOnEnter = false
  private didSelectOnEnter = false
  private isDoubleClick = false

  onEnter(info: SelectPointerInfo): void {
    const selected = this.editor.getSelectedShapeIds()
    const outermost = this.editor.getOutermostSelectableShape(info.shape)
    const selectedAncestor = this.editor.findShapeAncestor?.(outermost, (shape: any) => selected.includes(shape.id))
    const inSelection =
      selected.length > 1 &&
      this.editor.getSelectionRotatedPageBounds?.()?.containsPoint(this.editor.inputs.getCurrentPagePoint())
    this.hitShape = info.shape
    this.isDoubleClick = false
    this.didCtrlOnEnter = Boolean(info.accelKey)
    if (
      this.didCtrlOnEnter ||
      this.editor.getShapeUtil(info.shape).onClick ||
      outermost.id === this.editor.getFocusedGroupId() ||
      selected.includes(outermost.id) ||
      selectedAncestor ||
      inSelection
    ) {
      this.didSelectOnEnter = false
      this.hitShapeForPointerUp = outermost
      return
    }
    this.didSelectOnEnter = true
    if (info.shiftKey && !info.altKey) {
      this.editor.cancelDoubleClick()
      if (!selected.includes(outermost.id)) {
        this.editor.markHistoryStoppingPoint('shift selecting shape')
        this.editor.setSelectedShapes([...selected, outermost.id])
      }
    } else {
      this.editor.markHistoryStoppingPoint('selecting shape')
      this.editor.setSelectedShapes([outermost.id])
    }
  }

  onPointerMove(info: SelectPointerInfo): void {
    if (!this.editor.inputs.getIsDragging()) return
    if (this.editor.isOverArrowLabel?.(this.hitShape)) {
      this.parent.transition('pointing_arrow_label', { ...info, shape: this.hitShape })
    } else if (this.didCtrlOnEnter) {
      this.parent.transition('brushing', info)
    } else {
      this.startTranslating(info)
    }
  }

  onLongPress(info: SelectPointerInfo): void {
    this.startTranslating(info)
  }

  onPointerUp(info: SelectPointerInfo): void {
    const selected = this.editor.getSelectedShapeIds()
    const point = this.editor.inputs.getCurrentPagePoint()
    const hit =
      this.editor.getShapeAtPoint(point, {
        margin: this.editor.options.hitTestMargin / this.editor.getZoomLevel(),
        hitInside: true,
        renderingOnly: true
      }) ?? this.hitShape
    if (!hit || !this.editor.getShape(hit.id)) {
      this.parent.transition('idle', info)
      return
    }
    const selecting = this.editor.getOutermostSelectableShape(hit)
    if (!this.didSelectOnEnter) {
      if ((info.shiftKey || info.accelKey) && selected.includes(selecting.id)) {
        this.editor.markHistoryStoppingPoint('deselecting on pointer up')
        this.editor.deselect(selecting)
      } else {
        this.editor.markHistoryStoppingPoint('selecting on pointer up')
        this.editor.select(selecting.id)
      }
    }
    this.parent.transition('idle', info)
  }

  onDoubleClick(info: SelectPointerInfo): void {
    this.isDoubleClick = true
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    const { shape: _shape, ...canvasInfo } = info
    this.parent.transition('idle')
    this.parent.getCurrent()?.handleEvent({ ...canvasInfo, target: 'canvas' } as any)
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
    if (this.editor.getIsReadonly()) return
    if (!this.didSelectOnEnter && !this.editor.getSelectedShapeIds().length && this.hitShapeForPointerUp) {
      this.editor.markHistoryStoppingPoint('selecting shape')
      this.editor.setSelectedShapes([this.hitShapeForPointerUp.id])
    }
    this.editor.focus()
    this.parent.transition('translating', info)
  }

  private cancel(): void {
    this.parent.transition('idle')
  }
}
