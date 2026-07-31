import { StateNode } from '../../state'
import { cancelHoveredShapeUpdate, getHitShapeOnCanvasPointerDown, updateHoveredShape } from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export class EditingShape extends StateNode<SelectEditor> {
  static id = 'editing_shape'
  private hitLabelOnShapeForPointerUp: any = null
  private didPointerDownOnEditingShape = false
  private info: Record<string, any> = {}

  onEnter(info: Record<string, any>): void {
    const shape = this.editor.getEditingShape()
    if (!shape) throw new Error('Entered editing state without an editing shape')
    this.info = info
    this.hitLabelOnShapeForPointerUp = null
    this.didPointerDownOnEditingShape = false
    if (info.isCreatingTextWhileToolLocked) this.parent.setCurrentToolIdMask('text')
    this.editor.setCursor({ type: 'default', rotation: 0 })
    updateHoveredShape(this.editor)
    this.editor.select(shape)
  }

  onExit(): void {
    const hadEditingShape = Boolean(this.editor.getEditingShapeId())
    this.editor.setEditingShape(null)
    cancelHoveredShapeUpdate(this.editor)
    if (this.info.isCreatingTextWhileToolLocked && hadEditingShape) {
      this.parent.setCurrentToolIdMask(undefined)
      this.editor.setCurrentTool('text', {})
    }
  }

  onPointerMove(info: SelectPointerInfo): void {
    if (this.hitLabelOnShapeForPointerUp && this.editor.inputs.getIsDragging()) {
      if (this.editor.getIsReadonly() || this.hitLabelOnShapeForPointerUp.isLocked) return
      this.editor.select(this.hitLabelOnShapeForPointerUp)
      this.parent.transition('translating', info)
      this.hitLabelOnShapeForPointerUp = null
      return
    }
    if (this.didPointerDownOnEditingShape && this.editor.inputs.getIsDragging()) {
      const shape = this.editor.getEditingShape()
      if (!this.editor.getIsReadonly() && shape && !shape.isLocked && !this.editor.isTextInputFocused?.()) {
        this.editor.select(shape)
        this.parent.transition('translating', info)
      }
      this.didPointerDownOnEditingShape = false
      return
    }
    if (info.target === 'shape' || info.target === 'canvas') updateHoveredShape(this.editor)
  }

  onPointerDown(info: SelectPointerInfo): void {
    this.hitLabelOnShapeForPointerUp = null
    this.didPointerDownOnEditingShape = false
    if (info.target === 'canvas') {
      const shape = getHitShapeOnCanvasPointerDown(this.editor, true)
      if (shape) return this.onPointerDown({ ...info, target: 'shape', shape })
    } else if (info.target === 'shape') {
      const editing = this.editor.getEditingShape()
      if (!editing) throw new Error('Expected an editing shape')
      if (info.shape.id === editing.id) {
        this.didPointerDownOnEditingShape = true
        return
      }
      if (this.editor.isPointInShapeLabel?.(info.shape, this.editor.inputs.getCurrentPagePoint())) {
        this.hitLabelOnShapeForPointerUp = info.shape
        this.editor.markHistoryStoppingPoint('editing on pointer up')
        this.editor.select(info.shape.id)
        return
      }
      this.parent.transition('pointing_shape', info)
      return
    }
    this.parent.transition('idle', info)
    this.editor.root?.handleEvent(info)
  }

  onPointerUp(info: SelectPointerInfo): void {
    if (this.didPointerDownOnEditingShape) {
      this.didPointerDownOnEditingShape = false
      if (!this.editor.isTextInputFocused?.()) this.editor.getRichTextEditor?.()?.commands.focus('all')
      return
    }
    const shape = this.hitLabelOnShapeForPointerUp
    this.hitLabelOnShapeForPointerUp = null
    if (!shape || shape.isLocked) return
    const util = this.editor.getShapeUtil(shape)
    if (this.editor.getIsReadonly() && !util.canEditInReadonly(shape)) {
      this.parent.transition('pointing_shape', info)
      return
    }
    this.editor.select(shape.id)
    this.editor.setEditingShape(shape.id)
    this.editor.emit?.('place-caret', { shapeId: shape.id, point: info.point })
    updateHoveredShape(this.editor)
  }

  onComplete(info: SelectPointerInfo): void {
    this.editor.getContainer().focus()
    this.parent.transition('idle', info)
  }

  onCancel(info: SelectPointerInfo): void {
    this.editor.getContainer().focus()
    this.parent.transition('idle', info)
  }
}
