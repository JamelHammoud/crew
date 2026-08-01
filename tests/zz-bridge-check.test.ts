import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

describe('probe', () => {
  it('resolves', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'bridge2' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    const a = createShapeId('a')
    subject.createShape({ id: a, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } })
    console.log('id', a, 'getShape', !!subject.getShape(a))
    console.log('overlayAtPoint', JSON.stringify(subject.overlays.getOverlayAtPoint({ x: 120, y: 120 }, 0)))
    expect(true).toBe(true)
  })
})
