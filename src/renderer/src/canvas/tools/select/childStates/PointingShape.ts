import { StateNode } from '../../state'
import { findShapeAncestor } from '../../shapeTree'
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
    const selectedAncestor = findShapeAncestor(this.editor, outermost, (shape: any) => selected.includes(shape.id))
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
    const focusedGroupId = this.editor.getFocusedGroupId()
    const point = this.editor.inputs.getCurrentPagePoint()
    const additive = Boolean(info.shiftKey || info.accelKey)
    const pressed = this.editor.getShape(this.hitShape.id)
    const hit =
      pressed ??
      this.editor.getShapeAtPoint(point, {
        margin: this.editor.options.hitTestMargin / this.editor.getZoomLevel(),
        hitInside: true,
        renderingOnly: true
      })
    if (!hit || !this.editor.getShape(hit.id)) {
      this.parent.transition('idle', info)
      return
    }

    const selecting = this.editor.getOutermostSelectableShape(hit) ?? this.hitShapeForPointerUp
    if (selecting) {
      const util = this.editor.getShapeUtil(selecting)
      if (util.onClick) {
        const change = util.onClick(selecting)
        if (change) {
          this.editor.markHistoryStoppingPoint('shape on click')
          this.editor.updateShapes([change])
          this.parent.transition('idle', info)
          return
        }
      }
      if (selecting.id === focusedGroupId) {
        if (selected.length > 0) {
          this.editor.markHistoryStoppingPoint('clearing shape ids')
          this.editor.setSelectedShapes([])
        } else {
          this.editor.popFocusedGroupId()
        }
        this.parent.transition('idle', info)
        return
      }
    }

    if (!this.didSelectOnEnter) {
      const outermost = this.editor.getOutermostSelectableShape(hit, (parent: any) => !selected.includes(parent.id))
      if (selected.includes(outermost.id)) {
        if (additive) {
          this.editor.markHistoryStoppingPoint('deselecting on pointer up')
          this.editor.deselect(selecting)
        } else if (selected.includes(selecting.id)) {
          if (selected.length === 1 && this.editLabelAtPoint(selecting, point, info)) return
          this.editor.markHistoryStoppingPoint('selecting on pointer up')
          this.editor.select(selecting.id)
        } else {
          this.editor.markHistoryStoppingPoint('selecting on pointer up')
          this.editor.select(selecting)
        }
      } else if (additive) {
        const ancestors = this.editor.getShapeAncestors?.(outermost) ?? []
        this.editor.markHistoryStoppingPoint('shift deselecting on pointer up')
        this.editor.setSelectedShapes([
          ...selected.filter((id: any) => !ancestors.some((ancestor: any) => ancestor.id === id)),
          outermost.id
        ])
      } else {
        this.editor.markHistoryStoppingPoint('selecting on pointer up')
        this.editor.setSelectedShapes([outermost.id])
      }
    }

    this.parent.transition('idle', info)
  }

  private editLabelAtPoint(shape: any, point: any, info: SelectPointerInfo): boolean {
    if (!this.editor.isPointInShapeLabel?.(shape, point)) return false
    this.editor.markHistoryStoppingPoint('editing on pointer up')
    this.editor.select(shape.id)
    if (!this.editor.canEditShape(shape)) return true
    this.editor.setEditingShape(shape.id)
    this.parent.transition('editing_shape', { ...info, target: 'shape', shape })
    this.editor.emit?.(this.isDoubleClick ? 'select-all-text' : 'place-caret', {
      shapeId: shape.id,
      point: info.point
    })
    return true
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
