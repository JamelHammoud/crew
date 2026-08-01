import { Vec } from '../../math'
import type { SelectEditor, SelectPointerInfo } from './types'

export function getHitShapeOnCanvasPointerDown(editor: SelectEditor, hitLabels = false): any {
  const point = editor.inputs.getCurrentPagePoint()
  return (
    editor.getShapeAtPoint(point, {
      hitInside: false,
      hitLabels,
      hitLocked: editor.options.selectLockedShapes,
      margin: editor.options.hitTestMargin / editor.getZoomLevel(),
      renderingOnly: true
    }) ?? editor.getSelectedShapeAtPoint(point)
  )
}

export function selectOnCanvasPointerUp(editor: SelectEditor, info: SelectPointerInfo): void {
  const selected = editor.getSelectedShapeIds()
  const point = editor.inputs.getCurrentPagePoint()
  const additive = info.shiftKey || info.accelKey
  const selectLockedShapes = editor.options.selectLockedShapes
  const hit = editor.getShapeAtPoint(point, {
    hitInside: false,
    margin: editor.options.hitTestMargin / editor.getZoomLevel(),
    hitLabels: true,
    hitLocked: selectLockedShapes,
    renderingOnly: true,
    filter: (shape: any) => selectLockedShapes || !shape.isLocked
  })
  if (!hit) {
    if (additive) return
    if (selected.length) {
      editor.markHistoryStoppingPoint('selecting none')
      editor.selectNone()
    }
    const focused = editor.getFocusedGroupId()
    if (typeof focused === 'string' && focused.startsWith('shape:')) {
      const group = editor.getShape(focused)
      if (!group || !editor.isPointInShape(group, point, { margin: 0, hitInside: true })) {
        editor.setFocusedGroup(null)
      }
    }
    return
  }
  const outermost = editor.getOutermostSelectableShape(hit)
  if (additive && !info.altKey) {
    editor.cancelDoubleClick()
    if (selected.includes(outermost.id)) {
      editor.markHistoryStoppingPoint('deselecting shape')
      editor.deselect(outermost)
    } else {
      editor.markHistoryStoppingPoint('shift selecting shape')
      editor.setSelectedShapes([...selected, outermost.id])
    }
    return
  }
  const focused = editor.getFocusedGroupId()
  const next = outermost === hit || outermost.id === focused || selected.includes(outermost.id) ? hit : outermost
  if (!selected.includes(next.id)) {
    editor.markHistoryStoppingPoint('selecting shape')
    editor.select(next.id)
  }
}

export function updateHoveredShape(editor: SelectEditor): void {
  if (editor.updateHoveredOverlayId?.()) return
  editor.updateHoveredShapeId?.()
}

export function cancelHoveredShapeUpdate(editor: SelectEditor): void {
  editor.cancelUpdateHoveredShapeId?.()
}

export function finishInteraction(editor: SelectEditor, info: SelectPointerInfo, fallback: () => void): void {
  const end = info.onInteractionEnd
  if (!end) {
    fallback()
  } else if (typeof end === 'string') {
    editor.setCurrentTool(end, {})
  } else {
    end()
  }
}

export function selectionContainsPoint(editor: SelectEditor, point: any): boolean {
  const bounds = editor.getSelectionRotatedPageBounds?.()
  if (!bounds) return false
  const rotation = editor.getSelectionRotation?.() ?? 0
  if (!rotation) return bounds.containsPoint(point)
  const corners = bounds.corners.map((corner: any) => Vec.RotWith(corner, bounds.point, rotation))
  let inside = false
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i]
    const b = corners[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}
