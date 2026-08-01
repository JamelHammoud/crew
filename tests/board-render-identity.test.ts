import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { sameRenderingShapes } from '../src/renderer/src/canvas/render/ShapeLayer'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { GeoShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'
import { keepWholePixels } from '../src/renderer/src/design/wholePixels'

function board(): Editor {
  const subject = new Editor({
    store: createTLStore({ id: 'render-identity' }),
    shapeUtils: [GeoShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
  subject.setViewportScreenBounds({ x: 0, y: 0, w: 1000, h: 800 })
  return subject
}

function geo(subject: Editor, name: string, x: number, y: number): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w: 200, h: 160, geo: 'rectangle', fill: 'solid' } })
  return id
}

describe('what a move hands the rendering list', () => {
  it('keeps the props of a shape that only moved', () => {
    const subject = board()
    const stop = keepWholePixels(subject)
    const id = geo(subject, 'moved', 100, 100)
    const before = subject.getShape(id)!.props
    subject.updateShape({ id, type: 'geo', x: 180, y: 140 })
    const after = subject.getShape(id)!.props
    stop()
    expect(after.w).toBe(before.w)
    expect(after.h).toBe(before.h)
    expect(after).toBe(before)
  })

  it('reads a shape that only moved as the same thing to render', () => {
    const subject = board()
    const stop = keepWholePixels(subject)
    const id = geo(subject, 'rendered', 100, 100)
    const before = subject.getRenderingShapes()
    subject.updateShape({ id, type: 'geo', x: 180, y: 140 })
    const after = subject.getRenderingShapes()
    stop()
    expect(sameRenderingShapes(before, after)).toBe(true)
  })
})
