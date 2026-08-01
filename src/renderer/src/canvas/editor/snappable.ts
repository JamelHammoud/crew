import { Box, type Mat, type Vec } from '../math'
import type { TLPageId, TLParentId, TLShape, TLShapeId } from '../schema'
import type { Editor } from './Editor'

export interface SnappableShape {
  id: TLShapeId
  pageBounds: Box
  points: Vec[]
}

interface Memo {
  pageId: TLPageId
  viewport: [number, number, number, number]
  selected: readonly TLShapeId[]
  shapes: readonly TLShape[]
  result: SnappableShape[]
}

interface CachedPoints {
  transform: Mat
  points: Vec[]
}

const memos = new WeakMap<Editor, Memo>()
const pointsOfShape = new WeakMap<TLShape, CachedPoints>()

export function snappableShapes(editor: Editor): SnappableShape[] {
  const pageId = editor.getCurrentPageId()
  const viewport = editor.getViewportPageBounds()
  const selected = editor.getSelectedShapeIds()
  const skip = new Set(selected)
  const shapes = editor.store.query('shape').get()
  const memo = memos.get(editor)
  if (memo && isFresh(memo, pageId, viewport, selected, shapes, skip)) return memo.result
  const result = collect(editor, skip, viewport)
  memos.set(editor, {
    pageId,
    viewport: [viewport.x, viewport.y, viewport.w, viewport.h],
    selected: [...selected],
    shapes,
    result
  })
  return result
}

function isFresh(
  memo: Memo,
  pageId: TLPageId,
  viewport: Box,
  selected: readonly TLShapeId[],
  shapes: readonly TLShape[],
  skip: ReadonlySet<TLShapeId>
): boolean {
  if (memo.pageId !== pageId) return false
  const [x, y, w, h] = memo.viewport
  if (x !== viewport.x || y !== viewport.y || w !== viewport.w || h !== viewport.h) return false
  if (memo.selected.length !== selected.length) return false
  for (let i = 0; i < selected.length; i++) if (memo.selected[i] !== selected[i]) return false
  if (memo.shapes === shapes) return true
  if (memo.shapes.length !== shapes.length) return false
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]
    const before = memo.shapes[i]
    if (shape === before) continue
    if (shape.id !== before.id) return false
    if (!skip.has(shape.id)) return false
  }
  return true
}

function snapPoints(editor: Editor, shape: TLShape, pageBounds: Box): Vec[] {
  const transform = editor.getShapePageTransform(shape)
  const cached = pointsOfShape.get(shape)
  if (cached && cached.transform.equals(transform)) return cached.points
  const bounds = editor.getShapeGeometry(shape).bounds
  if (!Number.isFinite(bounds.w) || !Number.isFinite(bounds.h)) return pageBounds.cornersAndCenter
  const points = transform.applyToPoints(bounds.cornersAndCenter)
  pointsOfShape.set(shape, { transform, points })
  return points
}

function collect(editor: Editor, skip: ReadonlySet<TLShapeId>, viewport: Box): SnappableShape[] {
  const found: SnappableShape[] = []
  const seen = new Set<TLShapeId>()
  const add = (shape: TLShape, pageBounds: Box): void => {
    if (seen.has(shape.id)) return
    seen.add(shape.id)
    found.push({ id: shape.id, pageBounds, points: snapPoints(editor, shape, pageBounds) })
  }
  const walk = (parentId: TLParentId): void => {
    if (parentId.startsWith('shape:')) {
      const parent = editor.getShape(parentId as TLShapeId)
      const bounds = parent && editor.isShapeFrameLike(parent) ? editor.getShapePageBounds(parent) : undefined
      if (parent && bounds) add(parent, bounds)
    }
    for (const childId of editor.getSortedChildIdsForParent(parentId)) {
      if (skip.has(childId)) continue
      const child = editor.getShape(childId)
      if (!child || editor.isShapeHidden(child)) continue
      if (!editor.getShapeUtil(child).canSnap(child as never)) continue
      const pageBounds = editor.getShapePageBounds(childId)
      if (!pageBounds || !viewport.includes(pageBounds)) continue
      if (editor.isShapeOfType(child, 'group')) {
        walk(childId)
        continue
      }
      add(child, pageBounds)
    }
  }
  walk(editor.findCommonAncestor(editor.getSelectedShapes()) ?? editor.getCurrentPageId())
  return found
}
