import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { handleShortcut } from '../src/renderer/src/canvas/editor/shortcuts'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import {
  ArrowShapeUtil,
  FrameShapeUtil,
  GeoShapeUtil,
  GroupShapeUtil,
  defaultBindingUtils
} from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'editor-bindings-test' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil, ArrowShapeUtil],
    bindingUtils: defaultBindingUtils,
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function geo(subject: Editor, name: string, x: number, y: number, w = 100, h = 100): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w, h } })
  return id
}

function boundArrow(subject: Editor, target: TLShapeId): TLShapeId {
  const id = createShapeId('arrow')
  subject.createShape({ id, type: 'arrow', x: 0, y: 0, props: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } } })
  subject.createBinding({
    type: 'arrow',
    fromId: id,
    toId: target,
    props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false, snap: 'none' }
  })
  return id
}

describe('bindings', () => {
  it('tells a binding from a shape apart from one to it', () => {
    const subject = editor()
    const target = geo(subject, 'target', 200, 0)
    const arrow = boundArrow(subject, target)
    expect(subject.getBindingsFromShape(arrow).length).toBe(1)
    expect(subject.getBindingsFromShape(target).length).toBe(0)
    expect(subject.getBindingsToShape(target).length).toBe(1)
    expect(subject.getBindingsInvolvingShape(target).length).toBe(1)
  })

  it('takes the default props from the binding util', () => {
    const subject = editor()
    const target = geo(subject, 'target', 200, 0)
    const arrow = createShapeId('bare')
    subject.createShape({ id: arrow, type: 'arrow', x: 0, y: 0 })
    subject.createBinding({ type: 'arrow', fromId: arrow, toId: target, props: { terminal: 'end' } })
    expect(subject.getBindingsFromShape(arrow)[0].props).toMatchObject({
      terminal: 'end',
      isPrecise: false,
      normalizedAnchor: { x: 0.5, y: 0.5 }
    })
  })

  it('moves the arrow terminal with the shape it points at', () => {
    const subject = editor()
    const target = geo(subject, 'target', 200, 0)
    const arrow = boundArrow(subject, target)
    const before = subject.getShapeHandles(arrow)!.find(handle => handle.id === 'end')!.x
    subject.updateShape({ id: target, type: 'geo', x: 400 })
    const after = subject.getShapeHandles(arrow)!.find(handle => handle.id === 'end')!.x
    expect(after).toBeGreaterThan(before)
  })

  it('leaves the arrow where it was drawn when the shape it points at goes', () => {
    const subject = editor()
    const target = geo(subject, 'target', 200, 0)
    const arrow = boundArrow(subject, target)
    const before = subject.getShapeHandles(arrow)!.find(handle => handle.id === 'end')!
    subject.deleteShapes([target])
    expect(subject.getBindingsFromShape(arrow).length).toBe(0)
    const after = subject.getShapeHandles(arrow)!.find(handle => handle.id === 'end')!
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('takes the bindings with a shape that is deleted', () => {
    const subject = editor()
    const target = geo(subject, 'target', 200, 0)
    const arrow = boundArrow(subject, target)
    subject.deleteShapes([arrow])
    expect(subject.store.query('binding').get().length).toBe(0)
  })
})

describe('the side effects the editor keeps for itself', () => {
  it('lets a group go when it drops below two children', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    const two = geo(subject, 'two', 200, 0)
    subject.groupShapes([one, two])
    const group = subject.getShape(one)!.parentId as TLShapeId
    expect(subject.getShape(group)?.type).toBe('group')
    subject.deleteShapes([one])
    expect(subject.getShape(group)).toBeUndefined()
    expect(subject.getShape(two)?.parentId).toBe(subject.getCurrentPageId())
  })

  it('forgets a deleted shape it was hovering, erasing or hinting at', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0)
    subject.setHoveredShape(id)
    subject.setErasingShapes([id])
    subject.setHintingShapes([id])
    subject.select(id)
    subject.deleteShapes([id])
    expect(subject.getHoveredShapeId()).toBeNull()
    expect(subject.getErasingShapeIds()).toEqual([])
    expect(subject.getCurrentPageState().hintingShapeIds).toEqual([])
    expect(subject.getSelectedShapeIds()).toEqual([])
  })
})

describe('the keyboard shortcuts the editor owns', () => {
  const press = (key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent =>
    ({ key, shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, ...modifiers }) as KeyboardEvent

  it('deletes, duplicates, groups and selects everything', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0, 0)
    const two = geo(subject, 'two', 200, 0)
    subject.select(one, two)
    expect(handleShortcut(subject, press('g', { metaKey: true }))).toBe(true)
    expect(subject.getShape(one)?.parentId.startsWith('shape:')).toBe(true)
    expect(handleShortcut(subject, press('G', { metaKey: true, shiftKey: true }))).toBe(true)
    expect(subject.getShape(one)?.parentId).toBe(subject.getCurrentPageId())
    subject.select(one)
    expect(handleShortcut(subject, press('d', { metaKey: true }))).toBe(true)
    expect(subject.getCurrentPageShapes().length).toBe(3)
    expect(handleShortcut(subject, press('Backspace'))).toBe(true)
    expect(subject.getCurrentPageShapes().length).toBe(2)
    subject.selectNone()
    expect(handleShortcut(subject, press('a', { metaKey: true }))).toBe(true)
    expect(subject.getSelectedShapeIds().length).toBe(2)
  })

  it('keeps its hands off a shape that is being edited', () => {
    const subject = editor()
    const id = geo(subject, 'one', 0, 0)
    subject.select(id)
    subject.setEditingShape(id)
    expect(handleShortcut(subject, press('Backspace'))).toBe(false)
    expect(subject.getShape(id)).toBeDefined()
  })
})
