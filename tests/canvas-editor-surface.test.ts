import { describe, expect, it } from 'vitest'
import { Editor } from '../src/renderer/src/canvas/editor'
import { Box } from '../src/renderer/src/canvas/math'
import { createShapeId, createTLStore, type TLShapeId } from '../src/renderer/src/canvas/schema'
import { ArrowShapeUtil, FrameShapeUtil, GeoShapeUtil, GroupShapeUtil } from '../src/renderer/src/canvas/shapes'
import { SelectTool } from '../src/renderer/src/canvas/tools/select'

function editor() {
  return new Editor({
    store: createTLStore({ id: 'editor-surface-test' }),
    shapeUtils: [FrameShapeUtil, GroupShapeUtil, GeoShapeUtil, ArrowShapeUtil],
    tools: [SelectTool],
    getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as HTMLElement
  })
}

function geo(subject: Editor, name: string, x: number, y: number, w = 100, h = 60): TLShapeId {
  const id = createShapeId(name)
  subject.createShape({ id, type: 'geo', x, y, props: { w, h, fill: 'solid' } })
  return id
}

describe('the editor surface the tools reach for', () => {
  it('reads a shape back from the store rather than from a stale record', () => {
    const subject = editor()
    const id = geo(subject, 'stale', 0, 0)
    const before = subject.getShape(id)!
    subject.updateShape({ id, type: 'geo', x: 400, y: 300 })
    expect(subject.getShapePageBounds(before)?.toJson()).toMatchObject({ x: 400, y: 300 })
    expect(subject.getPointInShapeSpace(before, { x: 400, y: 300 })).toMatchObject({ x: 0, y: 0 })
    expect(subject.isPointInShape(before, { x: 450, y: 330 }, { hitInside: true })).toBe(true)
  })

  it('holds the keys that are down and the points a drag was measured from', () => {
    const subject = editor()
    subject.inputs.setKey('ArrowLeft', true)
    subject.inputs.setKey('ShiftLeft', true)
    expect(subject.inputs.keys.has('ArrowLeft')).toBe(true)
    expect(subject.inputs.getShiftKey()).toBe(true)
    subject.inputs.setKey('ArrowLeft', false)
    expect(subject.inputs.keys.has('ArrowLeft')).toBe(false)
    subject.inputs.pointerDown({ x: 10, y: 10 }, { x: 10, y: 10 }, {})
    subject.inputs.pointerMove({ x: 30, y: 30 }, { x: 30, y: 30 }, {})
    expect(subject.inputs.getPreviousPagePoint()).toMatchObject({ x: 10, y: 10 })
    expect(subject.inputs.getOriginPagePoint()).toMatchObject({ x: 10, y: 10 })
    expect(subject.inputs.getIsDragging()).toBe(true)
  })

  it('answers every user preference the tools ask about', () => {
    const subject = editor()
    expect(subject.user.getIsWrapMode()).toBe(false)
    expect(subject.user.getIsDynamicResizeMode()).toBe(false)
    expect(subject.user.getIsSnapMode()).toBe(false)
    expect(subject.user.getAnimationSpeed()).toBe(1)
    expect(subject.user.getAreKeyboardShortcutsEnabled()).toBe(true)
    subject.user.updateUserPreferences({ isWrapMode: true })
    expect(subject.user.getIsWrapMode()).toBe(true)
  })

  it('keeps a scribble while it is drawn and lets it go when it stops', () => {
    const subject = editor()
    const scribble = subject.scribbles.addScribble({ color: 'muted-1', size: 12 })
    for (let at = 0; at < 12; at++) subject.scribbles.addPoint(scribble.id, at * 4, 0)
    subject.scribbles.tick(16)
    expect(subject.getInstanceState().scribbles.length).toBe(1)
    subject.scribbles.stop(scribble.id)
    for (let at = 0; at < 40; at++) subject.scribbles.tick(16)
    expect(subject.getInstanceState().scribbles.length).toBe(0)
  })

  it('selects the outermost group rather than the frame a shape sits in', () => {
    const subject = editor()
    const frameId = createShapeId('holder')
    subject.createShape({ id: frameId, type: 'frame', x: 0, y: 0, props: { w: 400, h: 400 } })
    const child = createShapeId('inside')
    subject.createShape({ id: child, type: 'geo', parentId: frameId, x: 10, y: 10, props: { w: 50, h: 50 } })
    expect(subject.getOutermostSelectableShape(subject.getShape(child)!).id).toBe(child)
    subject.groupShapes([child])
    const group = subject.getShape(child)!.parentId as TLShapeId
    expect(subject.getOutermostSelectableShape(subject.getShape(child)!).id).toBe(group)
  })

  it('walks ancestors outermost first and finds the nearest one that matches', () => {
    const subject = editor()
    const outer = createShapeId('outer')
    subject.createShape({ id: outer, type: 'frame', x: 0, y: 0, props: { w: 400, h: 400 } })
    const inner = createShapeId('inner')
    subject.createShape({ id: inner, type: 'frame', parentId: outer, x: 10, y: 10, props: { w: 200, h: 200 } })
    const leaf = geoIn(subject, inner)
    expect(subject.getShapeAncestors(leaf).map(shape => shape.id)).toEqual([outer, inner])
    expect(subject.findShapeAncestor(leaf, shape => shape.type === 'frame')?.id).toBe(inner)
    expect(subject.hasAncestor(leaf, outer)).toBe(true)
    expect(subject.getAncestorPageId(leaf)).toBe(subject.getCurrentPageId())
  })

  it('clips a child to the frame that holds it', () => {
    const subject = editor()
    const frameId = createShapeId('clipper')
    subject.createShape({ id: frameId, type: 'frame', x: 0, y: 0, props: { w: 100, h: 100 } })
    const child = createShapeId('spilling')
    subject.createShape({ id: child, type: 'geo', parentId: frameId, x: 50, y: 50, props: { w: 200, h: 200 } })
    expect(subject.getShapeMask(frameId)).toBeUndefined()
    expect(subject.getShapeMask(child)).toBeDefined()
    expect(subject.getShapeClipPath(child)).toContain('polygon(')
    const masked = subject.getShapeMaskedPageBounds(child)
    expect(masked?.w).toBeLessThanOrEqual(50)
    expect(subject.isPointInShape(child, { x: 200, y: 200 }, { hitInside: true })).toBe(false)
  })

  it('takes every shape whose bounds meet the box rather than only those inside it', () => {
    const subject = editor()
    const inside = geo(subject, 'inside', 10, 10, 20, 20)
    const across = geo(subject, 'across', 90, 10, 200, 20)
    const away = geo(subject, 'away', 900, 900, 20, 20)
    const found = subject.getShapeIdsInsideBounds(new Box(0, 0, 100, 100))
    expect(found.has(inside)).toBe(true)
    expect(found.has(across)).toBe(true)
    expect(found.has(away)).toBe(false)
  })
})

function geoIn(subject: Editor, parentId: TLShapeId): TLShapeId {
  const id = createShapeId(`leaf-${parentId}`)
  subject.createShape({ id, type: 'geo', parentId, x: 0, y: 0, props: { w: 10, h: 10 } })
  return id
}
