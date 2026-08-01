import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

describe('probe', () => {
  it('resolves', () => {
    const subject = new Editor({
      store: createTLStore({ id: 'b3' }),
      shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
      tools: [SelectTool],
      getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
    })
    subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
    const a = createShapeId('a')
    subject.createShape({ id: a, type: 'geo', x: 100, y: 100, props: { w: 100, h: 100 } })
    console.log('locked?', subject.isShapeOrAncestorLocked(subject.getShape(a)!))
    console.log('selectLockedShapes', subject.options.selectLockedShapes)
    const seen: any[] = []
    const orig = (subject as any).tools.dispatch.bind((subject as any).tools)
    ;(subject as any).tools.dispatch = (info: any) => { seen.push({ name: info.name, target: info.target }); return orig(info) }
    const el: any = { closest: (s: string) => (s === '[data-shape-id]' ? { dataset: { shapeId: a } } : null) }
    subject.getCanvasEventHandlers().onPointerDown({
      clientX: 120, clientY: 120, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, pressure: 0.5,
      shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
      target: el, currentTarget: { setPointerCapture: () => {} }, preventDefault: () => {}
    } as any)
    console.log('dispatched', JSON.stringify(seen), 'path', subject.getCurrentToolPath())
    expect(true).toBe(true)
  })
})
