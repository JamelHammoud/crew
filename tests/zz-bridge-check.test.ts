import { describe, expect, it } from 'vitest'
import { Editor } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/shapes'
import { SelectTool } from '/Users/jamel/Documents/Repositories/crew/src/renderer/src/canvas/tools/select'

function ev(x: number, y: number, extra: any = {}) {
  const el: any = { closest: () => null }
  return {
    clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1,
    pressure: 0.5, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
    target: el, currentTarget: { setPointerCapture: () => {} }, preventDefault: () => {},
    ...extra
  } as any
}

describe('through the real event bridge', () => {
  it('brushes on a drag across empty canvas', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'bridge' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    const a = createShapeId('a')
    subject.createShape({ id: a, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } })
    const h = subject.getCanvasEventHandlers()
    h.onPointerDown(ev(10, 10))
    expect(subject.getCurrentToolPath()).toBe('select.pointing_canvas')
    h.onPointerMove(ev(300, 300))
    expect(subject.getCurrentToolPath()).toBe('select.brushing')
    expect(subject.getSelectedShapeIds()).toEqual([a])
  })

  it('translates on a drag from a shape', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'bridge2' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    const a = createShapeId('a')
    subject.createShape({ id: a, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } })
    const h = subject.getCanvasEventHandlers()
    const shapeEl: any = { closest: (s: string) => (s === '[data-shape-id]' ? { dataset: { shapeId: a } } : null) }
    h.onPointerDown(ev(120, 120, { target: shapeEl }))
    expect(subject.getCurrentToolPath()).toBe('select.pointing_shape')
    h.onPointerMove(ev(220, 220))
    expect(subject.getCurrentToolPath()).toBe('select.translating')
    expect(subject.getShape(a)?.x).toBe(200)
  })
})
