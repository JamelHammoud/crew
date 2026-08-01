import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

const MODS = { shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, accelKey: false }

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

function at(e: Editor, name: string, x: number, y: number): void {
  const screen = { x, y }
  const page = e.screenToPage(screen)
  if (name === 'pointer_down') {
    e.inputs.pointerDown(screen, page, MODS as never, 'mouse')
    e.inputs.setButton(0, true)
  } else if (name === 'pointer_move') {
    e.inputs.pointerMove(screen, page, MODS as never, e.options.dragDistanceSquared as number)
  } else {
    e.inputs.pointerUp(screen, page, MODS as never)
  }
  e.dispatch({
    name,
    type: 'pointer',
    target: 'canvas',
    point: page,
    button: 0,
    isPen: false,
    pointerId: 1,
    ...MODS
  } as never)
}

function path(e: Editor): string {
  let node = (e as never as { root: { id: string; getCurrent?: () => never } }).root
  const parts: string[] = []
  while (node) {
    parts.push(node.id)
    node = node.getCurrent?.() as never
  }
  return parts.join('.')
}

describe('dragging a shape with the inputs driven as the dom layer drives them', () => {
  it('moves it and drops it into the frame it was dragged over', () => {
    const e = ed()
    const frame = createShapeId('frame')
    e.createShape({ id: frame, type: 'frame', x: 300, y: 60, props: { w: 300, h: 300, name: 'Card' } })
    const box = createShapeId('box')
    e.createShape({ id: box, type: 'geo', x: 20, y: 20, props: { w: 60, h: 60, fill: 'solid' } })
    e.setSelectedShapes([box])

    at(e, 'pointer_down', 50, 50)
    console.log('after down:', path(e), 'page point:', JSON.stringify(e.inputs.getCurrentPagePoint()))
    at(e, 'pointer_move', 90, 62)
    console.log('after 40px:', path(e), 'dragging:', e.inputs.getIsDragging())
    for (let i = 2; i <= 12; i++) at(e, 'pointer_move', 50 + i * 33, 50 + i * 12)
    console.log('before up:', path(e), 'shape at:', e.getShape(box)!.x, e.getShape(box)!.y)
    at(e, 'pointer_up', 446, 194)
    const after = e.getShape(box)!
    console.log('final at:', after.x, after.y, 'parent:', after.parentId)
    expect(after.x).not.toBe(20)
    expect(after.parentId).toBe(frame)
  })
})
