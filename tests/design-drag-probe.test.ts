import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'drag-probe' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 800, h: 600 })
  return subject
}

function geo(subject: Editor, id: string, x: number, y: number, w = 100, h = 100): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'geo', x, y, props: { w, h } })
  return shapeId
}

const MODS = { shiftKey: false, altKey: false, ctrlKey: false, accelKey: false }

function down(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  subject.inputs.pointerDown(point, point, { ...MODS, ...extra } as never)
  subject.dispatch({
    name: 'pointer_down',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'down',
    ...MODS,
    ...extra
  } as never)
}

function move(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  subject.inputs.pointerMove(point, point, { ...MODS, ...extra } as never, 16)
  subject.dispatch({
    name: 'pointer_move',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'move',
    ...MODS,
    ...extra
  } as never)
}

function up(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  subject.inputs.pointerUp(point, point, { ...MODS, ...extra } as never)
  subject.dispatch({
    name: 'pointer_up',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'up',
    ...MODS,
    ...extra
  } as never)
}

describe('reproduction', () => {
  it('brushes on a drag across empty canvas', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    down(subject, 10, 10)
    expect(subject.root.getPath()).toBe('select.pointing_canvas')
    move(subject, 300, 300)
    expect(subject.root.getPath()).toBe('select.brushing')
    expect(subject.getSelectedShapeIds()).toEqual([a])
  })

  it('translates on a drag from a shape', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    const point = { x: 120, y: 120 }
    subject.inputs.pointerDown(point, point, MODS as never)
    subject.dispatch({
      name: 'pointer_down',
      target: 'shape',
      shape: subject.getShape(a),
      point,
      screenPoint: point,
      phase: 'down',
      ...MODS
    } as never)
    expect(subject.root.getPath()).toBe('select.pointing_shape')
    move(subject, 220, 220)
    expect(subject.root.getPath()).toBe('select.translating')
    expect(subject.getShape(a)?.x).toBe(200)
  })
})
