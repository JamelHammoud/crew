import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'select-probe' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function frame(subject: Editor, id: string, x: number, y: number, w = 100, h = 60): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'frame', x, y, props: { w, h, name: id, color: 'black' } })
  return shapeId
}

function key(subject: Editor, name: 'key_down' | 'key_up', code: string, extra: Record<string, unknown> = {}): void {
  subject.dispatch({
    name,
    key: code.startsWith('Arrow') || code === 'Tab' || code === 'Enter' ? code : code.toLowerCase(),
    code,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false,
    ...extra
  })
}

describe('the select tool driven through the editor', () => {
  it('nudges the selection by one on an arrow key', () => {
    const subject = editor()
    const id = frame(subject, 'one', 100, 100)
    subject.select(id)
    key(subject, 'key_down', 'ArrowRight')
    expect(subject.getShape(id)?.x).toBe(101)
  })

  it('nudges by ten while shift is held', () => {
    const subject = editor()
    const id = frame(subject, 'one', 100, 100)
    subject.select(id)
    key(subject, 'key_down', 'ArrowRight', { shiftKey: true })
    expect(subject.getShape(id)?.x).toBe(110)
  })

  it('clears the selection on a cancel', () => {
    const subject = editor()
    const id = frame(subject, 'one', 100, 100)
    subject.select(id)
    subject.dispatch({ name: 'cancel' })
    expect(subject.getSelectedShapeIds()).toEqual([])
  })

  it('walks the selection from shape to shape on tab', () => {
    const subject = editor()
    const first = frame(subject, 'one', 0, 0)
    const second = frame(subject, 'two', 400, 0)
    subject.select(first)
    key(subject, 'key_up', 'Tab')
    expect(subject.getSelectedShapeIds()).toEqual([second])
    key(subject, 'key_up', 'Tab')
    expect(subject.getSelectedShapeIds()).toEqual([first])
  })

  it('does not throw when tab is pressed with nothing selected', () => {
    const subject = editor()
    frame(subject, 'one', 0, 0)
    expect(() => key(subject, 'key_up', 'Tab')).not.toThrow()
  })

  it('moves a shape by the drag delta through the pointer events', () => {
    const subject = editor()
    const id = frame(subject, 'one', 100, 100)
    subject.select(id)
    subject.dispatch({ name: 'pointer_down', target: 'shape', shape: subject.getShape(id), point: { x: 150, y: 130 } })
    subject.inputs.pointerDown({ x: 150, y: 130 }, { x: 150, y: 130 }, {})
    subject.inputs.pointerMove({ x: 190, y: 160 }, { x: 190, y: 160 }, {})
    subject.dispatch({ name: 'pointer_move', target: 'shape', shape: subject.getShape(id) })
    expect(subject.getShape(id)?.x).toBe(140)
    expect(subject.getShape(id)?.y).toBe(130)
  })
})
