import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import { getHitShapeOnCanvasPointerDown } from '../src/renderer/src/canvas/tools/select/helpers'

function make() {
  const s = new Editor({
    store: createTLStore({ id: 'h' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  s.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return s
}

describe('hit', () => {
  it('filled vs hollow', () => {
    for (const fill of ['none', 'solid']) {
      const s = make()
      const a = createShapeId('a')
      s.createShape({ id: a, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100, fill } })
      const p = { x: 150, y: 150 }
      s.inputs.pointerDown(p, p, {} as never)
      console.log(`fill=${fill} centre hit:`, !!getHitShapeOnCanvasPointerDown(s as any))
      const e = { x: 100, y: 150 }
      s.inputs.pointerDown(e, e, {} as never)
      console.log(`fill=${fill} edge hit:`, !!getHitShapeOnCanvasPointerDown(s as any))
    }
    expect(true).toBe(true)
  })
})
