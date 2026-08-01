import type { Box, Vec } from '../math'
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
  others: readonly TLShape[]
  result: SnappableShape[]
}

const memos = new WeakMap<Editor, Memo>()

export function snappableShapes(editor: Editor): SnappableShape[] {
  const pageId = editor.getCurrentPageId()
  const viewport = editor.getViewportPageBounds()
  const selected = editor.getSelectedShapeIds()
  const skip = new Set(selected)
  const others = editor.getCurrentPageShapesSorted().filter(shape => !skip.has(shape.id))
  const memo = memos.get(editor)
  if (memo && isFresh(memo, pageId, viewport, selected, others)) return memo.result
  const result = collect(editor, skip, viewport)
  memos.set(editor, {
    pageId,
    viewport: [viewport.x, viewport.y, viewport.w, viewport.h],
    selected: [...selected],
    others,
    result
  })
  return result
}

function isFresh(
  memo: Memo,
  pageId: TLPageId,
  viewport: Box,
  selected: readonly TLShapeId[],
  others: readonly TLShape[]
): boolean {
  if (memo.pageId !== pageId) return false
  const [x, y, w, h] = memo.viewport
  if (x !== viewport.x || y !== viewport.y || w !== viewport.w || h !== viewport.h) return false
  if (memo.selected.length !== selected.length || memo.others.length !== others.length) return false
  for (let i = 0; i < selected.length; i++) if (memo.selected[i] !== selected[i]) return false
  for (let i = 0; i < others.length; i++) if (memo.others[i] !== others[i]) return false
  return true
}

function collect(editor: Editor, skip: ReadonlySet<TLShapeId>, viewport: Box): SnappableShape[] {
  const found: SnappableShape[] = []
  const seen = new Set<TLShapeId>()
  const add = (id: TLShapeId, pageBounds: Box): void => {
    if (seen.has(id)) return
    seen.add(id)
    found.push({ id, pageBounds, points: pageBounds.cornersAndCenter })
  }
  const walk = (parentId: TLParentId): void => {
    if (parentId.startsWith('shape:')) {
      const parent = editor.getShape(parentId as TLShapeId)
      const bounds = parent && editor.isShapeFrameLike(parent) ? editor.getShapePageBounds(parent) : undefined
      if (parent && bounds) add(parent.id, bounds)
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
      add(childId, pageBounds)
    }
  }
  walk(editor.findCommonAncestor(editor.getSelectedShapes()) ?? editor.getCurrentPageId())
  return found
}
