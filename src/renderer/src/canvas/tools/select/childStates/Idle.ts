import { Vec } from '../../../math'
import { StateNode } from '../../state'
import {
  cancelHoveredShapeUpdate,
  getHitShapeOnCanvasPointerDown,
  selectionContainsPoint,
  updateHoveredShape
} from '../helpers'
import type { SelectEditor, SelectPointerInfo } from '../types'

export const MAJOR_NUDGE_FACTOR = 10
export const MINOR_NUDGE_FACTOR = 1
export const GRID_INCREMENT = 5

export class Idle extends StateNode<SelectEditor> {
  static id = 'idle'
  private selectedShapesOnKeyDown: any[] = []

  onEnter(): void {
    this.parent.setCurrentToolIdMask(undefined)
    this.editor.setCursor({ type: 'default', rotation: 0 })
    updateHoveredShape(this.editor)
    this.selectedShapesOnKeyDown = []
  }

  onExit(): void {
    this.editor.updateInstanceState({ isChangingStyle: false })
    cancelHoveredShapeUpdate(this.editor)
  }

  onPointerMove(): void {
    updateHoveredShape(this.editor)
    if (this.editor.getInstanceState().isChangingStyle) {
      this.editor.updateInstanceState({ isChangingStyle: false })
    }
  }

  onPointerDown(info: SelectPointerInfo): void {
    if (info.target === 'canvas') {
      const point = this.editor.inputs.getCurrentPagePoint()
      const overlay = this.editor.overlays?.getOverlayAtPoint(
        point,
        this.editor.options.hitTestMargin / this.editor.getZoomLevel()
      )
      if (overlay) return this.onPointerDown({ ...info, target: 'overlay', overlay })
      const shape = getHitShapeOnCanvasPointerDown(this.editor)
      if (shape && (this.editor.options.selectLockedShapes || !shape.isLocked)) {
        return this.onPointerDown({ ...info, target: 'shape', shape })
      }
      const selected = this.editor.getSelectedShapeIds()
      if (selected.length > 1 || this.editor.getOnlySelectedShape()) {
        if (selectionContainsPoint(this.editor, point)) {
          return this.onPointerDown({ ...info, target: 'selection' })
        }
      }
      this.parent.transition('pointing_canvas', info)
      return
    }

    if (info.target === 'overlay') {
      const overlay = info.overlay
      const util = this.editor.overlays.getOverlayUtil(overlay)
      if (util.onPointerDown && util.onPointerDown(overlay, info) !== false) return
      if (overlay.type === 'shape_handle') {
        const shape = this.editor.getShape(overlay.props.shapeId)
        if (shape) this.onPointerDown({ ...info, target: 'handle', shape, handle: overlay.props.handle })
      } else {
        this.onPointerDown({ ...info, target: 'selection', handle: overlay.props.handle })
      }
      return
    }

    if (info.target === 'shape') {
      if (!this.editor.options.selectLockedShapes && this.editor.isShapeOrAncestorLocked(info.shape)) {
        this.parent.transition('pointing_canvas', info)
      } else {
        this.parent.transition('pointing_shape', info)
      }
      return
    }

    if (info.target === 'handle') {
      if (this.editor.getIsReadonly()) return
      this.parent.transition(this.editor.inputs.getAltKey() ? 'pointing_shape' : 'pointing_handle', info)
      return
    }

    const rotateHandles = new Set([
      'mobile_rotate',
      'top_left_rotate',
      'top_right_rotate',
      'bottom_left_rotate',
      'bottom_right_rotate'
    ])
    const resizeHandles = new Set([
      'top',
      'right',
      'bottom',
      'left',
      'top_left',
      'top_right',
      'bottom_left',
      'bottom_right'
    ])
    if (rotateHandles.has(info.handle)) {
      this.parent.transition(info.accelKey ? 'brushing' : 'pointing_rotate_handle', info)
    } else if (resizeHandles.has(info.handle)) {
      if (info.ctrlKey && this.editor.canCropShape(this.editor.getOnlySelectedShape())) {
        this.parent.transition('crop.pointing_crop_handle', info)
      } else {
        this.parent.transition(info.accelKey ? 'brushing' : 'pointing_resize_handle', info)
      }
    } else {
      const hovered = this.editor.getHoveredShape()
      if (
        hovered &&
        !this.editor.getSelectedShapeIds().includes(hovered.id) &&
        (this.editor.options.selectLockedShapes || !hovered.isLocked)
      ) {
        this.onPointerDown({ ...info, target: 'shape', shape: hovered })
      } else {
        this.parent.transition('pointing_selection', info)
      }
    }
  }

  onDoubleClick(info: SelectPointerInfo): void {
    if (this.editor.inputs.getShiftKey() || info.phase !== 'down' || info.ctrlKey || info.shiftKey) return
    if (info.target === 'shape') {
      const shape = info.shape
      const util = this.editor.getShapeUtil(shape)
      const change = util.onDoubleClick?.(shape)
      if (change) {
        this.editor.updateShapes([change])
      } else if (util.canCrop?.(shape) && !this.editor.isShapeOrAncestorLocked(shape)) {
        this.editor.markHistoryStoppingPoint('select and crop')
        this.editor.select(shape.id)
        this.parent.transition('crop', info)
      } else if (this.editor.canEditShape(shape)) {
        this.startEditingShape(shape, info, true)
      }
      return
    }
    if (info.target === 'selection') {
      const shape = this.editor.getOnlySelectedShape()
      if (!shape) return
      if (this.editor.canCropShape(shape)) this.parent.transition('crop', info)
      else if (this.editor.canEditShape(shape)) this.startEditingShape(shape, info, true)
      return
    }
    if (info.target === 'handle') {
      const change = this.editor.getShapeUtil(info.shape).onDoubleClickHandle?.(info.shape, info.handle)
      if (change) this.editor.updateShapes([change])
      else if (this.editor.canEditShape(info.shape)) this.startEditingShape(info.shape, info, true)
      return
    }
    const point = this.editor.inputs.getCurrentPagePoint()
    const shape = this.editor.getSelectedShapeAtPoint(point) ?? this.editor.getShapeAtPoint(point)
    if (shape) this.onDoubleClick({ ...info, target: 'shape', shape })
    else this.editor.createTextOnCanvasDoubleClick?.(info)
  }

  onRightClick(info: SelectPointerInfo): void {
    if (info.target === 'canvas') {
      const hit = this.editor.getShapeAtPoint(this.editor.inputs.getCurrentPagePoint(), {
        margin: this.editor.options.hitTestMargin / this.editor.getZoomLevel(),
        hitInside: false,
        hitLabels: true,
        hitLocked: true,
        hitFrameInside: true,
        renderingOnly: true
      })
      if (hit) this.onRightClick({ ...info, target: 'shape', shape: hit })
      else this.editor.selectNone()
      return
    }
    if (info.target !== 'shape') return
    const selected = this.editor.getSelectedShapeIds()
    const shape = this.editor.getOutermostSelectableShape(info.shape, (parent: any) => !selected.includes(parent.id))
    if (!selected.includes(shape.id)) {
      this.editor.markHistoryStoppingPoint('selecting shape')
      this.editor.setSelectedShapes([shape.id])
    }
  }

  onCancel(): void {
    if (
      this.editor.getFocusedGroupId() !== this.editor.getCurrentPageId() &&
      this.editor.getSelectedShapeIds().length
    ) {
      this.editor.popFocusedGroupId()
    } else {
      this.editor.markHistoryStoppingPoint('clearing selection')
      this.editor.selectNone()
    }
  }

  onKeyDown(info: any): void {
    this.selectedShapesOnKeyDown = this.editor.getSelectedShapes()
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(info.code)) {
      if (info.accelKey) {
        this.editor.selectAdjacentShape(info.code.replace('Arrow', '').toLowerCase())
      } else {
        this.nudgeSelectedShapes(false)
      }
    }
  }

  onKeyRepeat(info: any): void {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(info.code)) {
      if (info.accelKey) this.editor.selectAdjacentShape(info.code.replace('Arrow', '').toLowerCase())
      else this.nudgeSelectedShapes(true)
    } else if (info.code === 'Tab' && this.editor.getSelectedShapes().length && !info.altKey) {
      this.editor.selectAdjacentShape(info.shiftKey ? 'prev' : 'next')
    }
  }

  onKeyUp(info: any): void {
    if (info.key === 'Tab' && this.editor.getSelectedShapes().length && !info.altKey) {
      this.editor.selectAdjacentShape(info.shiftKey ? 'prev' : 'next')
      return
    }
    if (info.key !== 'Enter' || !this.selectedShapesOnKeyDown.length) return
    const shape = this.editor.getOnlySelectedShape()
    if (shape && this.editor.canEditShape(shape, { type: 'press_enter' })) {
      this.startEditingShape(shape, { ...info, target: 'shape', shape }, true)
    } else if (this.editor.canCropShape(shape)) {
      this.parent.transition('crop', info)
    }
  }

  private startEditingShape(shape: any, info: any, selectAll: boolean): void {
    this.editor.markHistoryStoppingPoint('editing shape')
    if (this.editor.hasRichText?.(shape)) this.editor.startEditingShapeWithRichText(shape, { selectAll })
    else this.editor.setEditingShape(shape)
    this.parent.transition('editing_shape', info)
  }

  private nudgeSelectedShapes(ephemeral: boolean): void {
    const keys = this.editor.inputs.keys as Set<string>
    const delta = new Vec(0, 0)
    if (keys.has('ArrowLeft')) delta.x -= 1
    if (keys.has('ArrowRight')) delta.x += 1
    if (keys.has('ArrowUp')) delta.y -= 1
    if (keys.has('ArrowDown')) delta.y += 1
    if (delta.equals(new Vec(0, 0))) return
    if (!ephemeral) this.editor.markHistoryStoppingPoint('nudge shapes')
    this.editor.updateInstanceState({ isChangingStyle: true })
    const shift = keys.has('ShiftLeft')
    const settings = this.editor.getDocumentSettings()
    const grid = this.editor.getInstanceState().isGridMode
    const step = grid ? (shift ? settings.gridSize * GRID_INCREMENT : settings.gridSize) : shift ? 10 : 1
    const selected = this.editor.getSelectedShapeIds()
    this.editor.nudgeShapes(selected, delta.mul(step))
    this.editor.kickoutOccludedShapes?.(selected)
  }
}
