import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  const subject = new Editor({
    store: createTLStore({ id: 'snappable-test' }),
    shapeUtils: [FrameShapeUtil, GeoShapeUtil, GroupShapeUtil],
    tools: [SelectTool],
    getContainer: () =>
      ({
        getBoundingClientRect: () => ({ left: 0, top: 0 })
      }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 1000 })
  return subject
}

function geo(subject: Editor, id: string, x: number, y: number, w = 10, h = 10): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'geo', x, y, props: { w, h } })
  return shapeId
}

function frame(subject: Editor, id: string, x: number, y: number, w = 200, h = 200): TLShapeId {
  const shapeId = createShapeId(id)
  subject.createShape({ id: shapeId, type: 'frame', x, y, props: { w, h, name: id, color: 'black' } })
  return shapeId
}

const targets = (subject: Editor): string[] => subject.getSnappableShapes().map(shape => shape.id).sort()

describe('which shapes are snap targets', () => {
  it('never reaches the children of a selected frame', () => {
    const subject = editor()
    const holder = frame(subject, 'holder', 0, 0)
    const inside = geo(subject, 'inside', 10, 10)
    const outside = geo(subject, 'outside', 400, 400)
    subject.reparentShapes([inside], holder)
    subject.select(holder)
    expect(targets(subject)).toEqual([outside])
  })

  it('is transparent to groups, pushing the children and never the group', () => {
    const subject = editor()
    const a = geo(subject, 'a', 0, 0)
    const b = geo(subject, 'b', 40, 0)
    const loner = geo(subject, 'loner', 400, 400)
    const group = createShapeId('group')
    subject.groupShapes([a, b], group)
    subject.select(loner)
    expect(targets(subject)).toEqual([a, b].sort())
    expect(targets(subject)).not.toContain(group)
  })

  it('leaves out a shape the viewport does not reach, and keeps one it only overlaps', () => {
    const subject = editor()
    const near = geo(subject, 'near', 100, 100)
    geo(subject, 'far', 5000, 5000)
    const straddling = geo(subject, 'straddling', 995, 100)
    const dragged = geo(subject, 'dragged', 0, 0)
    subject.select(dragged)
    expect(targets(subject)).toEqual([near, straddling].sort())
  })

  it('snaps to the siblings under the same parent, and to the frame itself', () => {
    const subject = editor()
    const holder = frame(subject, 'holder', 0, 0)
    const sibling = geo(subject, 'sibling', 10, 10)
    const cousin = geo(subject, 'cousin', 400, 400)
    const dragged = geo(subject, 'dragged', 20, 20)
    subject.reparentShapes([sibling, dragged], holder)
    subject.select(dragged)
    const found = targets(subject)
    expect(found).toContain(sibling)
    expect(found).toContain(holder)
    expect(found).not.toContain(cousin)
    expect(found).not.toContain(dragged)
  })

  it('holds the frame as a target even where the frame runs past the viewport', () => {
    const subject = editor()
    const holder = frame(subject, 'holder', 0, 0, 5000, 5000)
    const dragged = geo(subject, 'dragged', 20, 20)
    subject.reparentShapes([dragged], holder)
    subject.select(dragged)
    expect(targets(subject)).toEqual([holder])
  })

  it('answers the same array while nothing but the selection has moved', () => {
    const subject = editor()
    geo(subject, 'target', 100, 100)
    const dragged = geo(subject, 'dragged', 0, 0)
    subject.select(dragged)
    const first = subject.getSnappableShapes()
    subject.updateShape({ id: dragged, type: 'geo', x: 3 })
    expect(subject.getSnappableShapes()).toBe(first)
    subject.updateShape({ id: dragged, type: 'geo', x: 6 })
    expect(subject.getSnappableShapes()).toBe(first)
  })

  it('answers again once something other than the selection changes', () => {
    const subject = editor()
    const target = geo(subject, 'target', 100, 100)
    const dragged = geo(subject, 'dragged', 0, 0)
    subject.select(dragged)
    const first = subject.getSnappableShapes()
    subject.updateShape({ id: target, type: 'geo', x: 120 })
    const second = subject.getSnappableShapes()
    expect(second).not.toBe(first)
    expect(second[0].pageBounds.x).toBe(120)
  })

  it('answers again once the viewport moves', () => {
    const subject = editor()
    geo(subject, 'target', 100, 100)
    const dragged = geo(subject, 'dragged', 0, 0)
    subject.select(dragged)
    const first = subject.getSnappableShapes()
    subject.setCamera({ x: -5000, y: -5000 })
    expect(subject.getSnappableShapes()).not.toBe(first)
    expect(targets(subject)).toEqual([])
  })
})
