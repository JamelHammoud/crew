import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

describe('bench', () => {
  it('measures a drag', () => {
    const s = new Editor({
      store: createTLStore({ id: 'bench' }),
      shapeUtils: [FrameShapeUtil, GeoShapeUtil, GroupShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    s.setViewportScreenBounds({ x: 0, y: 0, w: 4000, h: 4000 })
    const ids = []
    for (let i = 0; i < 218; i++) {
      const id = createShapeId('s' + i)
      s.createShape({ id, type: 'geo', x: (i % 20) * 90, y: Math.floor(i / 20) * 90, props: { w: 40, h: 40 } })
      ids.push(id)
    }
    const dragged = ids[0]
    s.select(dragged)
    expect(s.getSnappableShapes().length).toBe(217)

    const moves = 300
    let t = performance.now()
    for (let i = 0; i < moves; i++) {
      s.updateShape({ id: dragged, type: 'geo', x: i })
      s.getSnappableShapes()
    }
    const cached = performance.now() - t

    t = performance.now()
    for (let i = 0; i < moves; i++) {
      s.updateShape({ id: dragged, type: 'geo', x: i })
      uncached(s)
    }
    const plain = performance.now() - t
    console.log(`218 shapes, ${moves} pointer moves: cached ${cached.toFixed(1)}ms (${(cached / moves).toFixed(3)}ms/move), uncached ${plain.toFixed(1)}ms (${(plain / moves).toFixed(3)}ms/move)`)
    expect(cached).toBeLessThan(plain)
  })
})

function uncached(e: any) {
  const selected = new Set(e.getSelectedShapeIds())
  const viewport = e.getViewportPageBounds()
  const renderingOnly = new Set(e.getCurrentPageRenderingShapesSorted().map((sh: any) => sh.id))
  return e.getCurrentPageShapesSorted().flatMap((sh: any) => {
    if (selected.has(sh.id) || sh.isLocked || !renderingOnly.has(sh.id)) return []
    if (!e.getShapeUtil(sh).canSnap(sh)) return []
    const pageBounds = e.getShapePageBounds(sh)
    if (!pageBounds || !viewport.includes(pageBounds)) return []
    return [{ id: sh.id, pageBounds, points: pageBounds.cornersAndCenter }]
  })
}
