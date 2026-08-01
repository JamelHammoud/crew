import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

type Mods = { shiftKey?: boolean; altKey?: boolean; ctrlKey?: boolean; accelKey?: boolean }

const NONE: Required<Mods> = { shiftKey: false, altKey: false, ctrlKey: false, accelKey: false }

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

function down(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  const mods = { ...NONE, ...extra }
  subject.inputs.pointerDown(point, point, mods as never)
  subject.dispatch({
    name: 'pointer_down',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'down',
    ...mods,
    ...extra
  } as never)
}

function move(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  const mods = { ...NONE, ...extra }
  subject.inputs.pointerMove(point, point, mods as never, 16)
  subject.dispatch({
    name: 'pointer_move',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'move',
    ...mods,
    ...extra
  } as never)
}

function up(subject: Editor, x: number, y: number, extra: Record<string, unknown> = {}): void {
  const point = { x, y }
  const mods = { ...NONE, ...extra }
  subject.inputs.pointerUp(point, point, mods as never)
  subject.dispatch({
    name: 'pointer_up',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'up',
    ...mods,
    ...extra
  } as never)
}

function downOn(subject: Editor, target: Record<string, unknown>, x: number, y: number, extra: Mods = {}): void {
  const point = { x, y }
  const mods = { ...NONE, ...extra }
  subject.inputs.pointerDown(point, point, mods as never)
  subject.dispatch({
    name: 'pointer_down',
    point,
    screenPoint: point,
    phase: 'down',
    ...mods,
    ...target
  } as never)
}

function key(subject: Editor, name: 'key_down' | 'key_up', code: string, extra: Mods = {}): void {
  const mods = { ...NONE, ...extra }
  subject.inputs.setKey(code, name === 'key_down')
  subject.inputs.updateModifiers(mods as never)
  subject.dispatch({ name, key: code, code, ...mods } as never)
}

function tick(subject: Editor, elapsed = 250): void {
  subject.dispatch({ name: 'tick', elapsed } as never)
}

function brushFrom(subject: Editor, from: [number, number], to: [number, number], mods: Mods = {}): void {
  down(subject, from[0], from[1], mods)
  move(subject, to[0], to[1], mods)
}

describe('brushing matches tldraw', () => {
  it('selects a shape the brush only crosses', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    brushFrom(subject, [50, 150], [150, 160])
    expect(subject.getCurrentToolPath()).toBe('select.brushing')
    expect(subject.getSelectedShapeIds()).toEqual([a])
  })

  it('skips a shape it only crosses while wrapping', () => {
    const subject = editor()
    geo(subject, 'a', 100, 100)
    brushFrom(subject, [50, 150], [150, 160], { ctrlKey: true })
    expect(subject.getSelectedShapeIds()).toEqual([])
  })

  it('keeps the shapes that were already selected while shift is held', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    const b = geo(subject, 'b', 400, 400)
    subject.select(b)
    brushFrom(subject, [50, 50], [250, 250], { shiftKey: true })
    expect([...subject.getSelectedShapeIds()].sort()).toEqual([a, b].sort())
  })

  it('leaves a locked shape out of the brush', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    subject.updateShape({ id: a, type: 'geo', isLocked: true })
    brushFrom(subject, [50, 50], [300, 300])
    expect(subject.getSelectedShapeIds()).toEqual([])
  })

  it('hands over to scribble brushing on alt', () => {
    const subject = editor()
    geo(subject, 'a', 100, 100)
    brushFrom(subject, [50, 50], [80, 80], { altKey: true })
    expect(subject.getCurrentToolPath()).toBe('select.scribble_brushing')
  })

  it('puts the selection back on cancel', () => {
    const subject = editor()
    geo(subject, 'a', 100, 100)
    const b = geo(subject, 'b', 400, 400)
    subject.select(b)
    down(subject, 50, 50, { shiftKey: true })
    move(subject, 250, 250, { shiftKey: true })
    expect(subject.getSelectedShapeIds()).not.toEqual([b])
    subject.dispatch({ name: 'cancel' } as never)
    expect(subject.getSelectedShapeIds()).toEqual([b])
  })

  it('edge scrolls on a tick', () => {
    const subject = editor()
    geo(subject, 'a', 100, 100)
    down(subject, 400, 300)
    move(subject, 797, 300)
    expect(subject.getCurrentToolPath()).toBe('select.brushing')
    const before = subject.getCamera().x
    tick(subject)
    tick(subject)
    expect(subject.getCamera().x).not.toBe(before)
  })
})

describe('translating matches tldraw', () => {
  function startTranslate(subject: Editor, id: TLShapeId, mods: Mods = {}): void {
    downOn(subject, { target: 'shape', shape: subject.getShape(id) }, 120, 120, mods)
    move(subject, 220, 220, mods)
  }

  it('moves the shape by the drag delta', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    startTranslate(subject, a)
    expect(subject.getCurrentToolPath()).toBe('select.translating')
    expect(subject.getShape(a)?.x).toBe(200)
    expect(subject.getShape(a)?.y).toBe(200)
  })

  it('locks the drag to one axis while shift is held', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    downOn(subject, { target: 'shape', shape: subject.getShape(a) }, 120, 120)
    move(subject, 220, 130, { shiftKey: true })
    expect(subject.getShape(a)?.x).toBe(200)
    expect(subject.getShape(a)?.y).toBe(100)
  })

  it('clones the shape on alt', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    downOn(subject, { target: 'shape', shape: subject.getShape(a) }, 120, 120)
    move(subject, 220, 220)
    key(subject, 'key_down', 'AltLeft', { altKey: true })
    expect(subject.getCurrentPageShapes().length).toBe(2)
    expect(subject.getShape(a)?.x).toBe(100)
  })

  it('puts the shape back on cancel', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    startTranslate(subject, a)
    expect(subject.getShape(a)?.x).toBe(200)
    subject.dispatch({ name: 'cancel' } as never)
    expect(subject.getShape(a)?.x).toBe(100)
    expect(subject.getCurrentToolPath()).toBe('select.idle')
  })

  it('edge scrolls on a tick', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    downOn(subject, { target: 'shape', shape: subject.getShape(a) }, 120, 120)
    move(subject, 400, 300)
    move(subject, 797, 300)
    expect(subject.getCurrentToolPath()).toBe('select.translating')
    const before = subject.getCamera().x
    tick(subject)
    tick(subject)
    expect(subject.getCamera().x).not.toBe(before)
  })

  it('records the clone offset so the next duplicate repeats it', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    downOn(subject, { target: 'shape', shape: subject.getShape(a) }, 120, 120)
    move(subject, 220, 220)
    key(subject, 'key_down', 'AltLeft', { altKey: true })
    up(subject, 220, 220, { altKey: true })
    expect(subject.getInstanceState().duplicateProps).toBeTruthy()
  })
})

describe('resizing matches tldraw', () => {
  it('edge scrolls on a tick', () => {
    const subject = editor()
    const a = geo(subject, 'a', 100, 100)
    subject.select(a)
    downOn(subject, { target: 'selection', handle: 'bottom_right' }, 200, 200)
    move(subject, 400, 300)
    move(subject, 797, 300)
    expect(subject.getCurrentToolPath()).toBe('select.resizing')
    const before = subject.getCamera().x
    tick(subject)
    tick(subject)
    expect(subject.getCamera().x).not.toBe(before)
  })
})

describe('the drag threshold matches tldraw', () => {
  it('does not begin a brush under the threshold', () => {
    const subject = editor()
    down(subject, 50, 50)
    move(subject, 51, 51)
    expect(subject.getCurrentToolPath()).toBe('select.pointing_canvas')
  })

  it('begins a brush over the threshold', () => {
    const subject = editor()
    down(subject, 50, 50)
    move(subject, 56, 56)
    expect(subject.getCurrentToolPath()).toBe('select.brushing')
  })
})
