// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { defaultBindingUtils, defaultShapeUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools'

const ONE = createShapeId('one')
const TWO = createShapeId('two')

function board(): { subject: Editor; group: TLShapeId } {
  const subject = new Editor({
    store: createTLStore({ id: 'group-drill' }),
    shapeUtils: [...defaultShapeUtils],
    bindingUtils: [...defaultBindingUtils],
    tools: [SelectTool],
    getContainer: () =>
      ({ getBoundingClientRect: () => ({ left: 0, top: 0 }), focus: () => undefined }) as unknown as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  subject.createShape({ id: ONE, type: 'geo', x: 0, y: 0, props: { w: 100, h: 100, fill: 'solid' } })
  subject.createShape({ id: TWO, type: 'geo', x: 200, y: 0, props: { w: 100, h: 100, fill: 'solid' } })
  subject.groupShapes([ONE, TWO])
  const group = subject.getSelectedShapeIds()[0]
  subject.selectNone()
  subject.setFocusedGroup(null)
  return { subject, group }
}

function event(name: string, x: number, y: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    target: 'canvas',
    point: { x, y, z: 0.5 },
    button: 0,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    accelKey: false,
    ...extra
  }
}

function click(subject: Editor, x: number, y: number): void {
  subject.dispatch(event('pointer_down', x, y) as never)
  subject.dispatch(event('pointer_up', x, y) as never)
}

function doubleClick(subject: Editor, x: number, y: number): void {
  click(subject, x, y)
  subject.dispatch(event('pointer_down', x, y) as never)
  subject.dispatch(event('double_click', x, y, { phase: 'down' }) as never)
  subject.dispatch(event('pointer_up', x, y) as never)
}

function drag(subject: Editor, fromX: number, fromY: number, toX: number, toY: number): void {
  subject.dispatch(event('pointer_down', fromX, fromY) as never)
  subject.dispatch(event('pointer_move', toX, toY) as never)
  subject.dispatch(event('pointer_move', toX, toY) as never)
  subject.dispatch(event('pointer_up', toX, toY) as never)
}

describe('drilling into a group', () => {
  it('selects the group when a shape inside it is clicked', () => {
    const { subject, group } = board()
    click(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
  })

  it('keeps the group selected when the same shape is clicked again', () => {
    const { subject, group } = board()
    click(subject, 50, 50)
    click(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
    expect(subject.getFocusedGroupId()).not.toBe(group)
  })

  it('keeps the group selected when another shape inside it is clicked', () => {
    const { subject, group } = board()
    click(subject, 50, 50)
    click(subject, 250, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
  })

  it('selects the shape under the pointer on a double click', () => {
    const { subject, group } = board()
    doubleClick(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([ONE])
    expect(subject.getFocusedGroupId()).toBe(group)
  })

  it('moves the shape rather than the group once it is drilled into', () => {
    const { subject } = board()
    doubleClick(subject, 50, 50)
    drag(subject, 50, 50, 150, 50)
    expect(subject.getShape(ONE)?.x).toBe(100)
    expect(subject.getShape(TWO)?.x).toBe(200)
  })

  it('keeps the shape selected when it is clicked again', () => {
    const { subject, group } = board()
    doubleClick(subject, 50, 50)
    click(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([ONE])
    expect(subject.getFocusedGroupId()).toBe(group)
  })

  it('selects a sibling on a single click once it is drilled into', () => {
    const { subject, group } = board()
    doubleClick(subject, 50, 50)
    click(subject, 250, 50)
    expect(subject.getSelectedShapeIds()).toEqual([TWO])
    expect(subject.getFocusedGroupId()).toBe(group)
  })

  it('steps back out to the group on escape', () => {
    const { subject, group } = board()
    doubleClick(subject, 50, 50)
    subject.dispatch({ name: 'cancel' } as never)
    expect(subject.getSelectedShapeIds()).toEqual([group])
    expect(subject.getFocusedGroupId()).not.toBe(group)
  })

  it('leaves the group when the canvas outside it is clicked', () => {
    const { subject, group } = board()
    doubleClick(subject, 50, 50)
    click(subject, 700, 600)
    expect(subject.getSelectedShapeIds()).toEqual([])
    expect(subject.getFocusedGroupId()).not.toBe(group)
  })
})
