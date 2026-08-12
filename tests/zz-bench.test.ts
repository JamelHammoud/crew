import { describe, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const N = 433
function board() {
  const e = new Editor({
    store: createTLStore({ id: 'bench' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  e.setViewportScreenBounds({ x: 0, y: 0, w: 1400, h: 900 })
  const ids: TLShapeId[] = []
  for (let i = 0; i < N; i++) {
    const id = createShapeId(`s-${i}`)
    e.createShape({ id, type: 'geo', x: (i % 30) * 45, y: Math.floor(i / 30) * 45, props: { w: 30, h: 30 } })
    ids.push(id)
  }
  return { e, ids }
}
function time(label: string, runs: number, fn: () => void) {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) fn()
  const ms = (performance.now() - t0) / runs
  console.log(`${label}: ${ms.toFixed(3)} ms`)
}
describe('engine cost on a 433 shape board', () => {
  it('measures the per pointer move primitives', () => {
    const { e, ids } = board()
    time('getCurrentPageShapesSorted (cached)', 200, () => {
      e.getCurrentPageShapesSorted()
    })
    let n = 0
    time('getCurrentPageShapesSorted after a move', 200, () => {
      const s = e.getShape(ids[0])!
      e.updateShape({ id: ids[0], type: s.type, x: s.x + (n++ % 2 ? 1 : -1) })
      e.getCurrentPageShapesSorted()
    })
    time('getCurrentPageRenderingShapesSorted', 200, () => {
      ;(e as any).getCurrentPageRenderingShapesSorted?.()
    })
    time('getViewportPageBounds', 500, () => {
      e.getViewportPageBounds()
    })
    time('one shape page bounds', 500, () => {
      e.getShapePageBounds(ids[5])
    })
    time('all shape page bounds', 20, () => {
      for (const id of ids) e.getShapePageBounds(id)
    })
    time('updateShape alone', 200, () => {
      const s = e.getShape(ids[1])!
      e.updateShape({ id: ids[1], type: s.type, x: s.x + (n++ % 2 ? 1 : -1) })
    })
  })
})
