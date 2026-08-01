import { describe, expect, it } from 'vitest'
import { availableCommands } from '../src/renderer/src/design/commands'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil, GroupShapeUtil, defaultBindingUtils } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'context-menu-test' }),
    shapeUtils: [GeoShapeUtil, GroupShapeUtil],
    bindingUtils: defaultBindingUtils,
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function geo(subject: Editor, name: string, x: number): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y: 0, props: { w: 100, h: 100, fill: 'solid' } })
  return id
}

function grouped(subject: Editor): { group: TLShapeId; child: TLShapeId } {
  const one = geo(subject, 'one', 0)
  const two = geo(subject, 'two', 200)
  subject.groupShapes([one, two])
  const group = subject.getSelectedShapeIds()[0]
  subject.selectNone()
  return { group, child: one }
}

function rightClick(subject: Editor, x: number, y: number): void {
  const point = { x, y }
  subject.dispatch({
    name: 'right_click',
    target: 'canvas',
    point,
    screenPoint: point,
    phase: 'down',
    button: 2,
    buttons: 2,
    pointerId: 1,
    pointerType: 'mouse',
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    accelKey: false
  } as never)
}

function commands(subject: Editor, point: { x: number; y: number }): string[] {
  return availableCommands({
    editor: subject,
    point,
    ask: () => {},
    rename: () => {}
  }).map(command => command.id)
}

describe('right clicking a board', () => {
  it('aims at the group rather than the shape inside it', () => {
    const subject = editor()
    const { group } = grouped(subject)
    rightClick(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
  })

  it('keeps the group selected when it already was, so it can be ungrouped', () => {
    const subject = editor()
    const { group } = grouped(subject)
    subject.select(group)
    rightClick(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([group])
    expect(commands(subject, { x: 50, y: 50 })).toContain('ungroup')
  })

  it('offers ungroup on a group reached from nothing selected', () => {
    const subject = editor()
    grouped(subject)
    rightClick(subject, 50, 50)
    expect(commands(subject, { x: 50, y: 50 })).toContain('ungroup')
  })

  it('aims at the shape once you have gone into the group', () => {
    const subject = editor()
    const { child, group } = grouped(subject)
    subject.setFocusedGroup(group)
    rightClick(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([child])
  })

  it('leaves a shape that stands on its own alone', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0)
    rightClick(subject, 50, 50)
    expect(subject.getSelectedShapeIds()).toEqual([one])
  })

  it('clears the selection on empty canvas', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0)
    subject.select(one)
    rightClick(subject, 600, 600)
    expect(subject.getSelectedShapeIds()).toEqual([])
  })
})
