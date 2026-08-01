import { Vec } from '../../math'
import type { SelectEditor } from './types'

export type AdjacentDirection = 'left' | 'right' | 'up' | 'down' | 'next' | 'prev'

const SHALLOW_ANGLE = 20
const ROW_THRESHOLD = 100
const DIRECTION_ANGLE = { right: 0, left: 180, down: 90, up: 270 }

interface Placed {
  shape: any
  center: Vec
}

function place(editor: SelectEditor, shapes: any[]): Placed[] {
  return shapes.flatMap((shape: any) => {
    if (!editor.getShapeUtil(shape).canTabTo?.(shape)) return []
    const bounds = editor.getShapePageBounds(shape)
    return bounds ? [{ shape, center: bounds.center }] : []
  })
}

export function shapesInReadingOrder(editor: SelectEditor, shapes: any[]): any[] {
  const placed = place(editor, shapes)
  if (placed.length <= 1) return placed.map(item => item.shape)
  placed.sort((a, b) => a.center.y - b.center.y)

  const rows: Placed[][] = []
  for (const item of placed) {
    let index = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      const last = rows[i][rows[i].length - 1]
      if (Math.abs(item.center.y - last.center.y) < ROW_THRESHOLD) {
        index = i
        break
      }
    }
    if (index === -1) rows.push([item])
    else rows[index].push(item)
  }

  for (const row of rows) {
    row.sort((a, b) => a.center.x - b.center.x)
    if (row.length <= 2) continue
    for (let i = 0; i < row.length - 2; i++) {
      const first = Vec.Dist2(row[i].center, row[i + 1].center)
      const second = Vec.Dist2(row[i].center, row[i + 2].center)
      if (second >= first * 0.9) continue
      const angle = Math.abs(Vec.Angle(row[i].center, row[i + 2].center) * (180 / Math.PI))
      if (angle <= SHALLOW_ANGLE) {
        const swap = row[i + 1]
        row[i + 1] = row[i + 2]
        row[i + 2] = swap
      }
    }
  }

  return rows.flat().map(item => item.shape)
}

export function nearestAdjacentShape(
  editor: SelectEditor,
  shapes: any[],
  currentId: string,
  direction: 'left' | 'right' | 'up' | 'down'
): string {
  const current = editor.getShape(currentId)
  const currentBounds = current && editor.getShapePageBounds(current)
  if (!currentBounds) return currentId
  const currentCenter = currentBounds.center
  const candidates = place(
    editor,
    shapes.filter((shape: any) => shape.id !== currentId)
  ).filter(({ center }) => {
    const dx = center.x - currentCenter.x
    const dy = center.y - currentCenter.y
    if (direction === 'left' || direction === 'right') {
      if (Math.abs(dy) >= Math.abs(dx) * 2) return false
      return direction === 'right' ? dx > 0 : dx < 0
    }
    if (Math.abs(dx) >= Math.abs(dy) * 2) return false
    return direction === 'down' ? dy > 0 : dy < 0
  })
  if (!candidates.length) return currentId

  const horizontal = direction === 'left' || direction === 'right'
  let best = candidates[0]
  let bestScore = Infinity
  for (const candidate of candidates) {
    const { center } = candidate
    const distance = Vec.Dist2(currentCenter, center)
    const along = Math.abs(horizontal ? center.x - currentCenter.x : center.y - currentCenter.y)
    const across = Math.abs(horizontal ? center.y - currentCenter.y : center.x - currentCenter.x)
    const angle = Math.abs(Vec.Angle(currentCenter, center) * (180 / Math.PI))
    const score =
      distance + across * 2 + (distance - along) * 1.5 + Math.abs(angle - DIRECTION_ANGLE[direction]) * 0.5
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best.shape.id
}

export function selectAdjacentShape(editor: SelectEditor, direction: AdjacentDirection): void {
  if (editor.selectAdjacentShape) {
    editor.selectAdjacentShape(direction)
    return
  }
  const selected = editor.getSelectedShapeIds()
  const firstParentId = selected[0] ? editor.getShape(selected[0])?.parentId : null
  const inContainer =
    Boolean(firstParentId) &&
    firstParentId.startsWith('shape:') &&
    selected.every((id: string) => editor.getShape(id)?.parentId === firstParentId)
  const shapes = editor
    .getCurrentPageShapes()
    .filter((shape: any) => (inContainer ? shape.parentId === firstParentId : !shape.parentId.startsWith('shape:')))
  const ordered = shapesInReadingOrder(editor, shapes)
  const currentId =
    selected.length === 1 ? selected[0] : ordered.find((shape: any) => selected.includes(shape.id))?.id

  let nextId: string | undefined
  if (direction === 'next' || direction === 'prev') {
    const ids = ordered.map((shape: any) => shape.id)
    if (!ids.length) return
    const index = currentId ? ids.indexOf(currentId) : -1
    nextId = ids[(index + (direction === 'next' ? 1 : -1) + ids.length) % ids.length]
  } else {
    if (!currentId) return
    nextId = nearestAdjacentShape(editor, shapes, currentId, direction)
  }

  if (!nextId || !editor.getShape(nextId)) return
  editor.setSelectedShapes([nextId])
}

export function selectParentShape(editor: SelectEditor): void {
  if (editor.selectParentShape) {
    editor.selectParentShape()
    return
  }
  const shape = editor.getOnlySelectedShape()
  const parent = shape && editor.getShape(shape.parentId)
  if (!parent) return
  editor.setSelectedShapes([parent.id])
}

export function selectFirstChildShape(editor: SelectEditor): void {
  if (editor.selectFirstChildShape) {
    editor.selectFirstChildShape()
    return
  }
  const shape = editor.getSelectedShapes()[0]
  if (!shape) return
  const children = (editor.getSortedChildIdsForParent?.(shape.id) ?? [])
    .map((id: string) => editor.getShape(id))
    .filter(Boolean)
  const ordered = shapesInReadingOrder(editor, children)
  if (!ordered.length) return
  editor.setSelectedShapes([ordered[0].id])
}
