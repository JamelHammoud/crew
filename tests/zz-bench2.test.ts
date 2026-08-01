import { describe, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const N = 433

function board(): { e: Editor; ids: TLShapeId[] } {
  const e = new Editor({
    store: createTLStore({ id: 'bench2' }),
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

function time(label: string, runs: number, fn: () => void): void {
  fn()
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) fn()
  console.log(`${label}: ${((performance.now() - t0) / runs).toFixed(3)} ms`)
}

describe('what a pointer move really costs on a 433 shape board', () => {
  it('measures the page bounds path the remote cursors subscribe to', () => {
    const { e, ids } = board()
    let n = 0
    const nudge = (): void => {
      const s = e.getShape(ids[0])!
      e.updateShape({ id: ids[0], type: s.type, x: s.x + (n++ % 2 ? 1 : -1) })
    }
    time('getCurrentPageBounds cached', 200, () => {
      e.getCurrentPageBounds()
    })
    time('getCurrentPageBounds after a move', 200, () => {
      nudge()
      e.getCurrentPageBounds()
    })
    time('a move with no bounds read', 200, nudge)
    time('getCamera', 500, () => {
      e.getCamera()
    })
  })
})
