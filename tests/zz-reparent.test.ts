import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function ed(): Editor {
  const e = new Editor({
    store: createTLStore({ id: 'rp' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  e.setViewportScreenBounds({ x: 0, y: 0, w: 900, h: 700 })
  return e
}

function pointer(e: Editor, name: string, x: number, y: number): void {
  e.dispatch({
    name,
    type: 'pointer',
    target: 'canvas',
    point: { x, y },
    button: 0,
    isPen: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    accelKey: false,
    pointerId: 1
  } as never)
}

describe('dragging a shape onto a frame', () => {
  it('reparents it into the frame the way tldraw does', () => {
    const e = ed()
    const frame = createShapeId('frame')
    e.createShape({ id: frame, type: 'frame', x: 300, y: 60, props: { w: 300, h: 300, name: 'Card' } })
    const box = createShapeId('box')
    e.createShape({ id: box, type: 'geo', x: 20, y: 20, props: { w: 60, h: 60, fill: 'solid' } })
    const before = e.getShape(box)!.parentId
    e.setSelectedShapes([box])
    pointer(e, 'pointer_down', 50, 50)
    for (let i = 1; i <= 12; i++) pointer(e, 'pointer_move', 50 + i * 33, 50 + i * 12)
    pointer(e, 'pointer_up', 446, 194)
    const after = e.getShape(box)!.parentId
    console.log('parent before:', before, 'after:', after, 'frame is:', frame)
    console.log('shape now at:', e.getShape(box)!.x, e.getShape(box)!.y)
    expect(after).toBe(frame)
  })
})
