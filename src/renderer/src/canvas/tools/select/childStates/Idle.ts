import { Vec } from '../../../math'
import { StateNode } from '../../state'
import { selectAdjacentShape, selectFirstChildShape, selectParentShape } from '../adjacent'
import {
  cancelHoveredShapeUpdate,
  getHitShapeOnCanvasPointerDown,
  selectionContainsPoint,
  selectOnCanvasPointerUp,
  updateHoveredShape
} from '../helpers'
import { findShapeAncestor, getShapeParent, selectionHasBoundsBg } from '../shapeTree'
import type { SelectEditor, SelectPointerInfo } from '../types'

export const MAJOR_NUDGE_FACTOR = 10
export const MINOR_NUDGE_FACTOR = 1
export const GRID_INCREMENT = 5

const ROTATE_HANDLES = new Set([
  'mobile_rotate',
  'top_left_rotate',
  'top_right_rotate',
  'bottom_left_rotate',
  'bottom_right_rotate'
])
const EDGE_HANDLES = new Set(['top', 'right', 'bottom', 'left'])
const CORNER_HANDLES = new Set(['top_left', 'top_right', 'bottom_left', 'bottom_right'])
const ARROW_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

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
      if (selectionHasBoundsBg(this.editor) && selectionContainsPoint(this.editor, point)) {
        return this.onPointerDown({ ...info, target: 'selection' })
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

    if (ROTATE_HANDLES.has(info.handle)) {
      this.parent.transition(info.accelKey ? 'brushing' : 'pointing_rotate_handle', info)
    } else if (EDGE_HANDLES.has(info.handle) || CORNER_HANDLES.has(info.handle)) {
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
    if (info.target === 'shape') return this.doubleClickShape(info)
    if (info.target === 'selection') return this.doubleClickSelection(info)
    if (info.target === 'handle') return this.doubleClickHandle(info)
    this.doubleClickCanvas(info)
  }

  private doubleClickCanvas(info: SelectPointerInfo): void {
    const point = this.editor.inputs.getCurrentPagePoint()
    const margin = this.editor.options.hitTestMargin / this.editor.getZoomLevel()
    const overlay = this.editor.overlays?.getOverlayAtPoint(point, margin)
    if (overlay) {
      if (overlay.type === 'shape_handle') {
        const shape = this.editor.getShape(overlay.props.shapeId)
        if (shape) {
          return this.onDoubleClick({ ...info, target: 'handle', shape, handle: overlay.props.handle })
        }
      }
      if (overlay.props.handle) {
        return this.onDoubleClick({ ...info, target: 'selection', handle: overlay.props.handle })
      }
    }

    const hovered = this.editor.getHoveredShape()
    const hit =
      hovered && !this.editor.isShapeOfType(hovered, 'group')
        ? hovered
        : (this.editor.getSelectedShapeAtPoint(point) ??
          this.editor.getShapeAtPoint(point, { margin, hitInside: false }))

    if (hit) {
      if (this.editor.isShapeOfType(hit, 'group')) {
        selectOnCanvasPointerUp(this.editor, info)
        return
      }
      const parent = getShapeParent(this.editor, hit)
      if (parent && this.editor.isShapeOfType(parent, 'group')) {
        if (parent.id !== this.editor.getFocusedGroupId()) {
          selectOnCanvasPointerUp(this.editor, info)
          return
        }
      }
      this.onDoubleClick({ ...info, target: 'shape', shape: hit })
      return
    }

    this.createTextOnCanvas(info)
  }

  private doubleClickSelection(info: SelectPointerInfo): void {
    const shape = this.editor.getOnlySelectedShape()
    if (!shape) return
    const util = this.editor.getShapeUtil(shape)
    const isEdge = EDGE_HANDLES.has(info.handle)
    const isCorner = CORNER_HANDLES.has(info.handle)

    if (this.editor.getIsReadonly()) {
      const type = isCorner ? 'double-click-corner' : isEdge ? 'double-click-edge' : 'double-click'
      if (this.editor.canEditShape(shape, { type })) this.startEditingShape(shape, info, true)
      return
    }

    if (isEdge) {
      const change = util.onDoubleClickEdge?.(shape, info)
      if (change) {
        this.editor.markHistoryStoppingPoint('double click edge')
        this.editor.updateShapes([change])
        this.editor.kickoutOccludedShapes?.([shape.id])
        return
      }
    }

    if (isCorner) {
      const change = util.onDoubleClickCorner?.(shape, info)
      if (change) {
        this.editor.markHistoryStoppingPoint('double click corner')
        this.editor.updateShapes([change])
        this.editor.kickoutOccludedShapes?.([shape.id])
        return
      }
    }

    if (this.editor.canCropShape(shape)) {
      this.parent.transition('crop', info)
      return
    }

    if (this.editor.canEditShape(shape)) this.startEditingShape(shape, info, true)
  }

  private doubleClickShape(info: SelectPointerInfo): void {
    const shape = info.shape
    if (shape.type !== 'video' && shape.type !== 'embed' && this.editor.getIsReadonly()) return
    const util = this.editor.getShapeUtil(shape)

    if (util.onDoubleClick) {
      const change = util.onDoubleClick(shape)
      if (change) {
        this.editor.updateShapes([change])
        return
      }
    }

    if (util.canCrop?.(shape) && !this.editor.isShapeOrAncestorLocked(shape)) {
      this.editor.markHistoryStoppingPoint('select and crop')
      this.editor.select(shape.id)
      this.parent.transition('crop', info)
      return
    }

    if (this.editor.canEditShape(shape)) this.startEditingShape(shape, info, true)
    else this.createTextOnCanvas(info)
  }

  private doubleClickHandle(info: SelectPointerInfo): void {
    if (this.editor.getIsReadonly()) return
    const change = this.editor.getShapeUtil(info.shape).onDoubleClickHandle?.(info.shape, info.handle)
    if (change) this.editor.updateShapes([change])
    else if (this.editor.canEditShape(info.shape)) this.startEditingShape(info.shape, info, true)
  }

  onRightClick(info: SelectPointerInfo): void {
    if (info.target === 'canvas') {
      const point = this.editor.inputs.getCurrentPagePoint()
      if (selectionHasBoundsBg(this.editor) && selectionContainsPoint(this.editor, point)) {
        return this.onRightClick({ ...info, target: 'selection' })
      }
      const hovered = this.editor.getHoveredShape()
      const hit =
        hovered && !this.editor.isShapeOfType(hovered, 'group')
          ? hovered
          : this.editor.getShapeAtPoint(point, {
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
    if (
      !selected.includes(shape.id) &&
      !findShapeAncestor(this.editor, shape, (ancestor: any) => selected.includes(ancestor.id))
    ) {
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
    if (!ARROW_CODES.includes(info.code)) return
    if (info.accelKey) {
      if (info.shiftKey) {
        if (info.code === 'ArrowDown') selectFirstChildShape(this.editor)
        else if (info.code === 'ArrowUp') selectParentShape(this.editor)
        return
      }
      selectAdjacentShape(this.editor, info.code.replace('Arrow', '').toLowerCase())
      return
    }
    this.nudgeSelectedShapes(false)
  }

  onKeyRepeat(info: any): void {
    if (ARROW_CODES.includes(info.code)) {
      if (info.accelKey) selectAdjacentShape(this.editor, info.code.replace('Arrow', '').toLowerCase())
      else this.nudgeSelectedShapes(true)
      return
    }
    if (info.code === 'Tab' && this.editor.getSelectedShapes().length && !info.altKey) {
      selectAdjacentShape(this.editor, info.shiftKey ? 'prev' : 'next')
    }
  }

  onKeyUp(info: any): void {
    if (info.key === 'Tab') {
      if (this.editor.getSelectedShapes().length && !info.altKey) {
        selectAdjacentShape(this.editor, info.shiftKey ? 'prev' : 'next')
      }
      return
    }
    if (info.key !== 'Enter' || !this.selectedShapesOnKeyDown.length) return

    const selected = this.editor.getSelectedShapes()
    if (selected.length && selected.every((shape: any) => this.editor.isShapeOfType(shape, 'group'))) {
      this.editor.setSelectedShapes(
        selected.flatMap((shape: any) => this.editor.getSortedChildIdsForParent(shape.id))
      )
      return
    }

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

  private createTextOnCanvas(info: SelectPointerInfo): void {
    if (this.editor.getIsReadonly()) return
    if (this.editor.options.createTextOnCanvasDoubleClick === false) return
    if (this.editor.createTextOnCanvasDoubleClick) {
      this.editor.createTextOnCanvasDoubleClick(info)
      return
    }
    if (!this.editor.getShapeUtil.length) return

    this.editor.markHistoryStoppingPoint('creating text shape')
    const { x, y } = this.editor.inputs.getCurrentPagePoint()
    const created = this.editor.createShape({ type: 'text', x, y, props: { autoSize: true } })
    const id = created?.id ?? this.editor.getOnlySelectedShapeId?.()
    const shape = id && this.editor.getShape(id)
    if (!shape || !this.editor.canEditShape(shape)) return
    this.editor.startEditingShapeWithRichText?.(shape, { info })
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
    const step = grid
      ? shift
        ? settings.gridSize * GRID_INCREMENT
        : settings.gridSize
      : shift
        ? MAJOR_NUDGE_FACTOR
        : MINOR_NUDGE_FACTOR
    const selected = this.editor.getSelectedShapeIds()
    this.editor.nudgeShapes(selected, delta.mul(step))
    this.editor.kickoutOccludedShapes?.(selected)
  }
}
