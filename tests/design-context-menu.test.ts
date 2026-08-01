import { describe, expect, it } from 'vitest'
import { menuTarget } from '../src/renderer/src/components/DesignContextMenu'
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
  subject.createShape({ id, type: 'geo', x, y: 0, props: { w: 100, h: 100 } })
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

describe('right clicking a board', () => {
  it('aims at the group rather than the shape inside it', () => {
    const subject = editor()
    const { group, child } = grouped(subject)
    const under = subject.getShape(child)!
    expect(menuTarget(subject, under).id).toBe(group)
  })

  it('aims at the shape once its group is already selected', () => {
    const subject = editor()
    const { group, child } = grouped(subject)
    subject.select(group)
    const under = subject.getShape(child)!
    expect(menuTarget(subject, under).id).toBe(child)
  })

  it('aims at the shape once you have gone into the group', () => {
    const subject = editor()
    const { group, child } = grouped(subject)
    subject.setFocusedGroupId(group)
    const under = subject.getShape(child)!
    expect(menuTarget(subject, under).id).toBe(child)
  })

  it('leaves a shape that stands on its own alone', () => {
    const subject = editor()
    const one = geo(subject, 'one', 0)
    const under = subject.getShape(one)!
    expect(menuTarget(subject, under).id).toBe(one)
  })
})
